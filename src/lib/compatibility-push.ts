import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelCompatibilities, type CatalogFilter, type CompatibilityWriteResult } from '@/channels/compatibilities';
import { ConnectError } from '@/channels/connect';
import { norm } from '@/domain/compatibilities';
import { auditAccountCompatibilities, withRelated, type StoredAudit } from '@/lib/compatibilities';
import { withAccessToken } from '@/lib/connections';

// La subida de las compatibilidades con vehículos al canal. Se manda solo lo
// que mostró la auditoría y que, al releer el canal justo antes de mandar,
// sigue faltando o sobrando: nada que la persona no haya visto. Se manda una
// vez por producto del canal, porque las opciones de venta de una medida
// comparten lo cargado; en una familia, cada medida va por su lado. Después
// se vuelve a auditar y queda guardado cómo quedó.

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
  remove: { count: number; examples: { vehicle: string; reason: string }[] };
  // Lo que cargó el canal y no sale de la ficha: se borra a mano en el canal.
  byChannel: { brand: string; count: number | null }[];
  // Lo cargado que no se puede juzgar: no se toca.
  review: number;
  blocked: string | null;
};

const removable = (a: StoredAudit) => a.extra.filter((x) => x.vehicle.vehicleId);

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
    const remove = removable(audit);
    if (audit.missing.length === 0 && remove.length === 0) continue;
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
      add: { count: audit.missing.length, examples: audit.missing.slice(0, EXAMPLES).map((g) => g.label) },
      remove: { count: remove.length, examples: remove.slice(0, EXAMPLES).map((x) => ({ vehicle: x.vehicle.name, reason: x.reason })) },
      byChannel: audit.extraByChannel.map((x) => ({ brand: x.vehicle.name, count: x.vehicle.total })),
      review: audit.review.length,
      blocked: !channel?.write
        ? `Todavía no se pueden subir compatibilidades a ${channelName}.`
        : p.store.connection?.status !== 'ACTIVE'
          ? `La tienda no está conectada con ${channelName}.`
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
  motivo?: string;
  rechazos?: string[];
  // Cómo quedó al volver a auditar después de mandar.
  despues?: { faltan: number; sobran: number; a_revisar: number };
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

const sameLines = (a: StoredAudit, b: StoredAudit) => a.lines.map((l) => norm(l.linea)).join('|') === b.lines.map((l) => norm(l.linea)).join('|');

async function storedAudit(db: Db, publicationId: string): Promise<StoredAudit | null> {
  const row = await db.publicationCompatibility.findUnique({ where: { publicationId }, select: { audit: true } });
  return (row?.audit as StoredAudit | null) ?? null;
}

/**
 * Sube las compatibilidades: agrega lo que falta y borra lo que sobra, en la
 * misma subida. Sin publicationIds, todo lo que hay por subir en la cuenta (o
 * en la marca). Lo que no entra en budgetMs vuelve en quedan.
 */
