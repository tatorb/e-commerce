import type { PrismaClient, Prisma } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import {
  getChannelCompatibilities,
  type CatalogField,
  type CatalogFilter,
  type CatalogValue,
  type ChannelCompatibilities,
  type ChannelVehicle,
} from '@/channels/compatibilities';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import {
  auditCompatibilities,
  displacementOf,
  FUEL_LABEL,
  fuelOf,
  groupKey,
  groupLabel,
  isExcluded,
  lineRule,
  norm,
  pickByName,
  pickDisplacement,
  pickFuel,
  pickPower,
  pickYears,
  powerOf,
  similar,
  type CompatibilityAudit,
  type FichaCompatibility,
  type IncompleteGroup,
  type LineRule,
  type LoadedVehicle,
  type TargetGroup,
  type TranslatedLine,
} from '@/domain/compatibilities';
import { ConnectError } from '@/channels/connect';
import { withAccessToken } from '@/lib/connections';

// La auditoría de las compatibilidades con vehículos: por cada publicación,
// traduce la ficha a vehículos del catálogo del canal, lee lo que tiene
// cargado y dice qué falta, qué sobra y qué queda a revisar. No sube nada al
// canal. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Cuánto se guardan las listas del catálogo antes de volver a pedirlas.
const CATALOG_DAYS = 30;
// Cuántos ejemplos se muestran de cada cosa.
const EXAMPLES = 10;
// Cuántos pedidos al canal van a la vez: más rápido, sin pasarse de los que acepta.
const PARALLEL = 6;
// Cuántos productos se auditan a la vez: cada uno traduce su ficha y lee sus publicaciones.
const PRODUCTS_AT_ONCE = 4;

// Se acabó el tiempo de este pedido: lo que falta queda para el siguiente.
class OutOfTime extends Error {}

// ───────────────────────────── El catálogo, con lo ya pedido guardado ─────────────────────────────

/** Un paso del recorrido del catálogo, para revisar cómo responde el canal. */
export type CatalogStep = {
  // La lista recorrida, o "cantidad" cuando se contaron los vehículos de un grupo.
  lista: CatalogField | 'cantidad';
  filtros: string;
  cantidad: number | null;
  valores: string[];
};

type Catalog = {
  values(field: CatalogField, known: CatalogFilter[]): Promise<CatalogValue[] | null>;
  // Cuántos vehículos tiene el catálogo con esos filtros. Null si el canal no lo dice.
  count(filters: CatalogFilter[]): Promise<number | null>;
};

