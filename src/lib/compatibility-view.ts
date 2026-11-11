import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { ChannelVehicle } from '@/channels/compatibilities';
import { groupByModel, norm, type ModelGroup, type VehicleMark } from '@/domain/compatibilities';
import { mergeLoaded, type StoredAudit } from '@/lib/compatibilities';
import { listCompatibilitiesToPush, type CompatibilityPushRow } from '@/lib/compatibility-push';
import { formatDateTime } from '@/lib/format';
import type { LoadedCompatibilitiesData } from '@/components/compatibilities/LoadedCompatibilities';

type Db = PrismaClient | Prisma.TransactionClient;

// Lo que tiene cargado una publicación en el canal, según la última revisión,
// para mirarlo en el pipeline y en la página de la publicación: cada vehículo
// marcado como "va", "sobra" o "a revisar", agrupado por marca y modelo.

export type CompatibilityView = {
  publicationId: string;
  channelName: string;
  // Las líneas de la ficha: sin ninguna no hay nada que comparar.
  fichaLines: number;
  published: boolean;
  // La última revisión, o null si nunca se revisó.
  readAt: Date | null;
  // El canal avisa que faltan vehículos.
  needed: boolean;
  loaded: number;
  covered: number;
  extra: number;
  review: number;
  models: ModelGroup[];
  // Lo que cargó el canal: solo trae la marca y el total, y se borra a mano en el canal.
  byChannel: { brand: string; count: number | null; extra: boolean }[];
  // Los grupos que salen de la ficha y faltan, o están incompletos.
  missing: string[];
  incomplete: string[];
  // Cómo se leyó cada línea de la ficha.
  lines: { line: string; ok: boolean; reason: string | null; groups: number }[];
  // Lo que mostró la revisión y todavía se puede subir: las filas de Por subir.
  toPush: CompatibilityPushRow[];
};

/** Lo cargado de una publicación, marcado y agrupado. Null si la publicación no es de la cuenta. */
export async function loadCompatibilityView(db: Db, accountId: string, publicationId: string): Promise<CompatibilityView | null> {
  const pub = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      externalId: true,
      store: { select: { channel: { select: { name: true } } } },
      product: { select: { compatibilities: { select: { id: true } } } },
      compatibility: { select: { readAt: true, needed: true, vehicles: true, audit: true } },
    },
  });
  if (!pub) return null;
  const row = pub.compatibility;
  const base = {
    publicationId: pub.id,
    channelName: pub.store.channel.name,
    fichaLines: pub.product.compatibilities.length,
    published: Boolean(pub.externalId),
  };
  if (!row) {
    return { ...base, readAt: null, needed: false, loaded: 0, covered: 0, extra: 0, review: 0, models: [], byChannel: [], missing: [], incomplete: [], lines: [], toPush: [] };
  }
  const stored = row.vehicles as { listing?: ChannelVehicle[]; product?: ChannelVehicle[] | null } | null;
  const loaded = mergeLoaded(stored?.listing ?? [], stored?.product ?? null);
  const audit = row.audit as StoredAudit | null;
  // Cada vehículo se marca por lo que dijo la revisión: por su código del catálogo, o por su nombre.
  const keyOf = (v: { vehicleId: string | null; name: string }) => v.vehicleId ?? `n:${norm(v.name)}`;
  const marks = new Map<string, { mark: VehicleMark; reason: string }>();
  for (const x of audit?.extra ?? []) marks.set(keyOf(x.vehicle), { mark: 'extra', reason: x.reason });
  for (const x of audit?.review ?? []) marks.set(keyOf(x.vehicle), { mark: 'review', reason: x.reason });
  const own = loaded.filter((v) => !v.byChannel);
  const rows = own.map((v) => {
    const m = marks.get(keyOf(v));
    return { name: v.name, mark: m?.mark ?? ('covered' as const), reason: m?.reason ?? null };
  });
  const extraBrands = new Set((audit?.extraByChannel ?? []).map((x) => norm(x.vehicle.name)));
  const toPush = pub.externalId ? await listCompatibilitiesToPush(db as PrismaClient, accountId, { publicationIds: [pub.id] }) : [];
  return {
    ...base,
    readAt: row.readAt,
    needed: row.needed,
    loaded: own.length,
    covered: rows.filter((r) => r.mark === 'covered').length,
    extra: rows.filter((r) => r.mark === 'extra').length,
    review: rows.filter((r) => r.mark === 'review').length,
    models: groupByModel(rows),
    byChannel: loaded.filter((v) => v.byChannel).map((v) => ({ brand: v.name, count: v.total, extra: extraBrands.has(norm(v.name)) })),
    missing: (audit?.missing ?? []).map((g) => g.label),
    incomplete: (audit?.incomplete ?? []).map((x) => x.label),
    lines: (audit?.lines ?? []).map((l) => ({ line: l.linea, ok: l.estado === 'traducida', reason: l.motivo ?? null, groups: l.grupos })),
    toPush,
  };
}

/** Lo que necesita la pantalla, con la fecha ya escrita en la zona horaria de la cuenta. */
export function loadedCompatibilitiesData(view: CompatibilityView, timeZone: string): LoadedCompatibilitiesData {
  const { readAt, toPush: _toPush, ...rest } = view;
  void _toPush;
  return { ...rest, readAtText: readAt ? formatDateTime(readAt, timeZone) : null };
}
