import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { decideCampaign, decideOwnDiscount, decideVolume, marginAt, type Decision, type OutReason } from '@/domain/promo/entry';
import { diffSlots, planSlots, type CalendarEvent, type ChannelCampaignInfo, type EventTier, type ExistingSlot, type Layer, type PlannedSlot, type SlotKind } from '@/domain/promo/plan';
import { unitsLast90 } from '@/lib/sales/units';
import { loadProductPromo, type ProductPromo, type PromoOption, type StoredCampaign } from './product';
import { loadPromoSettings, PromoError, type PromoSettings } from './settings';

// El almanaque de un producto en la base: arma las franjas de hoy en adelante
// con sus etiquetas, el calendario y las invitaciones del canal, y decide para
// cada forma de cobro si entra, a qué precio y con qué rentabilidad. Lo que ya
// empezó o se hizo en el canal no se toca. No sube nada: eso es de apply.ts.
// Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export const ITEM_STATES = ['PLANNED', 'SCHEDULED', 'ON', 'ENDED', 'OUT', 'FAILED'] as const;
export type ItemState = (typeof ITEM_STATES)[number];
export const ITEM_STATE_LABEL: Record<ItemState, string> = {
  PLANNED: 'Por entrar',
  SCHEDULED: 'Anotada',
  ON: 'Adentro',
  ENDED: 'Terminó',
  OUT: 'Afuera',
  FAILED: 'No se pudo',
};

const DAY = 86_400_000;

/** El primer momento del día en la hora de la cuenta. */
export function startOfDay(now: Date, timeZone: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const elapsed = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - elapsed);
}

export async function loadEvents(db: Db, accountId: string, from: Date): Promise<CalendarEvent[]> {
  const rows = await db.promotionEvent.findMany({ where: { accountId, finish: { gt: from } }, orderBy: { start: 'asc' } });
  return rows.map((e) => ({ id: e.id, name: e.name, tier: e.tier as EventTier, start: e.start, finish: e.finish, match: e.match }));
}

/** Las campañas del canal que tocan a alguna forma de cobro del producto, una vez cada una. */
export function campaignInfos(campaigns: StoredCampaign[]): ChannelCampaignInfo[] {
  const byGroup = new Map<string, ChannelCampaignInfo>();
  for (const c of campaigns) {
    const prev = byGroup.get(c.group);
    if (!prev) byGroup.set(c.group, { group: c.group, type: c.type, name: c.name, start: c.start, finish: c.finish });
    else {
      // En una relámpago cada publicación tiene su horario: la franja va de la primera a la última.
      if (c.start && (!prev.start || c.start < prev.start)) prev.start = c.start;
      if (c.finish && (!prev.finish || c.finish > prev.finish)) prev.finish = c.finish;
    }
  }
  return [...byGroup.values()];
}

/** Lo que deja igualar al competidor más barato y lo que deja hoy el precio publicado, medido en la forma sin cuotas. */
export function competitorMargins(promo: ProductPromo): { competitorMarginPct: number | null; listMarginPct: number | null } {
  const flat = promo.options.find((o) => o.plan === 0 && o.eco.cost !== null && o.eco.listPrice !== null);
  if (!flat) return { competitorMarginPct: null, listMarginPct: null };
  return {
    competitorMarginPct: promo.competitor ? marginAt(flat.eco, promo.competitor.price) : null,
    listMarginPct: marginAt(flat.eco, flat.eco.listPrice!),
  };
}

type SlotRow = Prisma.PromotionSlotGetPayload<{ include: { items: true } }>;

const lockedSlot = (s: SlotRow, now: Date) => s.start.getTime() <= now.getTime() || s.items.some((i) => i.appliedAt !== null);
const existingOf = (s: SlotRow, now: Date): ExistingSlot => ({
  id: s.id,
  layer: s.layer as Layer,
  kind: s.kind as SlotKind,
  group: s.group,
  eventId: s.eventId,
  start: s.start,
  finish: s.finish,
  source: s.source === 'MANUAL' ? 'MANUAL' : 'PLAN',
  cancelled: s.cancelled,
  locked: lockedSlot(s, now),
});

