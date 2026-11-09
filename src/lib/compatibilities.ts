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

// Se acabó el tiempo de este pedido: lo que falta queda para el siguiente.
class OutOfTime extends Error {}

// ───────────────────────────── El catálogo, con lo ya pedido guardado ─────────────────────────────

/** Un paso del recorrido del catálogo, para revisar cómo responde el canal. */
export type CatalogStep = {
  lista: CatalogField;
  filtros: string;
  cantidad: number | null;
  valores: string[];
};

type Catalog = {
  values(field: CatalogField, known: CatalogFilter[]): Promise<CatalogValue[] | null>;
};

function catalogFor(
  db: Db,
  args: {
    kind: ChannelKind;
    channel: ChannelCompatibilities;
    token: string;
    site: string;
    now: Date;
    trace?: CatalogStep[];
  },
): Catalog {
  const memory = new Map<string, CatalogValue[] | null>();
  return {
    async values(field, known) {
      const filters = known.map((k) => `${k.field}=${k.id}`).join('&');
      const key = `${args.kind}:${args.site}:${field}:${filters}`;
      if (memory.has(key)) return memory.get(key)!;
      const row = await db.channelCatalogValue.findUnique({ where: { key } });
      let values: CatalogValue[] | null;
      if (row && args.now.getTime() - row.fetchedAt.getTime() < CATALOG_DAYS * 86_400_000) values = row.values as CatalogValue[];
      else {
        values = await args.channel.values(args.token, {
          site: args.site,
          field,
          known,
        });
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
      memory.set(key, values);
      args.trace?.push({
        lista: field,
        filtros: filters,
        cantidad: values?.length ?? null,
        valores: (values ?? []).slice(0, 15).map((v) => v.name),
      });
      return values;
    },
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
async function withRelated(db: Db, accountId: string, ids: string[]): Promise<string[]> {
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

async function loadTargets(db: Db, accountId: string, ids: string[] | null) {
  const asked = ids ? await withRelated(db, accountId, ids) : null;
  return db.publication.findMany({
    where: {
      product: { accountId },
      externalId: { not: null },
      // Pedidas por su código van aunque estén finalizadas; si no, solo las vivas.
      ...(asked
        ? {
            id: { in: asked },
            OR: [{ id: { in: ids! } }, { channelStatus: LIVE }],
          }
        : { channelStatus: LIVE }),
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
 */
export async function auditAccountCompatibilities(
  db: Db,
  args: {
    accountId: string;
    publicationIds?: string[];
    raw?: boolean;
    budgetMs?: number;
    now?: Date;
  },
): Promise<CompatibilityAuditReport> {
  const started = Date.now();
  const now = args.now ?? new Date();
  const budget = args.budgetMs ?? 40_000;
  const targets = await loadTargets(db, args.accountId, args.publicationIds ?? null);
  const report: CompatibilityAuditReport = {
    publicaciones: [],
    fichas: [],
    fichas_sin_compatibilidades: [],
    salteadas: [],
    quedan: [],
  };
  const trace: CatalogStep[] | undefined = args.raw ? [] : undefined;
  const translated = new Map<string, TranslatedLine[]>();
  const noData = new Map<string, { producto: string; publicaciones: string[] }>();
  let probed = false;
  let busy = false;
  const late = () => Date.now() - started > budget;

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
      for (const t of list) {
        const code = t.externalId!;
        if (late() || busy) {
          report.quedan.push(code);
          continue;
        }
        try {
          await auditOne(t, code, token);
        } catch (e) {
          if (e instanceof OutOfTime) {
            report.quedan.push(code);
            continue;
          }
          // "Demasiados pedidos": lo que falta queda para después. Una llave que no sirve corta la vuelta.
          if (e instanceof ConnectError && e.busy) {
            busy = true;
            report.busy = true;
            report.quedan.push(code);
            continue;
          }
          if (e instanceof ConnectError && e.reauth) throw e;
          if (!(e instanceof ConnectError)) console.error('Auditoría de compatibilidades', code, e instanceof Error ? e.message : e);
          report.salteadas.push({
            publicacion: code,
            motivo: e instanceof ConnectError ? e.message : 'No se pudo auditar: hubo un error en la app.',
          });
        }
      }
    });
  }
  if (args.raw && trace && !report.catalogo) report.catalogo = { pasos: trace };
  return report;

  async function auditOne(t: Target, code: string, token: string) {
    const kind = t.store.channel.kind;
    const channel = getChannelCompatibilities(kind)!;
    const site = code.slice(0, 3).toUpperCase();
    const fichaLines = t.product.compatibilities as FichaCompatibility[];
    // La ficha es del producto: se traduce una vez para todas sus publicaciones.
    let lines = translated.get(t.productId);
    if (!lines) {
      const cat = catalogFor(db, { kind, channel, token, site, now, trace });
      lines = [];
      for (const [i, c] of fichaLines.entries()) {
        // Una ficha larga puede no entrar: lo pedido queda guardado y la próxima vuelta sigue rápido.
        if (Date.now() - started > budget * 1.25) throw new OutOfTime();
        lines.push(await translateLine(cat, lineRule(c, i)));
      }
      translated.set(t.productId, lines);
      if (fichaLines.length > 0)
        report.fichas.push({
          producto: t.product.name,
          lineas: lines.map(lineReport),
        });
      else {
        const entry = {
          producto: t.product.name,
          publicaciones: [] as string[],
        };
        noData.set(t.productId, entry);
        report.fichas_sin_compatibilidades.push(entry);
      }
      // Si el canal deja buscar vehículos uno por uno: se prueba una vez, para saberlo.
      const first = lines.find((l) => l.status === 'ok')?.groups[0];
      if (args.raw && !probed && first && channel.probeSearch) {
        probed = true;
        report.catalogo = {
          pasos: trace ?? [],
          busqueda_de_vehiculos: await channel.probeSearch(token, {
            site,
            filters: first.filters as CatalogFilter[],
          }),
        };
      }
    }
    noData.get(t.productId)?.publicaciones.push(code);

    const read = await channel.read(
      token,
      {
        externalId: code,
        channelProductId: t.channelCopy?.channelProductId ?? null,
      },
      { raw: args.raw },
    );
    const loaded = mergeLoaded(read.listing, read.product);
    const audit: CompatibilityAudit =
      fichaLines.length > 0
        ? auditCompatibilities(lines, loaded)
        : {
            covered: 0,
            missing: [],
            extra: [],
            extraByChannel: [],
            review: [],
          };
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

    const detail = {
      lines: lines.map((l) => ({ ...lineReport(l), groups: l.groups })),
      missing: audit.missing,
      extra: audit.extra,
      extraByChannel: audit.extraByChannel,
      review: audit.review,
    };
    const data = {
      readAt: now,
      needed: read.needed,
      suggested: read.suggested,
      vehicles: {
        listing: read.listing,
        product: read.product,
      } as unknown as Prisma.InputJsonValue,
      missing: audit.missing.length,
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
