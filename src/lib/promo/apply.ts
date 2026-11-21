import type { PrismaClient } from '@/generated/prisma/client';
import { ConnectError } from '@/channels/connect';
import { formatPrice } from '@/domain/money';
import type { SlotKind } from '@/domain/promo/plan';
import { CampaignError, sendCampaignNow } from '@/lib/channel-campaigns';
import { pushDrafts, PushError } from '@/lib/channel-push';
import { changeVolumeItems, VolumeError } from '@/lib/volume-campaigns';
import { evaluateProduct, type ItemState } from './plan';
import { loadProductPromo } from './product';
import { loadPromoSettings, PromoError } from './settings';
import { refreshPublications } from './sweep';

// Prender y apagar las ofertas en el canal siguiendo el almanaque, por forma
// de cobro: cada una con su código. Antes de prender se vuelve a sacar la
// rentabilidad con el costo del momento: si ya no deja el piso, no entra. Lo
// que el canal no acepta se reintenta más tarde y, si sigue sin entrar, queda
// como "No se pudo" con el motivo. Todo queda en la bitácora. Recibe la base
// por parámetro para poder probarlo.

type Db = PrismaClient;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Cuántas veces se intenta antes de dejarlo como "No se pudo".
const MAX_ATTEMPTS = 4;

export type DueAction = {
  itemId: string;
  slotId: string;
  productId: string;
  productName: string;
  publicationId: string;
  externalId: string | null;
  // ON: prender; OFF: apagar.
  action: 'ON' | 'OFF';
  kind: SlotKind;
  layer: string;
  name: string;
  price: number | null;
  discountPct: number | null;
  marginPct: number | null;
  capped: boolean;
  stock: number | null;
  attempts: number;
};

export type AppliedAction = DueAction & { ok: boolean; message: string | null; state: ItemState };

type ItemRow = Awaited<ReturnType<typeof loadItems>>[number];

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v.toString()));

function loadItems(db: Db, where: { accountId: string; productIds?: string[]; itemIds?: string[] }) {
  return db.promotionSlotItem.findMany({
    where: {
      ...(where.itemIds ? { id: { in: where.itemIds } } : { state: { in: ['PLANNED', 'SCHEDULED', 'ON'] } }),
      slot: { accountId: where.accountId, ...(where.productIds ? { productId: { in: where.productIds } } : {}) },
    },
    orderBy: [{ slot: { start: 'asc' } }, { id: 'asc' }],
    include: { slot: { include: { product: { select: { name: true } } } }, publication: { select: { externalId: true } } },
  });
}

const actionOf = (i: ItemRow, action: 'ON' | 'OFF'): DueAction => ({
  itemId: i.id,
  slotId: i.slotId,
  productId: i.slot.productId,
  productName: i.slot.product.name,
  publicationId: i.publicationId,
  externalId: i.publication.externalId,
  action,
  kind: i.slot.kind as SlotKind,
  layer: i.slot.layer,
  name: i.slot.name,
  price: num(i.price),
  discountPct: num(i.discountPct),
  marginPct: num(i.marginPct),
  capped: i.capped,
  stock: i.stock,
  attempts: i.attempts,
});

/**
 * Lo que toca hacer ahora: qué se prende y qué se apaga. force: las elegidas
 * que están por entrar van aunque todavía no sea su fecha.
 */
