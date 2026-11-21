import type { PrismaClient } from '@/generated/prisma/client';
import { EVENT_TIERS, LAYERS, SLOT_KINDS, layerOfType, type EventTier, type Layer, type SlotKind } from '@/domain/promo/plan';
import { takeOut, type AppliedAction } from './apply';
import { evaluateProduct } from './plan';
import { loadProductPromo } from './product';
import { loadPromoSettings, PromoError } from './settings';

// Lo que se hace a mano y el almanaque respeta: el calendario de eventos, y
// las franjas que una persona pone, cambia o decide que no van. Recibe la
// base por parámetro para poder probarlo.

type Db = PrismaClient;

// ───────────────────────────── El calendario de eventos ─────────────────────────────

export type EventInput = { id?: string; name: string; tier: EventTier; start: Date; finish: Date; match?: string | null; notes?: string | null };

export async function listEvents(db: Db, accountId: string, opts: { from?: Date } = {}) {
  return db.promotionEvent.findMany({ where: { accountId, ...(opts.from ? { finish: { gt: opts.from } } : {}) }, orderBy: { start: 'asc' } });
}

/** Crea un evento o cambia uno que ya está. */
export async function saveEvent(db: Db, accountId: string, input: EventInput) {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new PromoError('Falta el nombre del evento.');
  if (!EVENT_TIERS.includes(input.tier)) throw new PromoError('No se reconoce el tipo de evento.');
  if (Number.isNaN(input.start.getTime()) || Number.isNaN(input.finish.getTime())) throw new PromoError('Revisá las fechas del evento.');
  if (input.finish <= input.start) throw new PromoError('El evento tiene que terminar después de empezar.');
  const data = { name, tier: input.tier, start: input.start, finish: input.finish, match: input.match?.trim().slice(0, 120) || null, notes: input.notes?.trim().slice(0, 500) || null };
  if (input.id) {
    const r = await db.promotionEvent.updateMany({ where: { id: input.id, accountId }, data });
    if (r.count === 0) throw new PromoError('Ese evento ya no está en el calendario.');
    return db.promotionEvent.findUniqueOrThrow({ where: { id: input.id } });
  }
  return db.promotionEvent.create({ data: { accountId, ...data } });
}

export async function deleteEvent(db: Db, accountId: string, id: string): Promise<void> {
  const r = await db.promotionEvent.deleteMany({ where: { id, accountId } });
  if (r.count === 0) throw new PromoError('Ese evento ya no está en el calendario.');
}

// ───────────────────────────── Las franjas a mano ─────────────────────────────

export type ManualSlotInput = {
  productId: string;
  // Para cambiar una franja que ya está.
  slotId?: string;
  // La campaña del canal, para una franja de una campaña.
  group?: string | null;
  layer?: Layer;
  kind?: SlotKind;
  name?: string;
  start?: Date;
  finish?: Date;
  targetMarginPct?: number;
  note?: string | null;
};

/**
 * Pone una franja a mano o cambia una que ya está, que pasa a ser a mano: el
 * almanaque no la vuelve a tocar. Después decide cada forma de cobro.
 */