function catalogFor(
  db: Db,
  args: {
    kind: ChannelKind;
    channel: ChannelCompatibilities;
    token: string;
    site: string;
    now: Date;
    // Cada pedido al canal pasa por acá: limita cuántos van a la vez y corta si se acabó el tiempo.
    ask: <T>(run: () => Promise<T>) => Promise<T>;
    trace?: CatalogStep[];
  },
): Catalog {
  // Lo ya pedido en esta vuelta, o pidiéndose: dos líneas que necesitan la misma lista la piden una vez.
  const memory = new Map<string, Promise<CatalogValue[] | null>>();

  async function load(key: string, field: CatalogField, known: CatalogFilter[], filters: string): Promise<CatalogValue[] | null> {
    const row = await db.channelCatalogValue.findUnique({ where: { key } });
    let values: CatalogValue[] | null;
    if (row && args.now.getTime() - row.fetchedAt.getTime() < CATALOG_DAYS * 86_400_000) values = row.values as CatalogValue[];
    else {
      values = await args.ask(() => args.channel.values(args.token, { site: args.site, field, known }));
      // Una lista que no se pudo leer no se guarda: se vuelve a pedir la próxima vez.
      if (values !== null) {
        const data = {
          values: values as unknown as Prisma.InputJsonValue,
          fetchedAt: args.now,
        };
        await db.channelCatalogValue.upsert({
          where: { key },
          create: { key, ...data },
          update: data,
        });
      }
    }
    args.trace?.push({
      lista: field,
      filtros: filters,
      cantidad: values?.length ?? null,
      valores: (values ?? []).slice(0, 15).map((v) => v.name),
    });
    return values;
  }

  // Los números de cada grupo, guardados igual que las listas.
  const counted = new Map<string, Promise<number | null>>();
  async function loadCount(key: string, filters: CatalogFilter[], text: string): Promise<number | null> {
    const row = await db.channelCatalogValue.findUnique({ where: { key } });
    let count: number | null;
    if (row && typeof row.values === 'number' && args.now.getTime() - row.fetchedAt.getTime() < CATALOG_DAYS * 86_400_000) count = row.values;
    else {
      count = await args.ask(() => args.channel.count(args.token, { site: args.site, filters }));
      if (count !== null) {
        const data = { values: count, fetchedAt: args.now };
        await db.channelCatalogValue.upsert({ where: { key }, create: { key, ...data }, update: data });
      }
    }
    args.trace?.push({ lista: 'cantidad', filtros: text, cantidad: count, valores: [] });
    return count;
  }

  return {
    values(field, known) {
      const filters = known.map((k) => `${k.field}=${k.id}`).join('&');
      const key = `${args.kind}:${args.site}:${field}:${filters}`;
      let pending = memory.get(key);
      if (!pending) {
        pending = load(key, field, known, filters);
        memory.set(key, pending);
        // Lo que no se terminó (por tiempo o por un error) no queda en memoria.
        pending.catch(() => memory.delete(key));
      }
      return pending;
    },
    count(filters) {
      const text = filters.map((k) => `${k.field}=${k.id}`).join('&');
      const key = `${args.kind}:${args.site}:cantidad:${text}`;
      let pending = counted.get(key);
      if (!pending) {
        pending = loadCount(key, filters, text);
        counted.set(key, pending);
        pending.catch(() => counted.delete(key));
      }
      return pending;
    },
  };
}

/** Corre la tarea con cada uno, de a size a la vez. La tarea no tiene que fallar. */
async function inPool<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

/** El sitio del canal de un código de publicación, por ejemplo MLA de MLA123. */
const siteOf = (code: string) => code.slice(0, 3).toUpperCase();