export async function dueActions(
  db: Db,
  args: { accountId: string; productIds?: string[]; itemIds?: string[]; force?: boolean; joinLeadDays: number; now?: Date },
): Promise<DueAction[]> {
  const now = args.now ?? new Date();
  const items = await loadItems(db, args);
  const deadlines = new Map<string, Date>();
  const groups = [...new Set(items.filter((i) => i.slot.group && i.state === 'PLANNED').map((i) => i.slot.group!))];
  if (groups.length > 0) {
    const rows = await db.channelPromotionItem.findMany({ where: { group: { in: groups }, publicationId: { in: items.map((i) => i.publicationId) }, deadline: { not: null } }, select: { publicationId: true, group: true, deadline: true } });
    for (const r of rows) deadlines.set(`${r.publicationId}:${r.group}`, r.deadline!);
  }
  const out: DueAction[] = [];
  // El descuento propio que le toca ahora a cada publicación: si empieza uno, el que termina no hace falta apagarlo.
  const ownStarting = new Set(items.filter((i) => i.slot.kind === 'OWN_DISCOUNT' && i.state === 'PLANNED' && !i.slot.cancelled && i.slot.start <= now && i.slot.finish > now).map((i) => i.publicationId));
  for (const i of items) {
    const s = i.slot;
    if (i.state === 'PLANNED') {
      if (s.cancelled || s.finish <= now) continue;
      if (i.nextTryAt && i.nextTryAt > now && !args.force) continue;
      let from = s.start;
      if (s.kind !== 'OWN_DISCOUNT') {
        // A una campaña se entra unos días antes de que empiece, o antes de que venza la invitación.
        from = new Date(s.start.getTime() - args.joinLeadDays * DAY);
        const deadline = s.group ? deadlines.get(`${i.publicationId}:${s.group}`) : undefined;
        if (deadline && deadline.getTime() - DAY < from.getTime()) from = new Date(deadline.getTime() - DAY);
      }
      if (args.force || from <= now) out.push(actionOf(i, 'ON'));
    } else if ((i.state === 'ON' || i.state === 'SCHEDULED') && s.finish <= now) {
      // Una campaña del canal termina sola; el descuento propio y el por cantidad hay que sacarlos.
      if (s.kind === 'CAMPAIGN' || (s.kind === 'OWN_DISCOUNT' && ownStarting.has(i.publicationId))) continue;
      out.push(actionOf(i, 'OFF'));
    }
  }
  // Primero los picos: duran horas y son lo que más apura.
  const rank = (a: DueAction) => (a.layer === 'PEAK' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

async function log(db: Db, args: { accountId: string; publicationId: string; slotItemId: string; kind: 'ON' | 'OFF' | 'SKIP' | 'ERROR'; text: string; auto: boolean; userId: string | null; data?: object }) {
  await db.promotionLog.create({ data: { accountId: args.accountId, publicationId: args.publicationId, slotItemId: args.slotItemId, kind: args.kind, text: args.text, auto: args.auto, userId: args.userId, data: args.data } });
}

const pctText = (n: number | null) => (n === null ? '' : `${n.toLocaleString('es-AR')} %`);

/** Sube el descuento propio de una publicación: 0 lo saca. Devuelve el motivo si el canal no lo aceptó. */
async function pushOwnDiscount(db: Db, args: { accountId: string; publicationId: string; pct: number; userId: string | null; now: Date }): Promise<string | null> {
  const before = await db.publication.findUniqueOrThrow({ where: { id: args.publicationId }, select: { discount: true } });
  await db.publication.update({ where: { id: args.publicationId }, data: { discount: args.pct } });
  const undo = () => db.publication.update({ where: { id: args.publicationId }, data: { discount: before.discount } });
  try {
    const r = await pushDrafts(db, { accountId: args.accountId, publicationId: args.publicationId, fields: ['discount'], campaigns: false, sku: false, userId: args.userId, now: args.now });
    const rejected = r.rejected.find((x) => x.field === 'discount');
    if (rejected) {
      // Lo que no entró no queda dando vueltas en Por subir.
      await undo();
      return rejected.message;
    }
    return null;
  } catch (e) {
    await undo();
    if (e instanceof PushError || e instanceof ConnectError) return e.message;
    throw e;
  }
}

/** Manda una acción al canal. Devuelve el motivo si no se pudo. */
async function send(db: Db, a: DueAction, item: ItemRow, ctx: { accountId: string; userId: string | null; now: Date }): Promise<string | null> {
  try {
    if (a.kind === 'OWN_DISCOUNT') return await pushOwnDiscount(db, { ...ctx, publicationId: a.publicationId, pct: a.action === 'ON' ? (a.discountPct ?? 0) : 0 });
    if (a.kind === 'VOLUME') {
      const campaignId = (item.slot.group ?? '').split(':').slice(1).join(':');
      const r = await changeVolumeItems(db, { accountId: ctx.accountId, campaignId, publicationIds: [a.publicationId], join: a.action === 'ON', userId: ctx.userId });
      return r.failed[0]?.message ?? null;
    }
    if (!item.ref) return 'No se reconoce la campaña: hay que volver a leer las invitaciones del canal.';
    const r = await sendCampaignNow(db, {
      accountId: ctx.accountId,
      publicationId: a.publicationId,
      choice: { action: a.action === 'ON' ? 'join' : 'leave', ref: item.ref, name: a.name, kind: 'Campaña', price: a.price, stock: a.stock },
      userId: ctx.userId,
    });
    return r.ok ? null : r.error;
  } catch (e) {
    if (e instanceof CampaignError || e instanceof VolumeError || e instanceof ConnectError || e instanceof PushError) return e.message;
    throw e;
  }
}

export type ApplyResult = { done: AppliedAction[]; pending: number; skipped: { itemId: string; publicationId: string; externalId: string | null; name: string; why: string }[] };

/**
 * Hace lo que toca ahora, hasta budgetMs. auto: lo hace la app sola (queda
 * así en la bitácora). Antes de prender vuelve a decidir con el costo y las
 * invitaciones del momento.
 */
export async function applyDue(
  db: Db,
  args: { accountId: string; productIds?: string[]; itemIds?: string[]; force?: boolean; auto: boolean; userId: string | null; budgetMs: number; now?: Date },
): Promise<ApplyResult> {
  const now = args.now ?? new Date();
  const started = Date.now();
  const settings = await loadPromoSettings(db, args.accountId);
  const due = await dueActions(db, { ...args, joinLeadDays: settings.rules.timing.joinLeadDays, now });
  const result: ApplyResult = { done: [], pending: 0, skipped: [] };
  const ctx = { accountId: args.accountId, userId: args.userId, now };
  const fresh = new Set<string>();
  for (const [index, a] of due.entries()) {
    if (Date.now() - started > args.budgetMs) {
      result.pending = due.length - index;
      break;
    }
    if (a.action === 'ON' && !fresh.has(a.productId)) {
      fresh.add(a.productId);
      const promo = await loadProductPromo(db, args.accountId, a.productId);
      if (promo) {
        // Un intento anterior que quedó dudoso: se relee del canal por si entró.
        const retry = due.filter((d) => d.productId === a.productId && d.attempts > 0).map((d) => d.publicationId);
        if (retry.length > 0) await refreshPublications(db, { accountId: args.accountId, publicationIds: retry, now }).catch(() => null);
        const again = retry.length > 0 ? ((await loadProductPromo(db, args.accountId, a.productId)) ?? promo) : promo;
        await evaluateProduct(db, { promo: again, settings, now });
      }
    }
    const item = (await loadItems(db, { accountId: args.accountId, itemIds: [a.itemId] }))[0];
    if (!item) continue;
    const act = actionOf(item, a.action);
    if (a.action === 'ON' && item.state !== 'PLANNED') {
      // Al volver a mirar, quedó afuera o ya está en el canal.
      const inside = item.state === 'ON' || item.state === 'SCHEDULED';
      const why = inside ? 'Ya está en el canal.' : (item.reasonText ?? 'Al volver a mirar, quedó afuera.');
      result.skipped.push({ itemId: a.itemId, publicationId: a.publicationId, externalId: a.externalId, name: a.name, why });
      if (!inside) await log(db, { ...ctx, publicationId: a.publicationId, slotItemId: a.itemId, kind: 'SKIP', text: `${a.name}: no se prendió. ${why}`, auto: args.auto });
      continue;
    }
    const error = await send(db, act, item, ctx);
    const what = act.kind === 'OWN_DISCOUNT' ? `descuento propio de ${pctText(act.discountPct)}` : act.name;
    if (error === null) {
      const state: ItemState = act.action === 'OFF' ? 'ENDED' : act.kind === 'OWN_DISCOUNT' || item.slot.start <= now ? 'ON' : 'SCHEDULED';
      const from = item.slot.start > now ? item.slot.start : now;
      await db.promotionSlotItem.update({
        where: { id: item.id },
        data: act.action === 'ON' ? { state, appliedAt: now, attempts: item.attempts + 1, lastError: null, nextTryAt: null, measureAt: new Date(from.getTime() + settings.rules.timing.measureDays * DAY) } : { state, endedAt: now, lastError: null, nextTryAt: null },
      });
      const detail = act.action === 'ON' ? `${act.price !== null ? `, el comprador paga ${formatPrice(act.price)}` : ''}${act.marginPct !== null ? `, deja ${pctText(act.marginPct)}` : ''}${act.capped ? ', al tope del canal' : ''}` : '';
      await log(db, { ...ctx, publicationId: act.publicationId, slotItemId: item.id, kind: act.action, text: `${act.action === 'ON' ? 'Se prendió' : 'Se apagó'} ${what}${detail}.`, auto: args.auto, data: { price: act.price, discountPct: act.discountPct, marginPct: act.marginPct, capped: act.capped } });
      result.done.push({ ...act, ok: true, message: null, state });
      continue;
    }
    const attempts = item.attempts + 1;
    const gaveUp = act.action === 'ON' && attempts >= MAX_ATTEMPTS;
    await db.promotionSlotItem.update({
      where: { id: item.id },
      data: {
        attempts,
        lastError: error,
        // Se reintenta en 1, 2 y 4 horas.
        nextTryAt: gaveUp ? null : new Date(now.getTime() + Math.min(2 ** (attempts - 1), 12) * HOUR),
        ...(gaveUp ? { state: 'FAILED', reason: 'REJECTED', reasonText: error } : {}),
      },
    });
    await log(db, { ...ctx, publicationId: act.publicationId, slotItemId: item.id, kind: 'ERROR', text: `No se pudo ${act.action === 'ON' ? 'prender' : 'apagar'} ${what}: ${error}${gaveUp ? ' No se intenta más.' : ' Se vuelve a intentar.'}`, auto: args.auto });
    result.done.push({ ...act, ok: false, message: error, state: gaveUp ? 'FAILED' : (item.state as ItemState) });
  }
  // Las campañas del canal que ya terminaron quedan como terminadas, sin tocar el canal.
  await db.promotionSlotItem.updateMany({ where: { state: { in: ['ON', 'SCHEDULED'] }, slot: { accountId: args.accountId, kind: 'CAMPAIGN', finish: { lte: now } } }, data: { state: 'ENDED', endedAt: now } });
  // Las que nunca llegaron a entrar y ya pasó la fecha.
  await db.promotionSlotItem.updateMany({ where: { state: 'PLANNED', slot: { accountId: args.accountId, finish: { lte: now } } }, data: { state: 'OUT', reason: 'REJECTED', reasonText: 'Pasó la fecha sin que se prendiera.' } });
  return result;
}

/**
 * Saca a mano unas formas de cobro de una franja: si ya están en el canal,
 * las saca de ahí; si estaban por entrar, no entran. Quedan como sacadas a
 * mano y el almanaque no las vuelve a meter.
 */
export async function takeOut(db: Db, args: { accountId: string; itemIds: string[]; why?: string | null; userId: string | null; now?: Date }): Promise<AppliedAction[]> {
  const now = args.now ?? new Date();
  const items = await loadItems(db, { accountId: args.accountId, itemIds: args.itemIds });
  const out: AppliedAction[] = [];
  const text = args.why?.trim() ? `Sacada a mano: ${args.why.trim().slice(0, 200)}` : 'Sacada a mano.';
  for (const item of items) {
    const act = actionOf(item, 'OFF');
    const inChannel = item.state === 'ON' || item.state === 'SCHEDULED';
    const error = inChannel ? await send(db, act, item, { accountId: args.accountId, userId: args.userId, now }) : null;
    if (error !== null) {
      await log(db, { accountId: args.accountId, publicationId: item.publicationId, slotItemId: item.id, kind: 'ERROR', text: `No se pudo sacar de ${act.name}: ${error}`, auto: false, userId: args.userId });
      out.push({ ...act, ok: false, message: error, state: item.state as ItemState });
      continue;
    }
    await db.promotionSlotItem.update({ where: { id: item.id }, data: { state: 'OUT', reason: 'MANUAL', reasonText: text, endedAt: inChannel ? now : null, nextTryAt: null } });
    await log(db, { accountId: args.accountId, publicationId: item.publicationId, slotItemId: item.id, kind: 'OFF', text: `${inChannel ? 'Se sacó' : 'No va a entrar'}: ${act.name}. ${text}`, auto: false, userId: args.userId });
    out.push({ ...act, ok: true, message: null, state: 'OUT' });
  }
  return out;
}

/** Deshace lo sacado a mano o lo que no se pudo: vuelve a decidirse con las reglas. */
export async function putBack(db: Db, args: { accountId: string; itemIds: string[]; now?: Date }): Promise<number> {
  const now = args.now ?? new Date();
  const items = await loadItems(db, { accountId: args.accountId, itemIds: args.itemIds });
  const back = items.filter((i) => i.state === 'FAILED' || (i.state === 'OUT' && (i.reason === 'MANUAL' || i.reason === 'REJECTED')));
  if (back.length === 0) return 0;
  await db.promotionSlotItem.updateMany({ where: { id: { in: back.map((i) => i.id) } }, data: { state: 'OUT', reason: null, reasonText: null, attempts: 0, lastError: null, nextTryAt: null, appliedAt: null, endedAt: null } });
  const settings = await loadPromoSettings(db, args.accountId);
  for (const productId of new Set(back.map((i) => i.slot.productId))) {
    const promo = await loadProductPromo(db, args.accountId, productId);
    if (!promo) throw new PromoError('El producto no es de esta cuenta.');
    await evaluateProduct(db, { promo, settings, now });
  }
  return back.length;
}