export type ItemDecision = {
  publicationId: string;
  state: ItemState;
  capped: boolean;
  reason: OutReason | null;
  reasonText: string | null;
  price: number | null;
  discountPct: number | null;
  marginPct: number | null;
  ref: string | null;
  stock: number | null;
};

const out = (o: PromoOption, reason: OutReason, text: string): ItemDecision => ({ publicationId: o.publicationId, state: 'OUT', capped: false, reason, reasonText: text, price: null, discountPct: null, marginPct: null, ref: null, stock: null });

/**
 * Qué pasa con una forma de cobro en una franja. Lo decidido a mano va
 * primero; después el control de stock, y recién después la rentabilidad.
 */
export function decideItem(args: {
  slot: { kind: SlotKind; group: string | null; targetMarginPct: number };
  option: PromoOption;
  promo: ProductPromo;
  settings: PromoSettings;
}): ItemDecision {
  const { slot, option: o, promo, settings } = args;
  const invite = slot.group ? (promo.campaigns.find((c) => c.group === slot.group && c.publicationId === o.publicationId) ?? null) : null;
  const floor = settings.thresholds.floorMarginPct;
  const done = (d: Decision, extra: { ref?: string | null; stock?: number | null; state?: ItemState } = {}): ItemDecision =>
    d.in
      ? { publicationId: o.publicationId, state: extra.state ?? 'PLANNED', capped: d.capped, reason: null, reasonText: d.note, price: d.price, discountPct: d.discountPct, marginPct: d.marginPct, ref: extra.ref ?? null, stock: extra.stock ?? null }
      : { publicationId: o.publicationId, state: 'OUT', capped: false, reason: d.reason, reasonText: d.text, price: d.price, discountPct: null, marginPct: d.marginPct, ref: extra.ref ?? null, stock: null };
  // Lo que ya está en el canal sigue como está, lo haya hecho quien lo haya hecho.
  if (invite && invite.status !== 'invited') {
    const d = decideCampaign({ eco: o.eco, invite, targetMarginPct: slot.targetMarginPct, floorMarginPct: floor });
    return done(d, { ref: invite.ref, state: invite.status === 'active' ? 'ON' : 'SCHEDULED' });
  }
  if (o.excluded) return out(o, 'FORBIDDEN', o.excludedWhy ? `Decidido a mano que no entra: ${o.excludedWhy}` : 'Decidido a mano que no entra a ninguna oferta.');
  if (!o.externalId) return out(o, 'NOT_PUBLISHED', `Todavía no está publicada en ${promo.channelName}.`);
  if (o.held) return out(o, 'UNDER_REVIEW', `${promo.channelName} la está revisando o la frenó: no se le puede subir nada.`);
  if (o.status !== 'ACTIVE' && o.status !== 'PAUSED') return out(o, 'NOT_PUBLISHED', `No está activa en ${promo.channelName}.`);
  // Control de stock: con poco stock no se abre una oferta nueva.
  const stockMin = settings.rules.timing.stockMin;
  if (promo.tags.stockControl && o.stock !== null && o.stock <= stockMin) {
    return out(o, 'LOW_STOCK', `Tiene control de stock y quedan ${o.stock}: con ${stockMin} o menos no se abren ofertas nuevas.`);
  }
  if (slot.kind === 'OWN_DISCOUNT') return done(decideOwnDiscount({ eco: o.eco, targetMarginPct: slot.targetMarginPct, floorMarginPct: floor }));
  if (slot.kind === 'VOLUME') {
    if (!invite) return out(o, 'NOT_INVITED', 'El canal no la tiene como candidata en esta campaña por cantidad.');
    if (invite.sellerPct === null && invite.channelPct === null) return out(o, 'CHANNEL_ONLY', 'El canal no informa cuánto descuento lleva cada unidad en esta campaña.');
    return done(decideVolume({ eco: o.eco, effectivePct: (invite.sellerPct ?? 0) + (invite.channelPct ?? 0), channelPct: invite.channelPct, floorMarginPct: floor, targetMarginPct: slot.targetMarginPct }), { ref: invite.ref });
  }
  const d = decideCampaign({ eco: o.eco, invite, targetMarginPct: slot.targetMarginPct, floorMarginPct: floor });
  if (d.in && invite?.type === 'LIGHTNING') {
    // La relámpago reserva unidades: va lo mínimo que pide el canal, y solo si están.
    const reserve = invite.stockMin ?? 1;
    if (o.stock !== null && o.stock < reserve) return out(o, 'LOW_STOCK', `La oferta relámpago pide reservar ${reserve} y quedan ${o.stock}.`);
    return done(d, { ref: invite.ref, stock: reserve });
  }
  return done(d, { ref: invite?.ref ?? null });
}