export async function pushCompatibilities(
  db: Db,
  args: { accountId: string; publicationIds?: string[]; brand?: string | null; exact?: boolean; budgetMs?: number },
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
    // La primera siempre va; las demás, si se calcula que entran.
    const calls = Math.ceil(Math.min(row.add.count, MAX_GROUPS) / GROUPS_PER_CALL) + Math.ceil(Math.min(row.remove.count, MAX_REMOVE) / REMOVE_PER_CALL);
    const cost = 2 * AUDIT_MS + calls * CALL_MS;
    if (report.busy || (report.subidas.length > 0 && Date.now() - started + cost > budget)) {
      report.quedan.push(...row.codes);
      continue;
    }
    try {
      const outcome = await pushRow(db, args.accountId, row);
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
async function pushRow(db: Db, accountId: string, row: CompatibilityPushRow): Promise<CompatibilityPushOutcome | 'later'> {
  const main = row.publicationIds[0];
  const base = { publicaciones: row.codes, titulo: row.title, publicationIds: row.publicationIds };
  const shown = await storedAudit(db, main);
  if (!shown)
    return {
      ...base,
      resultado: 'salteada',
      agregados: { grupos: 0, ejemplos: [] },
      borrados: { cantidad: 0, ejemplos: [] },
      motivo: 'No tiene auditoría: auditala antes de subir.',
    };

  // Antes de mandar: el canal y la ficha como están ahora.
  const before = await auditAccountCompatibilities(db, { accountId, publicationIds: row.publicationIds, exact: true, budgetMs: AUDIT_BUDGET_MS });
  if (before.quedan.includes(row.codes[0])) {
    if (before.busy) throw new ConnectError('Mercado Libre pidió esperar porque hubo demasiados pedidos. Probá de nuevo en unos minutos.', false, true);
    return 'later';
  }
  const skipped = before.salteadas.find((s) => s.publicacion === row.codes[0]);
  if (skipped) return { ...base, resultado: 'error', agregados: { grupos: 0, ejemplos: [] }, borrados: { cantidad: 0, ejemplos: [] }, motivo: skipped.motivo };
  const now = await storedAudit(db, main);
  if (!now) return 'later';
  if (!sameLines(shown, now)) {
    return {
      ...base,
      resultado: 'salteada',
      agregados: { grupos: 0, ejemplos: [] },
      borrados: { cantidad: 0, ejemplos: [] },
      motivo: 'La ficha cambió después de la auditoría que se mostró: mirá de nuevo qué falta y qué sobra, y volvé a subir.',
      despues: counts(now),
    };
  }

  // Solo lo que se mostró y sigue haciendo falta.
  const shownGroups = new Set(shown.missing.map((g) => norm(g.label)));
  const shownExtra = new Set(removable(shown).map((x) => x.vehicle.vehicleId));
  const addAll = now.missing.filter((g) => shownGroups.has(norm(g.label)));
  const removeAll = removable(now).filter((x) => shownExtra.has(x.vehicle.vehicleId));
  const add = addAll.slice(0, MAX_GROUPS);
  const remove = removeAll.slice(0, MAX_REMOVE);
  const more = addAll.length > add.length || removeAll.length > remove.length;
  if (add.length === 0 && remove.length === 0) {
    return {
      ...base,
      resultado: 'sin cambios',
      agregados: { grupos: 0, ejemplos: [] },
      borrados: { cantidad: 0, ejemplos: [] },
      motivo: 'Ya estaba al día en el canal.',
      despues: counts(now),
    };
  }

  const target = await db.publication.findUniqueOrThrow({
    where: { id: main },
    select: { storeId: true, store: { select: { channel: { select: { kind: true } } } } },
  });
  const channel = getChannelCompatibilities(target.store.channel.kind)!;
  let result: CompatibilityWriteResult | null = null;
  let failure: string | null = null;
  try {
    result = await withAccessToken(db, target.storeId, (token) =>
      channel.write!(
        token,
        { externalId: row.codes[0] },
        { add: add.map((g) => g.filters as CatalogFilter[]), remove: remove.map((x) => x.vehicle.vehicleId!) },
      ),
    );
  } catch (e) {
    // Se cortó o falló el canal: no se sabe qué entró. Se vuelve a auditar igual, para saberlo.
    if (!(e instanceof ConnectError) || e.reauth || e.busy) throw e;
    failure = e.message;
  }

  // Después de mandar: cómo quedó.
  const after = await auditAccountCompatibilities(db, { accountId, publicationIds: row.publicationIds, exact: true, budgetMs: AUDIT_BUDGET_MS });
  const done = after.quedan.length === 0 && after.salteadas.length === 0 ? await storedAudit(db, main) : null;

  const rejectedIdx = new Set(result?.rejectedGroups.map((r) => r.index) ?? []);
  const added = result ? add.filter((_, i) => !rejectedIdx.has(i)) : [];
  const removed = result && !result.removeRejected ? remove : [];
  const rechazos = [...new Set([...(result?.rejectedGroups.map((r) => r.message) ?? []), ...(result?.removeRejected ? [result.removeRejected] : [])])];
  const sentSomething = added.length > 0 || removed.length > 0;
  const resultado: CompatibilityPushOutcome['resultado'] = failure ? 'error' : rechazos.length === 0 ? 'subido' : sentSomething ? 'en parte' : 'rechazado';
  const despues = done ? counts(done) : undefined;
  const notes = [
    failure ? null : more ? 'Había más de lo que entra en una subida: lo que falta queda en Por subir para la siguiente.' : null,
    despues && despues.faltan > 0 && resultado !== 'rechazado' && !failure
      ? 'Mercado Libre guarda al momento hasta 200 vehículos y el resto unos minutos después: si siguen faltando, volvé a auditar en un rato.'
      : null,
    done ? null : 'No se pudo volver a leer el canal después de mandar: auditala de nuevo para ver cómo quedó.',
  ].filter((x): x is string => x !== null);
  return {
    ...base,
    resultado,
    agregados: { grupos: added.length, ejemplos: added.slice(0, EXAMPLES).map((g) => g.label) },
    borrados: { cantidad: removed.length, ejemplos: removed.slice(0, EXAMPLES).map((x) => x.vehicle.name) },
    ...(failure ? { motivo: failure } : {}),
    ...(rechazos.length > 0 ? { rechazos } : {}),
    ...(despues ? { despues } : {}),
    ...(notes.length > 0 ? { aviso: notes.join(' ') } : {}),
  };
}

const counts = (a: StoredAudit) => ({ faltan: a.missing.length, sobran: a.extra.length + a.extraByChannel.length, a_revisar: a.review.length });
