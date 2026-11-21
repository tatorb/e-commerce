import type { PrismaClient } from '@/generated/prisma/client';
import { formatPrice } from '@/domain/money';
import { shares } from '@/domain/pricing';
import { OWN_DISCOUNT_RANGE } from '@/domain/promo/entry';
import { hasNoEnd, layerOfType, NO_END, type Layer, type SlotKind } from '@/domain/promo/plan';
import { quote, type Calc, type PriceBy } from '@/domain/promo/quote';
import { pctUpToPrice } from '@/domain/promotions';
import { loadProductPromo, type ProductPromo, type PromoOption, type StoredCampaign } from './product';
import { loadPromoSettings, PromoError } from './settings';

// Armar el almanaque a mano: inscribir unas publicaciones a una promoción,
// desde una fecha hasta otra, con el precio que carga la persona. Puede ser
// el descuento propio, una campaña a la que el canal invita, o una reserva
// para un evento del calendario que todavía no tiene invitación. Debajo del
// piso avisa y deja seguir; lo que el canal no va a aceptar no se guarda.
// No toca el canal: la app lo ejecuta en su fecha. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

export type EnrollKind = 'OWN_DISCOUNT' | 'CAMPAIGN' | 'RESERVE';
export type EnrollRow = { publicationId: string; by: PriceBy; value: number; stock?: number | null };
export type EnrollInput = {
  productId: string;
  kind: EnrollKind;
  // La campaña del canal, o el evento del calendario de una reserva.
  group?: string | null;
  eventId?: string | null;
  // Sin desde, hoy o cuando empieza la campaña; sin hasta, sin fin en el descuento propio o cuando termina la campaña.
  start?: Date | null;
  finish?: Date | null;
  rows: EnrollRow[];
  // Qué hacer si se pisa con otra promoción de la misma publicación: keep, conviven; cut, la anterior se corta cuando empieza esta.
  overlap?: 'keep' | 'cut';
};

export type QuotedRow = {
  publicationId: string;
  externalId: string | null;
  // Por qué no se puede inscribir. Null: se puede.
  problem: string | null;
  // Se puede, pero conviene mirarlo: deja menos que el piso.
  warning: string | null;
  price: number | null;
  discountPct: number | null;
  marginPct: number | null;
  stock: number | null;
  ref: string | null;
};

export type Overlap = { publicationId: string; externalId: string | null; slotId: string; itemId: string; name: string; start: Date; finish: Date; state: string; canCut: boolean };

export type EnrollQuote = { name: string; layer: Layer; kind: SlotKind; group: string | null; eventId: string | null; start: Date; finish: Date; rows: QuotedRow[]; overlaps: Overlap[] };

/** Lo que hace falta de una publicación para sacar su rentabilidad a cualquier precio, igual en el navegador y acá. */
export function calcOf(o: PromoOption): Calc {
  const s = o.eco.plan === null ? null : shares(o.eco.params, o.eco.plan);
  return { cost: o.eco.cost, keep: s ? 1 - s.pct - s.installments : null, fixed: s?.fixed ?? 0, listPrice: o.eco.listPrice };
}

