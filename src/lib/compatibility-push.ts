import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelCompatibilities, type CatalogFilter, type ChannelVehicle, type CompatibilityWriteResult } from '@/channels/compatibilities';
import { ConnectError } from '@/channels/connect';
import { groupKey, hasWords, yearOf, type TargetGroup } from '@/domain/compatibilities';
import {
  auditAccountCompatibilities,
  groupName,
  groupsToAdd,
  linesKey,
  rememberIntruders,
  rememberUnfilled,
  removableExtra,
  withRelated,
  type StoredAudit,
} from '@/lib/compatibilities';
import { withAccessToken } from '@/lib/connections';

// La subida de las compatibilidades con vehículos al canal. Se manda solo lo
// que mostró la auditoría que pidió la persona y que, al releer el canal justo
// antes de mandar, sigue faltando o sobrando: nada que no haya visto. Lo ya
// mandado no se vuelve a mandar sin una auditoría nueva, así una vuelta
// siguiente no repite lo mismo ni borra lo que apareció después. Se manda una
// vez por producto del canal, porque las opciones de venta de una medida
// comparten lo cargado; en una familia, cada medida va por su lado. Después
// se vuelve a auditar y queda guardado cómo quedó. Si al agregar un grupo el
// canal mete vehículos que no salen de la ficha, se sacan en la misma subida
// y quedan anotados, para que la auditoría no los cuente como faltantes.

type Db = PrismaClient;

// Cuántos ejemplos se muestran de cada cosa.
const EXAMPLES = 10;
// Lo que entra en una subida: cada pedido al canal lleva unos pocos grupos, y
// la respuesta tiene que llegar antes del minuto. Lo demás queda para la siguiente.
const MAX_GROUPS = 25;
const MAX_REMOVE = 400;
const GROUPS_PER_CALL = 5;
const REMOVE_PER_CALL = 200;
// Lo que se calcula que tarda: cada auditoría y cada pedido al canal.
const AUDIT_MS = 6_000;
// Lo más que espera cada auditoría, antes y después de mandar.
const AUDIT_BUDGET_MS = 10_000;
const CALL_MS = 3_000;

const DEAD = ['CLOSED', 'DELETED', 'UNPUBLISHED'] as ('CLOSED' | 'DELETED' | 'UNPUBLISHED')[];

/** Las publicaciones que comparten lo cargado en el canal, con lo que hay por subir según la última auditoría. */
export type CompatibilityPushRow = {
  // La primera es a la que se manda: las demás son las otras opciones de venta de la medida.
  publicationIds: string[];
  codes: string[];
  title: string | null;
  storeName: string;
  channelName: string;
  readAt: Date;
  // El canal avisa que faltan vehículos.
  needed: boolean;
  add: { count: number; examples: string[] };
  // Grupos con algo cargado pero no todo lo del catálogo: se mandan para completarlos.
  complete: { count: number; examples: string[] };
  remove: { count: number; examples: { vehicle: string; reason: string }[] };
  // Lo que cargó el canal y no sale de la ficha: se borra a mano en el canal.
  byChannel: { brand: string; count: number | null }[];
  // Lo cargado que no se puede juzgar: no se toca.
  review: number;
  blocked: string | null;
};

const incompleteOf = (a: StoredAudit) => a.incomplete ?? [];

/** Lo que mostró la auditoría y todavía no se mandó: los nombres de los grupos y los códigos de los vehículos. */
function pendingOf(a: StoredAudit): { add: Set<string>; remove: Set<string> } | null {
  const s = a.shown;
  if (!s) return null;
  return { add: new Set(s.add.filter((x) => !s.sentAdd.includes(x))), remove: new Set(s.remove.filter((x) => !s.sentRemove.includes(x))) };
}

const NOT_SHOWN = 'Hay que auditarla de nuevo antes de subir: la subida manda solo lo que mostró una auditoría.';
const ALREADY_SENT = 'Ya se mandó lo que mostró la auditoría: auditala de nuevo para ver cómo quedó y qué queda.';
const ONLY_REMOVE = 'Solo tiene para borrar, y esta subida es solo para agregar: lo que sobra queda para otra.';