/** Guarda lo decidido para cada forma de cobro de una franja. Lo que ya se hizo en el canal o se sacó a mano no se pisa. */
export async function evaluateSlot(db: Db, args: { slot: SlotRow; promo: ProductPromo; settings: PromoSettings; now: Date; redecide?: boolean }): Promise<void> {
  const { slot, promo, settings, now } = args;
  // Una franja armada a mano lleva las publicaciones y los precios que eligió la persona: no se vuelve a decidir
  // con las reglas. Solo se mira si el canal ya la muestra adentro o anotada.
  if (!(args.redecide ?? slot.source !== 'MANUAL')) {
    for (const item of slot.items) {
      if (!slot.group || item.state === 'ENDED' || item.state === 'OUT') continue;
      const invite = promo.campaigns.find((c) => c.group === slot.group && c.publicationId === item.publicationId);
      if (!invite) continue;
      const state: ItemState | null = invite.status === 'active' ? 'ON' : invite.status === 'scheduled' ? 'SCHEDULED' : null;
      if (state === null) {
        // Sigue invitada: se guarda cómo pedirla, que puede haber cambiado.
        if (item.ref !== invite.ref) await db.promotionSlotItem.update({ where: { id: item.id }, data: { ref: invite.ref } });
        continue;
      }
      if (item.state === state && item.ref === invite.ref) continue;
      await db.promotionSlotItem.update({
        where: { id: item.id },
        data: { state, ref: invite.ref, lastError: null, nextTryAt: null, ...(item.appliedAt ? {} : { appliedAt: now, measureAt: new Date(now.getTime() + settings.rules.timing.measureDays * DAY) }) },
      });
    }
    return;
  }
  for (const o of promo.options) {
    // Una finalizada o eliminada no lleva casillero.
    if (o.status === 'CLOSED' || o.status === 'DELETED') continue;
    const prev = slot.items.find((i) => i.publicationId === o.publicationId);
    if (prev && (prev.state === 'ENDED' || prev.reason === 'MANUAL')) continue;
    const d = decideItem({ slot: { kind: slot.kind as SlotKind, group: slot.group, targetMarginPct: Number(slot.targetMarginPct) }, option: o, promo, settings });
    // Lo que la app ya mandó sigue como quedó, salvo que el canal ya lo muestre adentro o anotado.
    const applied = prev?.appliedAt != null;
    if (applied && d.state !== 'ON' && d.state !== 'SCHEDULED') continue;
    // Un intento que falló se vuelve a pensar solo si ahora queda afuera.
    if (prev?.state === 'FAILED' && d.state === 'PLANNED') continue;
    const inChannel = d.state === 'ON' || d.state === 'SCHEDULED';
    const data = {
      state: d.state,
      capped: d.capped,
      reason: d.reason,
      reasonText: d.reasonText,
      price: d.price,
      discountPct: d.discountPct,
      marginPct: d.marginPct,
      ref: d.ref,
      stock: d.stock,
      // Si ya estaba en el canal sin que la app lo mandara, cuenta desde que se vio.
      ...(inChannel && !applied ? { appliedAt: now, measureAt: new Date(now.getTime() + settings.rules.timing.measureDays * DAY) } : {}),
    };
    if (prev) await db.promotionSlotItem.update({ where: { id: prev.id }, data });
    else await db.promotionSlotItem.create({ data: { slotId: slot.id, publicationId: o.publicationId, ...data } });
  }
}

export type PlanResult = {
  productId: string;
  name: string;
  // Sin ciclo de vida no hay almanaque.
  skipped: string | null;
  created: number;
  updated: number;
  removed: number;
  slots: number;
};

/**
 * Arma o rearma el almanaque de un producto, de hoy en adelante, y decide
 * cada forma de cobro en cada franja vigente. preview: solo cuenta lo que
 * cambiaría, sin guardar.
 */