const pctText = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('es-AR')} %`;

function quoteRow(args: { kind: EnrollKind; option: PromoOption; row: EnrollRow; invite: StoredCampaign | null; floor: number; channelName: string }): QuotedRow {
  const { option: o, row, invite, kind } = args;
  const base: QuotedRow = { publicationId: o.publicationId, externalId: o.externalId, problem: null, warning: null, price: null, discountPct: null, marginPct: null, stock: null, ref: invite?.ref ?? null };
  const no = (problem: string): QuotedRow => ({ ...base, problem });
  if (!o.externalId) return no(`Todavía no está publicada en ${args.channelName}.`);
  if (o.held) return no(`${args.channelName} la está revisando o la frenó: no se le puede subir nada.`);
  if (o.status !== 'ACTIVE' && o.status !== 'PAUSED') return no(`No está activa en ${args.channelName}.`);
  const listPrice = invite?.listPrice ?? o.eco.listPrice;
  if (listPrice === null) return no('No tiene precio de lista en el canal.');
  const c = calcOf(o);
  const channelPct = invite?.channelPct ?? null;
  if (kind === 'CAMPAIGN') {
    if (!invite) return no('El canal no la invita a esta campaña.');
    if (invite.status !== 'invited') return no('Ya está en esta campaña.');
    if (invite.type !== 'VOLUME' && invite.join === null) return no('A esta campaña solo se suma desde el canal.');
  }
  // En las que el precio lo pone el canal, no hay nada que elegir.
  const fixedPrice =
    kind === 'CAMPAIGN' && invite
      ? invite.type === 'VOLUME'
        ? Math.round(listPrice * (1 - ((invite.sellerPct ?? 0) + (invite.channelPct ?? 0)) / 100))
        : invite.join === 'accept'
          ? invite.price
          : null
      : null;
  if (kind === 'CAMPAIGN' && invite && (invite.type === 'VOLUME' || invite.join === 'accept') && fixedPrice === null) return no('El canal todavía no informa el precio de esta campaña.');
  const q = fixedPrice !== null ? quote(c, 'PRICE', fixedPrice, channelPct, listPrice) : quote(c, row.by, row.value, channelPct, listPrice);
  if (q.price === null) return no(row.by === 'MARGIN' && c.cost === null ? 'No tiene el costo cargado: cargá el precio o el porcentaje.' : 'Revisá el valor.');
  if (q.price >= listPrice) return no('Tiene que quedar más barato que el precio de lista.');
  let discountPct = q.pct;
  let price = q.price;
  if (kind === 'OWN_DISCOUNT') {
    // El canal toma el descuento en %: el más grande que no baja de ese precio.
    discountPct = pctUpToPrice(listPrice, q.price) ?? 0;
    if (discountPct < OWN_DISCOUNT_RANGE.min) return no(`El canal no acepta un descuento propio de menos de ${pctText(OWN_DISCOUNT_RANGE.min)}.`);
    if (discountPct > OWN_DISCOUNT_RANGE.max) return no('El canal no acepta un descuento propio de 80 % o más.');
    price = Math.round(listPrice * (1 - discountPct / 100));
  }
  let stock: number | null = null;
  if (kind === 'CAMPAIGN' && invite && invite.join === 'price') {
    if (invite.maxPrice !== null && price > invite.maxPrice) return no(`${args.channelName} pide ${formatPrice(invite.maxPrice)} o menos en esta campaña.`);
    if (invite.minPrice !== null && price < invite.minPrice) return no(`${args.channelName} no acepta menos de ${formatPrice(invite.minPrice)} en esta campaña.`);
    if (invite.type === 'LIGHTNING') {
      stock = row.stock ?? invite.stockMin ?? 1;
      if (invite.stockMin !== null && stock < invite.stockMin) return no(`La oferta relámpago pide reservar ${invite.stockMin} unidades o más.`);
      if (invite.stockMax !== null && stock > invite.stockMax) return no(`La oferta relámpago no deja reservar más de ${invite.stockMax} unidades.`);
      if (o.stock !== null && o.stock < stock) return no(`Quedan ${o.stock} unidades y la oferta relámpago reserva ${stock}.`);
    }
  }
  const marginPct = quote(c, 'PRICE', price, channelPct, listPrice).marginPct;
  const warning =
    marginPct === null
      ? 'No tiene el costo cargado: no se sabe cuánto deja.'
      : marginPct < args.floor
        ? `Deja ${pctText(marginPct)}, menos que el piso de ${pctText(args.floor)}.`
        : null;
  return { ...base, price, discountPct, marginPct, stock, warning };
}

/** Las promociones de esas publicaciones que se pisan con ese período. */
async function overlapsOf(db: Db, productId: string, publicationIds: string[], start: Date, finish: Date): Promise<Overlap[]> {
  const items = await db.promotionSlotItem.findMany({
    where: { publicationId: { in: publicationIds }, state: { in: ['PLANNED', 'SCHEDULED', 'ON'] }, slot: { productId, cancelled: false, start: { lt: finish }, finish: { gt: start } } },
    include: { slot: true, publication: { select: { externalId: true } } },
    orderBy: { slot: { start: 'asc' } },
  });
  return items.map((i) => ({
    publicationId: i.publicationId,
    externalId: i.publication.externalId,
    slotId: i.slotId,
    itemId: i.id,
    name: i.slot.name,
    start: i.slot.start,
    finish: i.slot.finish,
    state: i.state,
    // Se puede cortar cuando empieza la nueva si empezó antes; un pico ya activo no se puede sacar.
    canCut: i.slot.start < start && !(i.slot.layer === 'PEAK' && i.state === 'ON'),
  }));
}

/** Lo que quedaría: el nombre, las fechas, cada publicación con su precio y lo que deja, y con qué se pisa. No guarda nada. */
export async function quoteEnroll(db: Db, args: { accountId: string; input: EnrollInput; promo?: ProductPromo; now?: Date }): Promise<EnrollQuote> {
  const now = args.now ?? new Date();
  const { input } = args;
  const promo = args.promo ?? (await loadProductPromo(db, args.accountId, input.productId));
  if (!promo) throw new PromoError('El producto no es de esta cuenta.');
  if (promo.mode !== 'MANUAL') throw new PromoError('En Automático el almanaque lo arman las reglas: para armarlo a mano, primero pasalo a Manual.');
  if (input.rows.length === 0) throw new PromoError('Elegí al menos una publicación.');
  const settings = await loadPromoSettings(db, args.accountId);
  let name = 'Descuento propio';
  let layer: Layer = 'BASE';
  let slotKind: SlotKind = 'OWN_DISCOUNT';
  let group: string | null = null;
  let eventId: string | null = null;
  let start = input.start ?? now;
  let finish = input.finish ?? NO_END;
  let invites: StoredCampaign[] = [];
  if (input.kind === 'CAMPAIGN') {
    invites = promo.campaigns.filter((c) => c.group === input.group);
    if (invites.length === 0) throw new PromoError('El canal no informa esa campaña para este producto: volvé a leer las invitaciones.');
    ({ layer, kind: slotKind } = layerOfType(invites[0].type));
    name = invites[0].name;
    group = input.group!;
    const starts = invites.map((c) => c.start).filter((d): d is Date => d !== null).map((d) => d.getTime());
    const finishes = invites.map((c) => c.finish).filter((d): d is Date => d !== null).map((d) => d.getTime());
    const first = starts.length > 0 ? new Date(Math.min(...starts)) : now;
    const last = finishes.length > 0 ? new Date(Math.max(...finishes)) : null;
    if (!last) throw new PromoError('El canal no informa hasta cuándo va esa campaña.');
    // Las fechas de una campaña del canal las pone el canal: se puede entrar más tarde o salir antes, nada más.
    start = input.start && input.start > first ? input.start : first;
    finish = input.finish && input.finish < last ? input.finish : last;
  } else if (input.kind === 'RESERVE') {
    const event = input.eventId ? await db.promotionEvent.findFirst({ where: { id: input.eventId, accountId: args.accountId } }) : null;
    if (!event) throw new PromoError('Ese evento ya no está en el calendario.');
    if (event.finish <= now) throw new PromoError('Ese evento ya pasó.');
    name = event.name;
    layer = 'EVENT';
    slotKind = 'CAMPAIGN';
    eventId = event.id;
    start = event.start;
    finish = event.finish;
  } else if (start < now) start = now;
  if (finish <= start) throw new PromoError('Tiene que terminar después de empezar.');
  if (finish <= now) throw new PromoError('Ese período ya pasó.');
  const rows = input.rows.map((row) => {
    const option = promo.options.find((o) => o.publicationId === row.publicationId);
    if (!option) return { publicationId: row.publicationId, externalId: null, problem: 'No es una publicación de este producto.', warning: null, price: null, discountPct: null, marginPct: null, stock: null, ref: null };
    const invite = input.kind === 'CAMPAIGN' ? (invites.find((c) => c.publicationId === row.publicationId) ?? null) : null;
    return quoteRow({ kind: input.kind, option, row, invite, floor: settings.thresholds.floorMarginPct, channelName: promo.channelName });
  });
  const ok = rows.filter((r) => r.problem === null).map((r) => r.publicationId);
  const overlaps = ok.length > 0 ? await overlapsOf(db, promo.productId, ok, start, hasNoEnd(finish) ? NO_END : finish) : [];
  return { name, layer, kind: slotKind, group, eventId, start, finish, rows, overlaps };
}

export type EnrollResult =
  // Se pisa con otra promoción y falta decir qué hacer: no se guardó nada.
  | { saved: false; quote: EnrollQuote }
  | { saved: true; slotId: string; quote: EnrollQuote; enrolled: number; skipped: QuotedRow[]; cut: number };

/**
 * Inscribe esas publicaciones. Las que el canal no va a aceptar no entran y
 * vuelven con el motivo. Si se pisa con otra promoción y no se dijo qué
 * hacer, no guarda y devuelve con qué se pisa.
 */
export async function enrollManual(db: Db, args: { accountId: string; input: EnrollInput; now?: Date }): Promise<EnrollResult> {
  const now = args.now ?? new Date();
  const q = await quoteEnroll(db, { ...args, now });
  const good = q.rows.filter((r) => r.problem === null);
  if (good.length === 0) throw new PromoError(`No se pudo inscribir ninguna. ${q.rows.map((r) => `${r.externalId ?? ''} ${r.problem ?? ''}`.trim()).join(' ')}`);
  if (q.overlaps.length > 0 && !args.input.overlap) return { saved: false, quote: q };
  let cut = 0;
  if (args.input.overlap === 'cut') {
    // La anterior se corta cuando empieza esta, solo para las publicaciones que se pisan: pasan a una franja igual, que termina antes.
    const bySlot = new Map<string, Overlap[]>();
    for (const o of q.overlaps.filter((x) => x.canCut)) bySlot.set(o.slotId, [...(bySlot.get(o.slotId) ?? []), o]);
    for (const [slotId, list] of bySlot) {
      const old = await db.promotionSlot.findUniqueOrThrow({ where: { id: slotId }, include: { items: { select: { id: true } } } });
      if (old.items.length === list.length) {
        // Todas sus publicaciones se pisan: se corta la franja entera.
        await db.promotionSlot.update({ where: { id: slotId }, data: { finish: q.start, source: 'MANUAL' } });
      } else {
        const copy = await db.promotionSlot.create({
          data: { accountId: old.accountId, productId: old.productId, layer: old.layer, kind: old.kind, group: old.group, name: old.name, eventId: old.eventId, start: old.start, finish: q.start, targetMarginPct: old.targetMarginPct, source: 'MANUAL', note: old.note },
        });
        await db.promotionSlotItem.updateMany({ where: { id: { in: list.map((x) => x.itemId) } }, data: { slotId: copy.id } });
      }
      cut += list.length;
    }
  }
  const margins = good.map((r) => r.marginPct).filter((m): m is number => m !== null);
  const settings = await loadPromoSettings(db, args.accountId);
  const by = new Map(args.input.rows.map((r) => [r.publicationId, r]));
  const slot = await db.promotionSlot.create({
    data: {
      accountId: args.accountId,
      productId: args.input.productId,
      layer: q.layer,
      kind: q.kind,
      group: q.group,
      name: q.name,
      eventId: q.eventId,
      start: q.start,
      finish: q.finish,
      targetMarginPct: margins.length > 0 ? Math.max(0, Math.min(...margins)) : settings.thresholds.healthyMarginPct,
      source: 'MANUAL',
      note: args.input.kind === 'RESERVE' ? 'Reserva: entra cuando el canal mande la invitación.' : null,
      items: {
        create: good.map((r) => ({
          publicationId: r.publicationId,
          state: 'PLANNED',
          // En una reserva el precio se calcula cuando llega la invitación, con lo que se cargó.
          price: args.input.kind === 'RESERVE' ? null : r.price,
          discountPct: args.input.kind === 'RESERVE' ? null : r.discountPct,
          marginPct: args.input.kind === 'RESERVE' ? null : r.marginPct,
          ref: r.ref,
          stock: r.stock,
          fixed: true,
          priceBy: by.get(r.publicationId)!.by,
          priceValue: by.get(r.publicationId)!.value,
          reasonText: r.warning,
        })),
      },
    },
  });
  return { saved: true, slotId: slot.id, quote: q, enrolled: good.length, skipped: q.rows.filter((r) => r.problem !== null), cut };
}

/**
 * Las reservas de un producto que ya tienen su campaña en el canal: la
 * reserva pasa a ser de esa campaña, con el precio de cada publicación
 * calculado con lo que se había cargado. La que no está invitada, o queda
 * fuera de lo que acepta el canal, queda afuera con el motivo.
 */
export async function bindReservations(db: Db, args: { accountId: string; promo: ProductPromo; now?: Date }): Promise<number> {
  const now = args.now ?? new Date();
  const { promo } = args;
  const waiting = await db.promotionSlot.findMany({ where: { productId: promo.productId, kind: 'CAMPAIGN', group: null, eventId: { not: null }, cancelled: false, finish: { gt: now } }, include: { items: true, event: true } });
  if (waiting.length === 0) return 0;
  const { eventOf } = await import('@/domain/promo/plan');
  const settings = await loadPromoSettings(db, args.accountId);
  let bound = 0;
  const groups = [...new Set(promo.campaigns.map((c) => c.group))];
  for (const slot of waiting) {
    if (!slot.event) continue;
    const event = { id: slot.event.id, name: slot.event.name, tier: slot.event.tier as 'T1', start: slot.event.start, finish: slot.event.finish, match: slot.event.match };
    // La campaña del canal de ese evento, que no sea un pico ni por cantidad y que todavía no tenga otra franja.
    const group = groups.find((g) => {
      const c = promo.campaigns.find((x) => x.group === g)!;
      return layerOfType(c.type).layer === 'EVENT' && eventOf({ group: g, type: c.type, name: c.name, start: c.start, finish: c.finish }, [event]) !== null;
    });
    if (!group) continue;
    const invites = promo.campaigns.filter((c) => c.group === group);
    const finishes = invites.map((c) => c.finish).filter((d): d is Date => d !== null).map((d) => d.getTime());
    const starts = invites.map((c) => c.start).filter((d): d is Date => d !== null).map((d) => d.getTime());
    await db.promotionSlot.update({
      where: { id: slot.id },
      data: { group, name: invites[0].name, start: starts.length > 0 ? new Date(Math.min(...starts)) : slot.start, finish: finishes.length > 0 ? new Date(Math.max(...finishes)) : slot.finish, note: 'Era una reserva: ya llegó la invitación del canal.' },
    });
    for (const item of slot.items) {
      const option = promo.options.find((o) => o.publicationId === item.publicationId);
      const invite = invites.find((c) => c.publicationId === item.publicationId) ?? null;
      if (!option) continue;
      if (invite && invite.status !== 'invited') {
        await db.promotionSlotItem.update({ where: { id: item.id }, data: { state: invite.status === 'active' ? 'ON' : 'SCHEDULED', ref: invite.ref, price: invite.price, appliedAt: now } });
        continue;
      }
      const r = quoteRow({ kind: 'CAMPAIGN', option, row: { publicationId: item.publicationId, by: (item.priceBy as PriceBy | null) ?? 'MARGIN', value: item.priceValue === null ? settings.thresholds.healthyMarginPct : Number(item.priceValue), stock: item.stock }, invite, floor: settings.thresholds.floorMarginPct, channelName: promo.channelName });
      await db.promotionSlotItem.update({
        where: { id: item.id },
        data: r.problem === null ? { state: 'PLANNED', price: r.price, discountPct: r.discountPct, marginPct: r.marginPct, ref: r.ref, stock: r.stock, reasonText: r.warning } : { state: 'OUT', reason: invite ? 'REJECTED' : 'NOT_INVITED', reasonText: r.problem },
      });
    }
    bound++;
  }
  return bound;
}

/** Cambia el precio de una publicación que está por entrar a una promoción armada a mano. */
export async function repriceManual(db: Db, args: { accountId: string; itemId: string; by: PriceBy; value: number; stock?: number | null; now?: Date }): Promise<QuotedRow> {
  const item = await db.promotionSlotItem.findFirst({ where: { id: args.itemId, slot: { accountId: args.accountId } }, include: { slot: true } });
  if (!item) throw new PromoError('Esa promoción ya no está en el almanaque.');
  if (item.state !== 'PLANNED') throw new PromoError('Ya está en el canal: para cambiarle el precio, sacala y volvé a inscribirla.');
  const promo = await loadProductPromo(db, args.accountId, item.slot.productId);
  if (!promo) throw new PromoError('El producto no es de esta cuenta.');
  if (promo.mode !== 'MANUAL') throw new PromoError('En Automático el precio lo ponen las reglas: para cambiarlo a mano, primero pasalo a Manual.');
  const option = promo.options.find((o) => o.publicationId === item.publicationId);
  if (!option) throw new PromoError('La publicación ya no es de este producto.');
  const settings = await loadPromoSettings(db, args.accountId);
  const reserve = item.slot.kind === 'CAMPAIGN' && item.slot.group === null;
  const kind: EnrollKind = item.slot.kind === 'OWN_DISCOUNT' ? 'OWN_DISCOUNT' : reserve ? 'RESERVE' : 'CAMPAIGN';
  const invite = item.slot.group ? (promo.campaigns.find((c) => c.group === item.slot.group && c.publicationId === item.publicationId) ?? null) : null;
  const r = quoteRow({ kind, option, row: { publicationId: item.publicationId, by: args.by, value: args.value, stock: args.stock ?? item.stock }, invite, floor: settings.thresholds.floorMarginPct, channelName: promo.channelName });
  if (r.problem !== null) throw new PromoError(r.problem);
  await db.promotionSlotItem.update({
    where: { id: item.id },
    data: { price: reserve ? null : r.price, discountPct: reserve ? null : r.discountPct, marginPct: reserve ? null : r.marginPct, stock: r.stock, fixed: true, priceBy: args.by, priceValue: args.value, reasonText: r.warning },
  });
  return r;
}