export async function saveManualSlot(db: Db, args: { accountId: string; input: ManualSlotInput; now?: Date }): Promise<string> {
  const now = args.now ?? new Date();
  const { input } = args;
  const promo = await loadProductPromo(db, args.accountId, input.productId);
  if (!promo) throw new PromoError('El producto no es de esta cuenta.');
  const settings = await loadPromoSettings(db, args.accountId);
  if (input.targetMarginPct !== undefined && !(input.targetMarginPct >= settings.thresholds.floorMarginPct)) {
    throw new PromoError(`La rentabilidad de la franja no puede ser menor que el piso de ${settings.thresholds.floorMarginPct} %.`);
  }
  let id = input.slotId ?? null;
  if (id) {
    const slot = await db.promotionSlot.findFirst({ where: { id, accountId: args.accountId, productId: input.productId }, include: { items: { select: { appliedAt: true } } } });
    if (!slot) throw new PromoError('Esa franja ya no está en el almanaque.');
    const started = slot.items.some((i) => i.appliedAt !== null);
    if (started && input.start && input.start.getTime() !== slot.start.getTime()) throw new PromoError('Ya se prendió en el canal: no se le puede cambiar cuándo empieza.');
    const start = input.start ?? slot.start;
    const finish = input.finish ?? slot.finish;
    if (finish <= start) throw new PromoError('La franja tiene que terminar después de empezar.');
    await db.promotionSlot.update({
      where: { id },
      data: { start, finish, source: 'MANUAL', cancelled: false, ...(input.targetMarginPct !== undefined ? { targetMarginPct: input.targetMarginPct } : {}), ...(input.name ? { name: input.name.trim().slice(0, 120) } : {}), ...(input.note !== undefined ? { note: input.note?.trim().slice(0, 300) || null } : {}) },
    });
  } else {
    const campaign = input.group ? promo.campaigns.find((c) => c.group === input.group) : null;
    if (input.group && !campaign) throw new PromoError('El canal no informa esa campaña para este producto: volvé a leer las invitaciones.');
    const fromType = campaign ? layerOfType(campaign.type) : null;
    const layer = fromType?.layer ?? input.layer ?? 'BASE';
    const kind = fromType?.kind ?? input.kind ?? 'OWN_DISCOUNT';
    if (!LAYERS.includes(layer) || !SLOT_KINDS.includes(kind)) throw new PromoError('No se reconoce la capa o el tipo de la franja.');
    if (kind !== 'OWN_DISCOUNT' && !campaign) throw new PromoError('Para una franja de una campaña del canal hace falta la campaña.');
    const same = campaign ? promo.campaigns.filter((c) => c.group === campaign.group) : [];
    const first = same.map((c) => c.start).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime())[0];
    const last = same.map((c) => c.finish).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];
    const start = input.start ?? first ?? now;
    const finish = input.finish ?? last;
    if (!finish) throw new PromoError('Falta hasta cuándo va la franja.');
    if (finish <= start) throw new PromoError('La franja tiene que terminar después de empezar.');
    if (input.group) {
      const dup = await db.promotionSlot.findFirst({ where: { productId: input.productId, group: input.group, finish: { gt: now } }, select: { id: true } });
      if (dup) throw new PromoError('Esa campaña ya tiene su franja en el almanaque: cambiá esa.');
    }
    const slot = await db.promotionSlot.create({
      data: {
        accountId: args.accountId,
        productId: input.productId,
        layer,
        kind,
        group: input.group ?? null,
        name: (input.name?.trim() || campaign?.name || 'Descuento propio').slice(0, 120),
        start,
        finish,
        targetMarginPct: input.targetMarginPct ?? settings.thresholds.healthyMarginPct,
        source: 'MANUAL',
        note: input.note?.trim().slice(0, 300) || null,
      },
    });
    id = slot.id;
  }
  await evaluateProduct(db, { promo, settings, now });
  return id;
}

/**
 * Decide a mano que una franja no va, o la vuelve a poner. La que no va
 * queda guardada para que el almanaque no la vuelva a armar. takeOutNow:
 * además saca del canal lo que ya estaba prendido.
 */
export async function cancelSlot(
  db: Db,
  args: { accountId: string; slotId: string; cancelled: boolean; takeOutNow?: boolean; why?: string | null; userId: string | null; now?: Date },
): Promise<{ takenOut: AppliedAction[] }> {
  const now = args.now ?? new Date();
  const slot = await db.promotionSlot.findFirst({ where: { id: args.slotId, accountId: args.accountId }, include: { items: { select: { id: true, state: true } } } });
  if (!slot) throw new PromoError('Esa franja ya no está en el almanaque.');
  await db.promotionSlot.update({ where: { id: slot.id }, data: { cancelled: args.cancelled, source: 'MANUAL', ...(args.why !== undefined ? { note: args.why?.trim().slice(0, 300) || null } : {}) } });
  let takenOut: AppliedAction[] = [];
  if (args.cancelled && args.takeOutNow) {
    const inside = slot.items.filter((i) => i.state === 'ON' || i.state === 'SCHEDULED').map((i) => i.id);
    if (inside.length > 0) takenOut = await takeOut(db, { accountId: args.accountId, itemIds: inside, why: args.why ?? 'La franja se sacó del almanaque', userId: args.userId, now });
  }
  if (!args.cancelled) {
    const promo = await loadProductPromo(db, args.accountId, slot.productId);
    if (promo) await evaluateProduct(db, { promo, settings: await loadPromoSettings(db, args.accountId), now });
  }
  return { takenOut };
}