export async function generatePlan(db: Db, args: { accountId: string; productId: string; now?: Date; preview?: boolean }): Promise<PlanResult> {
  const now = args.now ?? new Date();
  const account = await db.account.findUnique({ where: { id: args.accountId }, select: { timezone: true } });
  if (!account) throw new PromoError('La cuenta no existe.');
  const promo = await loadProductPromo(db, args.accountId, args.productId);
  if (!promo) throw new PromoError('El producto no es de esta cuenta.');
  const settings = await loadPromoSettings(db, args.accountId);
  const today = startOfDay(now, account.timezone);
  const result: PlanResult = { productId: promo.productId, name: promo.name, skipped: null, created: 0, updated: 0, removed: 0, slots: 0 };
  const rows = await db.promotionSlot.findMany({ where: { productId: promo.productId, finish: { gt: now } }, include: { items: true } });
  const existing = rows.map((s) => existingOf(s, now));
  let planned: PlannedSlot[] = [];
  if (promo.mode !== 'AUTO') result.skipped = 'Está en Manual: su almanaque lo arma una persona. Para que lo armen las reglas, pasalo a Automático.';
  else if (promo.tags.lifecycle === null) result.skipped = 'Todavía no tiene ciclo de vida: sin esa etiqueta no se arma el almanaque.';
  else if (promo.options.length === 0) result.skipped = 'No tiene publicaciones en el canal.';
  else {
    const sold = await unitsLast90(db, promo.options.map((o) => o.publicationId), now);
    planned = planSlots({
      today,
      tags: promo.tags,
      rules: settings.rules,
      thresholds: settings.thresholds,
      events: await loadEvents(db, args.accountId, today),
      campaigns: campaignInfos(promo.campaigns),
      hasSales: [...sold.values()].some((n) => n > 0),
      ...competitorMargins(promo),
      existing,
    });
  }
  // En Manual el almanaque es de la persona: rearmar no crea ni saca nada.
  if (promo.mode !== 'AUTO') return result;
  const diff = diffSlots(existing, planned);
  result.created = diff.create.length;
  result.removed = diff.remove.length;
  result.updated = diff.update.filter((u) => {
    const old = rows.find((r) => r.id === u.id)!;
    return old.start.getTime() !== u.slot.start.getTime() || old.finish.getTime() !== u.slot.finish.getTime() || Number(old.targetMarginPct) !== u.slot.targetMarginPct || old.name !== u.slot.name;
  }).length;
  result.slots = existing.length - diff.remove.length + diff.create.length;
  if (args.preview) return result;

  if (diff.remove.length > 0) await db.promotionSlot.deleteMany({ where: { id: { in: diff.remove } } });
  const fields = (s: PlannedSlot) => ({ layer: s.layer, kind: s.kind, group: s.group, name: s.name, eventId: s.eventId, start: s.start, finish: s.finish, targetMarginPct: s.targetMarginPct });
  for (const u of diff.update) await db.promotionSlot.update({ where: { id: u.id }, data: fields(u.slot) });
  for (const s of diff.create) await db.promotionSlot.create({ data: { accountId: args.accountId, productId: promo.productId, ...fields(s) } });
  await db.productPromotion.upsert({ where: { productId: promo.productId }, create: { productId: promo.productId, plannedAt: now }, update: { plannedAt: now } });
  await evaluateProduct(db, { promo, settings, now });
  return result;
}

/** Vuelve a decidir cada forma de cobro en las franjas vigentes de un producto, con el costo y las invitaciones de ahora. */
export async function evaluateProduct(db: Db, args: { promo: ProductPromo; settings: PromoSettings; now: Date }): Promise<void> {
  // Las reservas que ya tienen su campaña en el canal pasan a ser de esa campaña.
  const { bindReservations } = await import('./enroll');
  await bindReservations(db, { accountId: args.promo.accountId, promo: args.promo, now: args.now });
  const slots = await db.promotionSlot.findMany({ where: { productId: args.promo.productId, cancelled: false, finish: { gt: args.now } }, include: { items: true } });
  for (const slot of slots) await evaluateSlot(db, { slot, ...args });
}
