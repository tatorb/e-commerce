import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getPromotionSweep, type ChannelPromotionSweep, type SellerPromotion, type SweepItem } from '@/channels/promotion-sweep';
import type { ChannelCampaign } from '@/channels/publish-types';
import { ConnectError } from '@/channels/connect';
import { withAccessToken } from '@/lib/connections';
import { readPromotions } from '@/lib/channel-promotions';
import { PromoError } from './settings';

// La copia de las invitaciones del canal: qué campañas tiene cada publicación,
// si la invitan, si está anotada o adentro, y entre qué precios entra. Se lee
// la cuenta entera, campaña por campaña y de a páginas, con un tiempo máximo
// por vuelta: si no termina, la vuelta siguiente sigue donde quedó. Al
// terminar una lectura completa, lo que el canal ya no informa se borra.
// Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// El canal vence el "seguir desde acá" a los 5 minutos: pasado eso, la campaña se relee desde el principio.
const CURSOR_TTL_MS = 4 * 60_000;

type SweepState = {
  startedAt?: string;
  promotions?: (Omit<SellerPromotion, 'start' | 'finish' | 'deadline'> & { start: string | null; finish: string | null; deadline: string | null })[];
  index?: number;
  cursor?: string | null;
  cursorAt?: string | null;
  pages?: number;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const back = (s: string | null) => (s ? new Date(s) : null);

/** Lo que se guarda de una campaña para una publicación. */
function rowOf(publicationId: string, type: string, c: ChannelCampaign & { ref: string; group: string }, stock: SweepItem['stock'], deadline: Date | null, seenAt: Date) {
  return {
    publicationId,
    group: c.group,
    ref: c.ref,
    type,
    name: c.name,
    kind: c.kind,
    status: c.status,
    price: c.price,
    channelPct: c.channelPct,
    sellerPct: c.sellerPct,
    start: c.start,
    finish: c.finish,
    deadline,
    join: c.join,
    minPrice: c.range?.minPrice ?? null,
    maxPrice: c.range?.maxPrice ?? null,
    suggestedPrice: c.range?.suggestedPrice ?? null,
    stockMin: stock?.min ?? null,
    stockMax: stock?.max ?? null,
    canLeave: c.canLeave,
    pausesOwnDiscount: c.pausesOwnDiscount,
    listPrice: c.listPrice,
    seenAt,
  };
}

async function store(db: Db, row: ReturnType<typeof rowOf>) {
  const { publicationId, group, ...data } = row;
  await db.channelPromotionItem.upsert({ where: { publicationId_group: { publicationId, group } }, create: row, update: data });
}

/** La tienda de la cuenta que se puede leer entera. */
async function sweepStore(db: Db, accountId: string, sweep?: ChannelPromotionSweep) {
  const stores = await db.store.findMany({
    where: { accountId, connection: { status: 'ACTIVE' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, channel: { select: { kind: true, name: true } } },
  });
  for (const s of stores) {
    const impl = sweep ?? getPromotionSweep(s.channel.kind);
    if (impl) return { id: s.id, channelName: s.channel.name, sweep: impl };
  }
  return null;
}

export type SweepResult = {
  // Si quedó algo por leer: hay que volver a llamar.
  pending: boolean;
  // Lo que se hizo en esta vuelta.
  promotions: number;
  pages: number;
  items: number;
  // Si en esta vuelta terminó una lectura completa.
  finished: boolean;
  error: string | null;
};

/**
 * Una vuelta de la lectura de la cuenta, hasta budgetMs. restart: empieza una
 * lectura nueva aunque haya una a medias.
 */
export async function sweepInvitations(
  db: Db,
  args: { accountId: string; budgetMs: number; restart?: boolean; sweep?: ChannelPromotionSweep; now?: () => Date },
): Promise<SweepResult> {
  const now = args.now ?? (() => new Date());
  const started = Date.now();
  const out: SweepResult = { pending: false, promotions: 0, pages: 0, items: 0, finished: false, error: null };
  const s = await sweepStore(db, args.accountId, args.sweep);
  if (!s) return { ...out, error: 'La cuenta no tiene una tienda conectada a un canal con promociones.' };
  const settings = await db.promotionSettings.upsert({ where: { accountId: args.accountId }, create: { accountId: args.accountId }, update: {}, select: { sweep: true } });
  let state = (settings.sweep && typeof settings.sweep === 'object' && !Array.isArray(settings.sweep) ? settings.sweep : {}) as SweepState;
  const save = (next: SweepState, extra: Prisma.PromotionSettingsUpdateInput = {}) =>
    db.promotionSettings.update({ where: { accountId: args.accountId }, data: { sweep: next as Prisma.InputJsonValue, ...extra } });
  try {
    if (args.restart || !state.promotions) {
      const promotions = await withAccessToken(db, s.id, (token, userId) => s.sweep.promotions(token, userId));
      state = { startedAt: now().toISOString(), promotions: promotions.map((p) => ({ ...p, start: iso(p.start), finish: iso(p.finish), deadline: iso(p.deadline) })), index: 0, cursor: null, cursorAt: null, pages: 0 };
      await save(state);
    }
    const promotions = state.promotions!;
    let index = state.index ?? 0;
    let cursor = state.cursor ?? null;
    // Un "seguir desde acá" vencido: esa campaña se relee desde el principio.
    if (cursor && (!state.cursorAt || now().getTime() - Date.parse(state.cursorAt) > CURSOR_TTL_MS)) cursor = null;
    const codes = new Map<string, string>();
    while (index < promotions.length) {
      if (Date.now() - started > args.budgetMs) {
        out.pending = true;
        break;
      }
      const p = promotions[index];
      const promotion: SellerPromotion = { ...p, start: back(p.start), finish: back(p.finish), deadline: back(p.deadline) };
      const page = await withAccessToken(db, s.id, (token) => s.sweep.items(token, promotion, cursor));
      out.pages++;
      const missing = page.items.map((i) => i.externalId).filter((c) => !codes.has(c));
      if (missing.length > 0) {
        const pubs = await db.publication.findMany({ where: { storeId: s.id, externalId: { in: missing } }, select: { id: true, externalId: true } });
        for (const pub of pubs) codes.set(pub.externalId!, pub.id);
      }
      const seenAt = now();
      for (const item of page.items) {
        const publicationId = codes.get(item.externalId);
        // Una publicación del canal que la app no tiene: no hay dónde guardarla.
        if (!publicationId) continue;
        await store(db, rowOf(publicationId, item.type, item.campaign, item.stock, item.deadline, seenAt));
        out.items++;
      }
      cursor = page.next;
      if (!cursor) {
        index++;
        out.promotions++;
      }
      state = { ...state, index, cursor, cursorAt: cursor ? now().toISOString() : null, pages: (state.pages ?? 0) + 1 };
      await save(state);
    }
    if (index >= promotions.length) {
      // Lectura completa: lo que el canal ya no informa desde que empezó, se va.
      const since = new Date(state.startedAt!);
      await db.channelPromotionItem.deleteMany({ where: { seenAt: { lt: since }, publication: { storeId: s.id } } });
      await save({}, { sweptAt: now() });
      out.finished = true;
    }
  } catch (e) {
    if (!(e instanceof ConnectError)) throw e;
    out.error = e.message;
    out.pending = true;
  }
  return out;
}

/**
 * Relee del canal las promociones de unas publicaciones y actualiza su copia:
 * para ver un producto al día sin esperar la lectura de toda la cuenta.
 */
export async function refreshPublications(db: Db, args: { accountId: string; publicationIds: string[]; now?: Date }): Promise<{ read: number; unpublished: number }> {
  const now = args.now ?? new Date();
  if (args.publicationIds.length === 0) return { read: 0, unpublished: 0 };
  const r = await readPromotions(db, { accountId: args.accountId, publicationIds: args.publicationIds });
  if (!r.ok) throw new PromoError(r.error);
  for (const row of r.read) {
    const seen: string[] = [];
    for (const c of row.promotions.campaigns) {
      if (!c.ref || !c.group) continue;
      const type = c.group.split(':')[0];
      const prev = await db.channelPromotionItem.findUnique({ where: { publicationId_group: { publicationId: row.publicationId, group: c.group } }, select: { join: true, stockMin: true, stockMax: true, minPrice: true, maxPrice: true, suggestedPrice: true, deadline: true } });
      // La lectura por publicación no trae las unidades de una relámpago ni cómo se suma a un pico: se conserva lo que dejó la lectura de la cuenta.
      const keepJoin = c.join === null && c.status === 'invited' && prev?.join ? prev.join : c.join;
      const range = c.range ?? (prev && (prev.minPrice !== null || prev.maxPrice !== null) ? { minPrice: prev.minPrice === null ? null : Number(prev.minPrice), maxPrice: prev.maxPrice === null ? null : Number(prev.maxPrice), suggestedPrice: prev.suggestedPrice === null ? null : Number(prev.suggestedPrice) } : null);
      await store(db, rowOf(row.publicationId, type, { ...c, ref: c.ref, group: c.group, join: keepJoin as ChannelCampaign['join'], range }, prev ? { min: prev.stockMin, max: prev.stockMax } : null, prev?.deadline ?? null, now));
      seen.push(c.group);
    }
    await db.channelPromotionItem.deleteMany({ where: { publicationId: row.publicationId, group: { notIn: seen } } });
  }
  return { read: r.read.length, unpublished: r.unpublished };
}