/**
 * Lo que hay por subir según la última auditoría, agrupado por producto del
 * canal. Con publicationIds, esas y las otras medidas y opciones de venta.
 */
export async function listCompatibilitiesToPush(
  db: Db,
  accountId: string,
  // exact: solo esas publicaciones, sin sumar las otras medidas y opciones de venta.
  opts: { publicationIds?: string[]; brand?: string | null; exact?: boolean } = {},
): Promise<CompatibilityPushRow[]> {
  const ids = opts.publicationIds ? (opts.exact ? opts.publicationIds : await withRelated(db, accountId, opts.publicationIds)) : null;
  const brand = opts.brand?.trim();
  const audited = await db.publicationCompatibility.findMany({
    where: {
      noData: false,
      OR: [{ missing: { gt: 0 } }, { extra: { gt: 0 } }],
      publication: {
        product: { accountId, ...(brand ? { brand: { equals: brand, mode: 'insensitive' as const } } : {}) },
        externalId: { not: null },
        channelStatus: { notIn: DEAD },
        ...(ids ? { id: { in: ids } } : {}),
      },
    },
    select: {
      readAt: true,
      needed: true,
      audit: true,
      publication: {
        select: {
          id: true,
          externalId: true,
          title: true,
          mainOptionId: true,
          storeId: true,
          store: { select: { name: true, channel: { select: { kind: true, name: true } }, connection: { select: { status: true } } } },
        },
      },
    },
  });

  // La principal de cada medida primero: es a la que se manda.
  audited.sort(
    (a, b) =>
      Number(a.publication.mainOptionId !== null) - Number(b.publication.mainOptionId !== null) ||
      a.publication.externalId!.localeCompare(b.publication.externalId!),
  );
  const groups = new Map<string, typeof audited>();
  for (const r of audited) {
    const audit = r.audit as StoredAudit | null;
    const key = `${r.publication.storeId}:${audit?.productId ?? r.publication.externalId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const rows: CompatibilityPushRow[] = [];
  for (const members of groups.values()) {
    const first = members[0];
    const audit = first.audit as StoredAudit | null;
    if (!audit) continue;
    if (audit.missing.length === 0 && incompleteOf(audit).length === 0 && removableExtra(audit).length === 0) continue;
    // Solo lo que mostró la auditoría y todavía no se mandó. Sin lo mostrado, se ve todo pero no se puede subir.
    const pending = pendingOf(audit);
    const isPending = (g: TargetGroup) => !pending || pending.add.has(groupName(g));
    const missing = audit.missing.filter(isPending);
    const incomplete = incompleteOf(audit).filter((x) => x.groups.some(isPending));
    const remove = removableExtra(audit).filter((x) => !pending || pending.remove.has(x.vehicle.vehicleId!));
    const p = first.publication;
    const channelName = p.store.channel.name;
    const channel = getChannelCompatibilities(p.store.channel.kind);
    rows.push({
      publicationIds: members.map((m) => m.publication.id),
      codes: members.map((m) => m.publication.externalId!),
      title: p.title,
      storeName: p.store.name,
      channelName,
      readAt: first.readAt,
      needed: members.some((m) => m.needed),
      add: { count: missing.length, examples: missing.slice(0, EXAMPLES).map((g) => g.label) },
      complete: {
        count: incomplete.length,
        examples: incomplete.slice(0, EXAMPLES).map((x) => x.label),
      },
      remove: { count: remove.length, examples: remove.slice(0, EXAMPLES).map((x) => ({ vehicle: x.vehicle.name, reason: x.reason })) },
      byChannel: audit.extraByChannel.map((x) => ({ brand: x.vehicle.name, count: x.vehicle.total })),
      review: audit.review.length,
      blocked: !channel?.write
        ? `Todavía no se pueden subir compatibilidades a ${channelName}.`
        : p.store.connection?.status !== 'ACTIVE'
          ? `La tienda no está conectada con ${channelName}.`
          : !pending
            ? NOT_SHOWN
            : missing.length + incomplete.length + remove.length === 0
              ? ALREADY_SENT
              : null,
    });
  }
  // Primero las que el canal pide completar.
  return rows.sort((a, b) => Number(b.needed) - Number(a.needed) || a.codes[0].localeCompare(b.codes[0]));
}

export type CompatibilityPushOutcome = {
  publicaciones: string[];
  titulo: string | null;
  resultado: 'subido' | 'en parte' | 'rechazado' | 'sin cambios' | 'salteada' | 'error';
  agregados: { grupos: number; ejemplos: string[] };
  borrados: { cantidad: number; ejemplos: string[] };
  // Lo que el canal metió al agregar los grupos y no sale de la ficha: se sacó en la misma subida.
  deshechos?: { cantidad: number; ejemplos: string[] };
  // Grupos recién mandados en los que el canal no cargó todo lo que cuenta: queda anotado.
  no_cargados?: { grupos: number; ejemplos: string[] };
  motivo?: string;
  rechazos?: string[];
  // Cómo quedó al volver a auditar después de mandar.
  despues?: { faltan: number; incompletos: number; sobran: number; a_revisar: number };
  aviso?: string;
  // Los ids en la app, para anotarlo en la actividad.
  publicationIds: string[];
};

export type CompatibilityPushReport = {
  subidas: CompatibilityPushOutcome[];
  // Las que no entraron en esta vuelta, por sus códigos.
  quedan: string[];
  busy?: true;
};

async function storedAudit(db: Db, publicationId: string): Promise<StoredAudit | null> {
  const row = await db.publicationCompatibility.findUnique({ where: { publicationId }, select: { audit: true } });
  return (row?.audit as StoredAudit | null) ?? null;
}

/** Los códigos de los vehículos cargados según la última lectura del canal. */
async function loadedIds(db: Db, publicationId: string): Promise<Set<string>> {
  const row = await db.publicationCompatibility.findUnique({ where: { publicationId }, select: { vehicles: true } });
  const v = (row?.vehicles ?? {}) as { listing?: ChannelVehicle[] | null; product?: ChannelVehicle[] | null };
  return new Set([...(v.listing ?? []), ...(v.product ?? [])].map((x) => x.vehicleId).filter((x): x is string => Boolean(x)));
}

/** Anota lo mandado en todas las que comparten lo cargado: no se vuelve a mandar sin auditar de nuevo. */
async function markSent(db: Db, publicationIds: string[], add: string[], remove: string[]): Promise<void> {
  for (const publicationId of publicationIds) {
    const audit = await storedAudit(db, publicationId);
    if (!audit?.shown) continue;
    const s = audit.shown;
    const shown = { ...s, sentAdd: [...new Set([...s.sentAdd, ...add])], sentRemove: [...new Set([...s.sentRemove, ...remove])] };
    await db.publicationCompatibility.update({
      where: { publicationId },
      data: { audit: { ...audit, shown } as unknown as Prisma.InputJsonValue },
    });
  }
}

/** El grupo agregado del que vino un vehículo: la misma marca, el mismo modelo y el mismo año. */
const groupOfVehicle = (name: string, groups: TargetGroup[]) =>
  groups.find((g) => hasWords(name, g.brand) && hasWords(name, g.model) && yearOf(name, g.model) === g.year) ?? null;

/**
 * Sube las compatibilidades: agrega lo que falta y borra lo que sobra, en la
 * misma subida. Sin publicationIds, todo lo que hay por subir en la cuenta (o
 * en la marca). Lo que no entra en budgetMs vuelve en quedan.
 */
export async function pushCompatibilities(
  db: Db,
  // addOnly: solo agrega lo que falta y completa los incompletos; lo que sobra queda para otra subida.
  args: { accountId: string; publicationIds?: string[]; brand?: string | null; exact?: boolean; budgetMs?: number; addOnly?: boolean },
): Promise<CompatibilityPushReport> {
  const started = Date.now();
  const budget = args.budgetMs ?? 40_000;
  const rows = await listCompatibilitiesToPush(db, args.accountId, { publicationIds: args.publicationIds, brand: args.brand, exact: args.exact });
  const report: CompatibilityPushReport = { subidas: [], quedan: [] };

  for (const row of rows) {
    const base = {
      publicaciones: row.codes,
      titulo: row.title,
      publicationIds: row.publicationIds,
      agregados: { grupos: 0, ejemplos: [] },
      borrados: { cantidad: 0, ejemplos: [] },
    };
    if (row.blocked) {
      report.subidas.push({ ...base, resultado: 'salteada', motivo: row.blocked });
      continue;
    }
    if (args.addOnly && row.add.count + row.complete.count === 0) {
      report.subidas.push({ ...base, resultado: 'salteada', motivo: ONLY_REMOVE });
      continue;
    }
    // La primera siempre va; las demás, si se calcula que entran.
    const calls =
      Math.ceil(Math.min(row.add.count + row.complete.count, MAX_GROUPS) / GROUPS_PER_CALL) +
      Math.ceil(Math.min(row.remove.count, MAX_REMOVE) / REMOVE_PER_CALL);
    const cost = 2 * AUDIT_MS + calls * CALL_MS;
    if (report.busy || (report.subidas.length > 0 && Date.now() - started + cost > budget)) {
      report.quedan.push(...row.codes);
      continue;
    }
    try {
      const outcome = await pushRow(db, args.accountId, row, Boolean(args.addOnly));
      if (outcome === 'later') report.quedan.push(...row.codes);
      else report.subidas.push(outcome);
    } catch (e) {
      if (e instanceof ConnectError && e.reauth) throw e;
      if (e instanceof ConnectError && e.busy) {
        report.busy = true;
        report.quedan.push(...row.codes);
        continue;
      }
      if (!(e instanceof ConnectError)) console.error('Subida de compatibilidades', row.codes.join(', '), e instanceof Error ? e.message : e);
      report.subidas.push({
        ...base,
        resultado: 'error',
        motivo: e instanceof ConnectError ? e.message : 'No se pudo subir: hubo un error en la app. Probá de nuevo.',
      });
    }
  }
  return report;
}

/** Sube lo de un producto del canal. 'later' si no hubo tiempo de releer el canal antes de mandar. */
async function pushRow(db: Db, accountId: string, row: CompatibilityPushRow, addOnly: boolean): Promise<CompatibilityPushOutcome | 'later'> {
  const main = row.publicationIds[0];
  const base = { publicaciones: row.codes, titulo: row.title, publicationIds: row.publicationIds };
  const nothing = { agregados: { grupos: 0, ejemplos: [] }, borrados: { cantidad: 0, ejemplos: [] } };
  const stored = await storedAudit(db, main);
  if (!stored) return { ...base, ...nothing, resultado: 'salteada', motivo: 'No tiene auditoría: auditala antes de subir.' };
  if (!stored.shown) return { ...base, ...nothing, resultado: 'salteada', motivo: NOT_SHOWN };

  // Antes de mandar: el canal y la ficha como están ahora. Lo que vio la persona queda como estaba.
  const audit = () => auditAccountCompatibilities(db, { accountId, publicationIds: row.publicationIds, exact: true, forPush: true, budgetMs: AUDIT_BUDGET_MS });
  const before = await audit();
  if (before.quedan.includes(row.codes[0])) {
    if (before.busy) throw new ConnectError('Mercado Libre pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.', false, true);
    return 'later';
  }
  const skipped = before.salteadas.find((s) => s.publicacion === row.codes[0]);
  if (skipped) return { ...base, ...nothing, resultado: 'error', motivo: skipped.motivo };
  const now = await storedAudit(db, main);
  if (!now) return 'later';
  const shown = now.shown ?? stored.shown;
  if (shown.lines !== linesKey(now)) {
    return {
      ...base,
      ...nothing,
      resultado: 'salteada',
      motivo: 'La ficha cambió después de la auditoría que se mostró: mirá de nuevo qué falta y qué sobra, y volvé a subir.',
      despues: counts(now),
    };
  }

  // Solo lo que se mostró, no se mandó todavía y sigue haciendo falta.
  const pending = pendingOf({ ...now, shown })!;
  if (pending.add.size + pending.remove.size === 0) return { ...base, ...nothing, resultado: 'salteada', motivo: ALREADY_SENT, despues: counts(now) };
  if (addOnly && pending.add.size === 0) return { ...base, ...nothing, resultado: 'salteada', motivo: ONLY_REMOVE, despues: counts(now) };
  const addAll = groupsToAdd(now).filter((g) => pending.add.has(groupName(g)));
  // Con solo agregar, lo que sobra no se borra ni se anota como mandado: queda para otra subida.
  const removeAll = addOnly ? [] : removableExtra(now).filter((x) => pending.remove.has(x.vehicle.vehicleId!));
  const add = addAll.slice(0, MAX_GROUPS);
  const remove = removeAll.slice(0, MAX_REMOVE);
  const more = addAll.length > add.length || removeAll.length > remove.length;
  if (add.length === 0 && remove.length === 0) {
    return { ...base, ...nothing, resultado: 'sin cambios', motivo: 'Ya estaba al día en el canal.', despues: counts(now) };
  }

  const target = await db.publication.findUniqueOrThrow({
    where: { id: main },
    select: { storeId: true, store: { select: { channel: { select: { kind: true } } } } },
  });
  const kind = target.store.channel.kind;
  const channel = getChannelCompatibilities(kind)!;
  const send = (change: { add: CatalogFilter[][]; remove: string[] }) =>
    withAccessToken(db, target.storeId, (token) => channel.write!(token, { externalId: row.codes[0] }, change));
  // Lo cargado antes de mandar: lo que aparezca después y no salga de la ficha lo trajeron los grupos.
  const loadedBefore = await loadedIds(db, main);
  let result: CompatibilityWriteResult | null = null;
  let failure: string | null = null;
  try {
    result = await send({ add: add.map((g) => g.filters as CatalogFilter[]), remove: remove.map((x) => x.vehicle.vehicleId!) });
  } catch (e) {
    // Se cortó o falló el canal: no se sabe qué entró. Se vuelve a auditar igual, para saberlo.
    // Si pidió esperar o hay que reconectar, no se anota: la próxima vuelta relee y manda solo lo que siga faltando.
    if (!(e instanceof ConnectError) || e.reauth || e.busy) throw e;
    failure = e.message;
  }
  // Lo mandado, aunque el canal lo haya rechazado: no se repite sin una auditoría nueva.
  await markSent(db, row.publicationIds, add.map(groupName), remove.map((x) => x.vehicle.vehicleId!));

  const rejectedIdx = new Set(result?.rejectedGroups.map((r) => r.index) ?? []);
  const added = result ? add.filter((_, i) => !rejectedIdx.has(i)) : [];
  const removed = result && !result.removeRejected ? remove : [];
  const rechazos = [...new Set([...(result?.rejectedGroups.map((r) => r.message) ?? []), ...(result?.removeRejected ? [result.removeRejected] : [])])];
  const site = row.codes[0].slice(0, 3).toUpperCase();
  // Los grupos que el canal aceptó, uno por cada número que se cuenta: se anota que se mandaron,
  // así la relectura los cuenta aunque sigan sin nada cargado.
  const addedByKey = new Map<string, TargetGroup>();
  for (const g of added) if (!addedByKey.has(groupKey(g))) addedByKey.set(groupKey(g), g);
  for (const g of addedByKey.values()) await rememberUnfilled(db, { kind, site, filters: g.filters as CatalogFilter[], add: 0 });

  // Después de mandar: cómo quedó.
  const read = async () => {
    const r = await audit();
    return r.quedan.length === 0 && r.salteadas.length === 0 ? await storedAudit(db, main) : null;
  };
  let done = await read();

  // Lo que el canal metió al agregar los grupos y no sale de la ficha: no estaba antes (o se acababa de
  // borrar) y ahora sobra. Se saca enseguida, porque lo puso esta subida, y se anota para que la
  // auditoría no lo cuente entre lo que tiene que tener el grupo.
  let undone: string[] = [];
  let undoFailure: string | null = null;
  if (done && added.length > 0) {
    const justRemoved = new Set(removed.map((x) => x.vehicle.vehicleId!));
    const brought = removableExtra(done).filter((x) => !loadedBefore.has(x.vehicle.vehicleId!) || justRemoved.has(x.vehicle.vehicleId!));
    if (brought.length > 0) {
      for (const x of brought) {
        const g = groupOfVehicle(x.vehicle.name, added);
        if (g) await rememberIntruders(db, { kind, site, filters: g.filters as CatalogFilter[], vehicles: [{ vehicleId: x.vehicle.vehicleId!, name: x.vehicle.name }] });
      }
      try {
        const r = await send({ add: [], remove: brought.map((x) => x.vehicle.vehicleId!) });
        if (r.removeRejected) undoFailure = r.removeRejected;
        else undone = brought.map((x) => x.vehicle.name);
      } catch (e) {
        if (!(e instanceof ConnectError) || e.reauth) throw e;
        undoFailure = e.message;
      }
      done = await read();
    }
  }

  // Lo que el catálogo cuenta en un grupo recién mandado y el canal no cargó: se anota, para que
  // la auditoría no lo muestre más como pendiente ni la subida lo vuelva a mandar sin resultado.
  const unfilled: string[] = [];
  if (done && !failure) {
    const audited = done;
    for (const [key, g] of addedByKey) {
      const expected = audited.counts?.[key];
      if (expected === undefined) continue;
      const incomplete = incompleteOf(audited).find((x) => x.groups.some((y) => groupKey(y) === key));
      const have = incomplete ? incomplete.loaded : audited.missing.some((y) => groupKey(y) === key) ? 0 : expected;
      if (expected - have <= 0) continue;
      await rememberUnfilled(db, { kind, site, filters: g.filters as CatalogFilter[], add: expected - have });
      unfilled.push(incomplete?.label ?? g.label);
    }
    if (unfilled.length > 0) done = await read();
  }

  const sentSomething = added.length > 0 || removed.length > 0;
  const resultado: CompatibilityPushOutcome['resultado'] = failure ? 'error' : rechazos.length === 0 ? 'subido' : sentSomething ? 'en parte' : 'rechazado';
  const despues = done ? counts(done) : undefined;
  const notes = [
    failure ? null : more ? 'Había más de lo que entra en una subida: lo que falta queda en Por subir para la siguiente.' : null,
    undone.length > 0
      ? 'Al agregar los grupos, Mercado Libre metió vehículos que no salen de la ficha: se sacaron en la misma subida y quedan anotados para no contarlos como faltantes.'
      : null,
    unfilled.length > 0
      ? `Mercado Libre no cargó todo lo que cuenta en ${unfilled.length === 1 ? '1 grupo' : `${unfilled.length} grupos`}: queda anotado y no se muestra más como pendiente.`
      : null,
    undoFailure
      ? `Al agregar los grupos, Mercado Libre metió vehículos que no salen de la ficha y no se pudieron sacar (${undoFailure.replace(/\.+$/, '')}). Aparecen en sobran: borralos a mano en el canal.`
      : null,
    despues && despues.faltan + despues.incompletos > 0 && resultado !== 'rechazado' && !failure
      ? 'Mercado Libre guarda al momento hasta 200 vehículos y el resto unos minutos después: si siguen faltando, volvé a auditar en un rato.'
      : null,
    done ? null : 'No se pudo volver a leer el canal después de mandar: auditala de nuevo para ver cómo quedó.',
  ].filter((x): x is string => x !== null);
  return {
    ...base,
    resultado,
    agregados: { grupos: added.length, ejemplos: added.slice(0, EXAMPLES).map((g) => g.label) },
    borrados: { cantidad: removed.length, ejemplos: removed.slice(0, EXAMPLES).map((x) => x.vehicle.name) },
    ...(undone.length > 0 ? { deshechos: { cantidad: undone.length, ejemplos: undone.slice(0, EXAMPLES) } } : {}),
    ...(unfilled.length > 0 ? { no_cargados: { grupos: unfilled.length, ejemplos: unfilled.slice(0, EXAMPLES) } } : {}),
    ...(failure ? { motivo: failure } : {}),
    ...(rechazos.length > 0 ? { rechazos } : {}),
    ...(despues ? { despues } : {}),
    ...(notes.length > 0 ? { aviso: notes.join(' ') } : {}),
  };
}

const counts = (a: StoredAudit) => ({
  faltan: a.missing.length,
  incompletos: incompleteOf(a).length,
  sobran: a.extra.length + a.extraByChannel.length,
  a_revisar: a.review.length,
});