/** Un límite de tareas a la vez: la que no tiene lugar espera. */
function limiter(size: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function <T>(run: () => Promise<T>): Promise<T> {
    if (running >= size) await new Promise<void>((r) => waiting.push(r));
    running++;
    try {
      return await run();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

// ───────────────────────────── La traducción de la ficha ─────────────────────────────

const names = (list: CatalogValue[]) => list.map((v) => v.name).join(', ');
const brandFilter = (id: string): CatalogFilter => ({ field: 'brand', id });

/** Una línea de la ficha llevada a grupos de vehículos del catálogo, o a revisar con el motivo. */
export async function translateLine(cat: Catalog, rule: LineRule): Promise<TranslatedLine> {
  const out: TranslatedLine = {
    rule,
    status: 'review',
    reason: null,
    brandName: null,
    modelNames: [],
    groups: [],
    notes: [],
  };
  const review = (reason: string): TranslatedLine => ({
    ...out,
    status: 'review',
    reason,
    groups: [],
  });

  if (!rule.brand) return review('Falta la marca.');
  const brands = await cat.values('brand', []);
  if (!brands) return review('No se pudo leer la lista de marcas del canal.');
  const brand = pickByName(brands, rule.brand, { brand: true });
  if (!brand) {
    const like = similar(brands, rule.brand);
    return review(`La marca ${rule.brand} no está en el catálogo de vehículos del canal.${like.length > 0 ? ` Parecidas: ${names(like)}.` : ''}`);
  }
  out.brandName = brand.name;
  if (rule.models.length === 0) return review('Falta el modelo: sin modelo no se sabe con qué vehículos es.');
  const models = await cat.values('model', [brandFilter(brand.id)]);
  if (!models) return review(`No se pudo leer la lista de modelos de ${brand.name}.`);
  const picked: CatalogValue[] = [];
  for (const m of rule.models) {
    const model = pickByName(models, m);
    if (!model) {
      const like = similar(models, m);
      return review(`El modelo ${m} no está en el catálogo de ${brand.name} del canal.${like.length > 0 ? ` Parecidos: ${names(like)}.` : ''}`);
    }
    picked.push(model);
  }
  out.modelNames = picked.map((m) => m.name);

  // Por qué no salió nada, si al final no sale ningún vehículo.
  let lastWhy: string | null = null;
  for (const model of picked) {
    const bm: CatalogFilter[] = [brandFilter(brand.id), { field: 'model', id: model.id }];
    const what = `${brand.name} ${model.name}`;
    const fuels = await cat.values('fuel', bm);
    if (!fuels || fuels.length === 0) return review(`El canal no informa los combustibles de ${what}: no se puede filtrar por combustible.`);
    let fuelValues: CatalogValue[];
    if (rule.fuel) {
      fuelValues = pickFuel(fuels, rule.fuel);
      if (fuelValues.length === 0) return review(`${what} no tiene versiones ${FUEL_LABEL[rule.fuel]} en el catálogo del canal (tiene ${names(fuels)}).`);
    } else {
      // Sin combustible en la ficha, solo si el modelo tiene uno solo.
      if (fuels.length !== 1 || !fuelOf(fuels[0].name))
        return review(`La ficha no dice el combustible y ${what} tiene más de uno (${names(fuels)}): completalo en la ficha.`);
      fuelValues = fuels;
    }

    for (const fuelValue of fuelValues) {
      const fuel = fuelOf(fuelValue.name)!;
      const bmf = [...bm, { field: 'fuel' as const, id: fuelValue.id }];
      // La cilindrada: por la lista de motores; si el canal no la tiene, por el nombre de cada versión.
      let engines: (CatalogValue | null)[] = [null];
      let displacementByVersion = false;
      if (rule.displacement) {
        const all = await cat.values('engine', bmf);
        if (all && all.length > 0) {
          engines = pickDisplacement(all, rule.displacement);
          if (engines.length === 0) {
            lastWhy = `${what} ${FUEL_LABEL[fuel]} no tiene motor ${rule.displacement} (tiene ${names(all)})`;
            continue;
          }
        } else displacementByVersion = true;
      }
      for (const engine of engines) {
        const bmfe = engine ? [...bmf, { field: 'engine' as const, id: engine.id }] : bmf;
        // La potencia: por la lista de potencias; si el canal no la tiene, por el nombre de cada versión.
        let powers: (CatalogValue | null)[] = [null];
        let powerByVersion = false;
        if (rule.power) {
          const all = await cat.values('power', bmfe);
          if (all && all.length > 0) {
            powers = pickPower(all, rule.power);
            if (powers.length === 0) {
              lastWhy = `${what} ${FUEL_LABEL[fuel]}${engine ? ` ${engine.name}` : ''} no tiene ${rule.power} cv (tiene ${names(all)})`;
              continue;
            }
          } else powerByVersion = true;
        }
        for (const power of powers) {
          const known = power ? [...bmfe, { field: 'power' as const, id: power.id }] : bmfe;
          // Las versiones: hacen falta para dejar afuera las que no van, o para filtrar lo que el canal no tiene en lista.
          let versions: CatalogValue[] | null = null;
          if (rule.exclude.length > 0 || displacementByVersion || powerByVersion) {
            const all = await cat.values('version', known);
            if (!all || all.length === 0) return review(`No se pudieron leer las versiones de ${what} para filtrarlas.`);
            versions = all.filter((v) => !isExcluded(v.name, rule.exclude));
            if (rule.exclude.length > 0 && versions.length === all.length) {
              const note = `Ninguna versión de ${what} se llama ${rule.exclude.join(' ni ')}: no se dejó afuera ninguna.`;
              if (!out.notes.includes(note)) out.notes.push(note);
            }
            if (displacementByVersion) versions = versions.filter((v) => displacementOf(v.name) === rule.displacement);
            if (powerByVersion) versions = versions.filter((v) => powerOf(v.name) === rule.power);
            if (versions.length === 0) {
              lastWhy = `ninguna versión de ${what} cumple con los datos de la ficha`;
              continue;
            }
          }
          const yearList = await cat.values('year', known);
          if (!yearList || yearList.length === 0) {
            lastWhy = `el canal no informa años para ${what} con esos datos`;
            continue;
          }
          const years = pickYears(yearList, rule.from, rule.to);
          if (years.length === 0) lastWhy = `${what} con esos datos no tiene años dentro de la ficha`;
          for (const y of years) {
            const g: Omit<TargetGroup, 'label'> = {
              line: rule.index,
              brand: brand.name,
              model: model.name,
              year: y.year,
              fuel,
              displacement: rule.displacement ?? (engine ? displacementOf(engine.name) : null),
              power: rule.power,
              versions: versions ? versions.map((v) => v.name) : null,
              filters: [...known, { field: 'year', id: y.id }, ...(versions ? versions.map((v) => ({ field: 'version', id: v.id })) : [])],
            };
            out.groups.push({ ...g, label: groupLabel(g) });
          }
        }
      }
    }
  }
  if (out.groups.length === 0) return review(`No sale ningún vehículo del catálogo con esos datos${lastWhy ? `: ${lastWhy}` : ''}.`);
  return { ...out, status: 'ok', reason: null };
}

// ───────────────────────────── La auditoría ─────────────────────────────

type Target = Awaited<ReturnType<typeof loadTargets>>[number];

const LIVE = {
  notIn: ['CLOSED', 'DELETED', 'UNPUBLISHED'] as ('CLOSED' | 'DELETED' | 'UNPUBLISHED')[],
};

/** Las publicaciones pedidas, con las otras medidas de su familia y las otras opciones de venta de cada medida. */
export async function withRelated(db: Db, accountId: string, ids: string[]): Promise<string[]> {
  const rows = await db.publication.findMany({
    where: { id: { in: ids }, product: { accountId } },
    select: { id: true, mainOptionId: true, familyId: true },
  });
  const mains = new Set(rows.map((r) => r.mainOptionId ?? r.id));
  const families = [...new Set(rows.map((r) => r.familyId).filter((f): f is string => Boolean(f)))];
  if (families.length > 0) {
    for (const m of await db.publication.findMany({
      where: { familyId: { in: families } },
      select: { id: true, mainOptionId: true },
    }))
      mains.add(m.mainOptionId ?? m.id);
  }
  const all = await db.publication.findMany({
    where: {
      OR: [{ id: { in: [...mains] } }, { mainOptionId: { in: [...mains] } }],
    },
    select: { id: true },
  });
  return [...new Set([...ids, ...all.map((p) => p.id)])];
}

async function loadTargets(db: Db, accountId: string, ids: string[] | null, opts: { brand?: string | null; freshSince?: Date | null; exact?: boolean } = {}) {
  const asked = ids ? (opts.exact ? ids : await withRelated(db, accountId, ids)) : null;
  const brand = opts.brand?.trim();
  return db.publication.findMany({
    where: {
      product: { accountId, ...(brand ? { brand: { equals: brand, mode: 'insensitive' as const } } : {}) },
      externalId: { not: null },
      // Pedidas por su código van aunque estén finalizadas; si no, solo las vivas.
      ...(asked
        ? {
            id: { in: asked },
            OR: [{ id: { in: ids! } }, { channelStatus: LIVE }],
          }
        : {
            channelStatus: LIVE,
            // Sin lista, lo auditado hace poco no se repite: cada vuelta sigue donde quedó la anterior.
            ...(opts.freshSince ? { OR: [{ compatibility: null }, { compatibility: { readAt: { lt: opts.freshSince } } }] } : {}),
          }),
      store: { connection: { is: { status: 'ACTIVE' } } },
    },
    orderBy: [{ storeId: 'asc' }, { productId: 'asc' }, { mainOptionId: { sort: 'asc', nulls: 'first' } }, { externalId: 'asc' }],
    select: {
      id: true,
      externalId: true,
      title: true,
      channelStatus: true,
      productId: true,
      store: {
        select: { id: true, channel: { select: { kind: true, name: true } } },
      },
      channelCopy: {
        select: { status: true, statusReason: true, channelProductId: true },
      },
      product: {
        select: {
          name: true,
          compatibilities: {
            orderBy: { position: 'asc' },
            select: {
              vehicleBrand: true,
              model: true,
              engine: true,
              displacement: true,
              fuel: true,
              power: true,
              excludedVersions: true,
              yearFrom: true,
              yearTo: true,
              note: true,
            },
          },
        },
      },
    },
  });
}

/** Lo cargado en la publicación y en su producto del canal, sin repetir. */
export function mergeLoaded(listing: ChannelVehicle[], product: ChannelVehicle[] | null): LoadedVehicle[] {
  const out: LoadedVehicle[] = [];
  for (const v of [...listing, ...(product ?? [])]) {
    const same = out.find((x) => (v.vehicleId && x.vehicleId ? x.vehicleId === v.vehicleId : norm(x.name) === norm(v.name) && x.byChannel === v.byChannel));
    if (!same)
      out.push({
        id: v.id,
        vehicleId: v.vehicleId,
        name: v.name,
        byChannel: v.byChannel,
        total: v.total,
      });
  }
  return out;
}

/** Lo que se guarda de cada auditoría: de acá sale lo que se sube, y lo que se mostró antes de subir. */
export type StoredAudit = {
  lines: (LineReport & { groups: TargetGroup[] })[];
  // Los grupos de vehículos que salen de la ficha y faltan en el canal.
  missing: TargetGroup[];
  // Los grupos con algo cargado pero no todo lo del catálogo. Falta en las auditorías viejas.
  incomplete?: IncompleteGroup[];
  // Lo que cargó la tienda y no sale de la ficha: se puede borrar.
  extra: { vehicle: LoadedVehicle; reason: string }[];
  // Lo que cargó el canal y no sale de la ficha: se borra a mano en el canal.
  extraByChannel: { vehicle: LoadedVehicle; reason: string }[];
  review: { vehicle: LoadedVehicle; reason: string }[];
  // El producto del canal que comparten las opciones de venta: lo cargado ahí vale para todas.
  productId?: string | null;
};

export type LineReport = {
  linea: string;
  estado: 'traducida' | 'a revisar';
  motivo?: string;
  grupos: number;
  ejemplos: string[];
  notas?: string[];
};

export type PublicationAuditReport = {
  publicacion: string;
  titulo: string | null;
  estado: string;
  motivo_del_estado?: string;
  aviso_del_canal: boolean;
  sugerencias_pendientes: boolean;
  en_el_canal: {
    en_la_publicacion: number;
    en_el_producto: number | null;
    cargadas_por_el_canal: { marca: string; cantidad: number | null }[];
  };
  ficha_sin_compatibilidades?: true;
  salen_de_la_ficha: number;
  faltan: { cantidad: number; ejemplos: string[] };
  // Grupos con algún vehículo cargado, pero no todos los del catálogo.
  incompletos: { cantidad: number; ejemplos: string[] };
  sobran: {
    cantidad: number;
    ejemplos: { vehiculo: string; motivo: string }[];
  };
  sobran_cargadas_por_el_canal: {
    marca: string;
    cantidad: number | null;
    motivo: string;
  }[];
  a_revisar: {
    cantidad: number;
    ejemplos: { vehiculo: string; motivo: string }[];
  };
  respuesta_del_canal?: Record<string, unknown>;
};

export type CompatibilityAuditReport = {
  publicaciones: PublicationAuditReport[];
  fichas: { producto: string; lineas: LineReport[] }[];
  fichas_sin_compatibilidades: { producto: string; publicaciones: string[] }[];
  salteadas: { publicacion: string; motivo: string }[];
  quedan: string[];
  // El canal pidió esperar porque hubo demasiados pedidos: lo que falta queda en quedan.
  busy?: true;
  catalogo?: { pasos: CatalogStep[]; busqueda_de_vehiculos?: unknown };
};

const lineReport = (l: TranslatedLine): LineReport => ({
  linea: l.rule.label,
  estado: l.status === 'ok' ? 'traducida' : 'a revisar',
  ...(l.reason ? { motivo: l.reason } : {}),
  grupos: l.groups.length,
  ejemplos: l.groups.slice(0, 5).map((g) => g.label),
  ...(l.notes.length > 0 ? { notas: l.notes } : {}),
});

/**
 * Audita las compatibilidades de las publicaciones de la cuenta, o de esas y
 * sus otras medidas y opciones de venta. No sube nada al canal: guarda lo
 * leído y el resultado. raw suma lo que respondió el canal, para revisarlo.
 *
 * Va de a varios productos a la vez: cada uno traduce su ficha una vez y lee
 * sus publicaciones. Antes de cada pedido al canal mira el reloj: lo que no
 * entra vuelve en quedan, y las listas del catálogo ya leídas quedan
 * guardadas, así la vuelta siguiente sigue rápido.
 */
export async function auditAccountCompatibilities(
  db: Db,
  args: {
    accountId: string;
    publicationIds?: string[];
    // Solo los productos con esa marca del repuesto en la ficha.
    brand?: string | null;
    // Sin lista: se saltean las auditadas desde ese momento, para seguir donde quedó la vuelta anterior.
    freshSince?: Date | null;
    // Solo las de la lista, sin sumar las otras medidas y opciones de venta.
    exact?: boolean;
    raw?: boolean;
    budgetMs?: number;
    now?: Date;
  },
): Promise<CompatibilityAuditReport> {
  const started = Date.now();
  const now = args.now ?? new Date();
  const budget = args.budgetMs ?? 30_000;
  const targets = await loadTargets(db, args.accountId, args.publicationIds ?? null, { brand: args.brand, freshSince: args.freshSince, exact: args.exact });
  const report: CompatibilityAuditReport = {
    publicaciones: [],
    fichas: [],
    fichas_sin_compatibilidades: [],
    salteadas: [],
    quedan: [],
  };
  const trace: CatalogStep[] | undefined = args.raw ? [] : undefined;
  // Las fichas en el orden de la lista, aunque se traduzcan varias a la vez.
  const fichas: { at: number; entry: CompatibilityAuditReport['fichas'][number] }[] = [];
  const noData: { at: number; entry: CompatibilityAuditReport['fichas_sin_compatibilidades'][number] }[] = [];
  const order = new Map(targets.map((t, i) => [t.externalId!, i]));
  const at = (code: string) => order.get(code) ?? 0;
  let probed = false;
  let busy = false;
  // Una llave que no sirve corta la vuelta entera.
  let fatal: unknown = null;
  const stop = () => busy || fatal !== null || Date.now() - started > budget;
  const slots = limiter(PARALLEL);
  // Cada pedido al canal espera su lugar y, si ya no hay tiempo, no sale.
  const ask = <T>(run: () => Promise<T>): Promise<T> =>
    slots(async () => {
      if (stop()) throw new OutOfTime();
      return run();
    });

  // Lo que no se pudo auditar: queda para la vuelta siguiente o va a salteadas con el motivo.
  const failed = (codes: string[], e: unknown) => {
    if (e instanceof OutOfTime) return void report.quedan.push(...codes);
    // "Demasiados pedidos": lo que falta queda para después.
    if (e instanceof ConnectError && e.busy) {
      busy = true;
      report.busy = true;
      return void report.quedan.push(...codes);
    }
    if (e instanceof ConnectError && e.reauth) {
      fatal ??= e;
      return void report.quedan.push(...codes);
    }
    if (!(e instanceof ConnectError)) console.error('Auditoría de compatibilidades', codes.join(', '), e instanceof Error ? e.message : e);
    for (const code of codes)
      report.salteadas.push({
        publicacion: code,
        motivo: e instanceof ConnectError ? e.message : 'No se pudo auditar: hubo un error en la app.',
      });
  };

  const byStore = new Map<string, Target[]>();
  for (const t of targets) byStore.set(t.store.id, [...(byStore.get(t.store.id) ?? []), t]);

  for (const [storeId, list] of byStore) {
    const kind = list[0].store.channel.kind;
    const channelName = list[0].store.channel.name;
    const channel = getChannelCompatibilities(kind);
    if (!channel) {
      for (const t of list)
        report.salteadas.push({
          publicacion: t.externalId!,
          motivo: `${channelName} no tiene compatibilidades con vehículos en la app.`,
        });
      continue;
    }
    await withAccessToken(db, storeId, async (token) => {
      const catalogs = new Map<string, Catalog>();
      // La ficha es del producto: se traduce una vez para todas sus publicaciones del mismo sitio.
      const byProduct = new Map<string, Target[]>();
      for (const t of list) {
        const key = `${siteOf(t.externalId!)}:${t.productId}`;
        byProduct.set(key, [...(byProduct.get(key) ?? []), t]);
      }
      await inPool([...byProduct.values()], PRODUCTS_AT_ONCE, async (pubs) => {
        const site = siteOf(pubs[0].externalId!);
        let cat = catalogs.get(site);
        if (!cat) {
          cat = catalogFor(db, { kind, channel, token, site, now, ask, trace });
          catalogs.set(site, cat);
        }
        await auditProduct(pubs, channel, cat, token, site);
      });
      if (fatal) throw fatal;
    });
  }

  report.fichas = fichas.sort((a, b) => a.at - b.at).map((f) => f.entry);
  report.fichas_sin_compatibilidades = noData.sort((a, b) => a.at - b.at).map((f) => f.entry);
  for (const e of report.fichas_sin_compatibilidades) e.publicaciones.sort((a, b) => at(a) - at(b));
  report.publicaciones.sort((a, b) => at(a.publicacion) - at(b.publicacion));
  report.quedan.sort((a, b) => at(a) - at(b));
  report.salteadas.sort((a, b) => at(a.publicacion) - at(b.publicacion));
  if (args.raw && trace && !report.catalogo) report.catalogo = { pasos: trace };
  return report;

  async function auditProduct(pubs: Target[], channel: ChannelCompatibilities, cat: Catalog, token: string, site: string) {
    const codes = pubs.map((t) => t.externalId!);
    if (stop()) return failed(codes, new OutOfTime());
    const first = pubs[0];
    const fichaLines = first.product.compatibilities as FichaCompatibility[];
    let lines: TranslatedLine[];
    try {
      // Todas las líneas a la vez: las listas que comparten se piden una sola vez.
      lines = await Promise.all(fichaLines.map((c, i) => translateLine(cat, lineRule(c, i))));
    } catch (e) {
      return failed(codes, e);
    }
    let entry: { producto: string; publicaciones: string[] } | null = null;
    if (fichaLines.length > 0) fichas.push({ at: at(codes[0]), entry: { producto: first.product.name, lineas: lines.map(lineReport) } });
    else {
      entry = { producto: first.product.name, publicaciones: [] };
      noData.push({ at: at(codes[0]), entry });
    }
    // Si el canal deja buscar vehículos uno por uno: se prueba una vez, para saberlo.
    const sample = lines.find((l) => l.status === 'ok')?.groups[0];
    if (args.raw && !probed && sample && channel.probeSearch) {
      probed = true;
      const probe = channel.probeSearch;
      const found = await ask(() => probe(token, { site, filters: sample.filters as CatalogFilter[] })).catch((e: unknown) => ({
        error: e instanceof Error ? e.message : String(e),
      }));
      report.catalogo = { pasos: trace ?? [], busqueda_de_vehiculos: found };
    }
    await Promise.all(
      pubs.map(async (t) => {
        const code = t.externalId!;
        entry?.publicaciones.push(code);
        try {
          await auditOne(t, code, token, channel, cat, lines);
        } catch (e) {
          failed([code], e);
        }
      }),
    );
  }

  async function auditOne(t: Target, code: string, token: string, channel: ChannelCompatibilities, cat: Catalog, lines: TranslatedLine[]) {
    const fichaLines = t.product.compatibilities as FichaCompatibility[];
    const read = await ask(() =>
      channel.read(
        token,
        {
          externalId: code,
          channelProductId: t.channelCopy?.channelProductId ?? null,
        },
        { raw: args.raw },
      ),
    );
    const loaded = mergeLoaded(read.listing, read.product);
    let audit: CompatibilityAudit =
      fichaLines.length > 0
        ? auditCompatibilities(lines, loaded)
        : {
            covered: 0,
            missing: [],
            incomplete: [],
            extra: [],
            extraByChannel: [],
            review: [],
          };
    // A los grupos con algo cargado se les cuenta cuántos vehículos tiene el catálogo, para ver si están completos.
    if (fichaLines.length > 0 && audit.covered > 0) {
      const missingKeys = new Set(audit.missing.map(groupKey));
      const byKey = new Map<string, TargetGroup[]>();
      for (const l of lines) {
        if (l.status !== 'ok') continue;
        for (const g of l.groups) if (!missingKeys.has(groupKey(g))) byKey.set(groupKey(g), [...(byKey.get(groupKey(g)) ?? []), g]);
      }
      const counts = new Map<string, number>();
      await Promise.all(
        [...byKey].map(async ([key, groups]) => {
          const each = await Promise.all(groups.map((g) => cat.count(g.filters as CatalogFilter[])));
          if (each.every((n) => n !== null))
            counts.set(
              key,
              each.reduce((a, b) => a + (b ?? 0), 0),
            );
        }),
      );
      audit = auditCompatibilities(lines, loaded, counts);
    }
    const status = t.channelCopy?.status ?? t.channelStatus;
    const byChannel = loaded.filter((v) => v.byChannel);
    const pub: PublicationAuditReport = {
      publicacion: code,
      titulo: t.title,
      estado: CHANNEL_STATUS_LABEL[status],
      ...(t.channelCopy?.statusReason ? { motivo_del_estado: t.channelCopy.statusReason } : {}),
      aviso_del_canal: read.needed,
      sugerencias_pendientes: read.suggested,
      en_el_canal: {
        en_la_publicacion: read.listing.length,
        en_el_producto: read.product ? read.product.length : null,
        cargadas_por_el_canal: byChannel.map((v) => ({
          marca: v.name,
          cantidad: v.total,
        })),
      },
      ...(fichaLines.length === 0 ? { ficha_sin_compatibilidades: true as const } : {}),
      salen_de_la_ficha: audit.covered,
      faltan: {
        cantidad: audit.missing.length,
        ejemplos: audit.missing.slice(0, EXAMPLES).map((g) => g.label),
      },
      incompletos: {
        cantidad: audit.incomplete.length,
        ejemplos: audit.incomplete.slice(0, EXAMPLES).map((x) => x.label),
      },
      sobran: {
        cantidad: audit.extra.length,
        ejemplos: audit.extra.slice(0, EXAMPLES).map((x) => ({ vehiculo: x.vehicle.name, motivo: x.reason })),
      },
      sobran_cargadas_por_el_canal: audit.extraByChannel.map((x) => ({
        marca: x.vehicle.name,
        cantidad: x.vehicle.total,
        motivo: x.reason,
      })),
      a_revisar: {
        cantidad: audit.review.length,
        ejemplos: audit.review.slice(0, EXAMPLES).map((x) => ({ vehiculo: x.vehicle.name, motivo: x.reason })),
      },
      ...(read.raw ? { respuesta_del_canal: read.raw } : {}),
    };
    report.publicaciones.push(pub);

    const detail: StoredAudit = {
      lines: lines.map((l) => ({ ...lineReport(l), groups: l.groups })),
      missing: audit.missing,
      incomplete: audit.incomplete,
      extra: audit.extra,
      extraByChannel: audit.extraByChannel,
      review: audit.review,
      productId: read.productId,
    };
    const data = {
      readAt: now,
      needed: read.needed,
      suggested: read.suggested,
      vehicles: {
        listing: read.listing,
        product: read.product,
      } as unknown as Prisma.InputJsonValue,
      // Faltan: los grupos sin nada y los incompletos.
      missing: audit.missing.length + audit.incomplete.length,
      extra: audit.extra.length + audit.extraByChannel.length,
      review: audit.review.length,
      noData: fichaLines.length === 0,
      audit: detail as unknown as Prisma.InputJsonValue,
    };
    await db.publicationCompatibility.upsert({
      where: { publicationId: t.id },
      create: { publicationId: t.id, ...data },
      update: data,
    });
  }
}
