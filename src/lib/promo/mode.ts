import type { PrismaClient } from '@/generated/prisma/client';
import { finalPriceOf } from '@/domain/pricing';
import { marginAt } from '@/domain/promo/entry';
import { hasNoEnd, layerOfType, NO_END, planSlots } from '@/domain/promo/plan';
import type { Mode } from '@/domain/promo/tags';
import { unitsLast90 } from '@/lib/sales/units';
import { takeOut, type AppliedAction } from './apply';
import { classifyAccount } from './classify';
import { campaignInfos, competitorMargins, generatePlan, loadEvents, startOfDay } from './plan';
import { loadProductPromo, type ProductPromo } from './product';
import { loadPromoSettings, PromoError } from './settings';

// El modo de un producto: quién arma su almanaque. En Manual lo arma una
// persona, y nace con las promociones en las que ya está inscripto en el
// canal. En Automático lo arman las reglas con sus etiquetas. En los dos
// casos lo ejecuta la app. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

const DAY = 86_400_000;

/**
 * Deja el almanaque de un producto en Manual como tiene que estar: lo que
 * había armado la app y no empezó se va, lo que ya está en el canal queda
 * como franja a mano, y lo que el canal muestra inscripto y no estaba en el
 * almanaque se suma (las campañas en las que está o está anotado, y el
 * descuento propio que tiene, sin fin). No toca el canal.
 */
export async function adoptExisting(db: Db, args: { accountId: string; productId: string; now?: Date }): Promise<{ adopted: number }> {
  const now = args.now ?? new Date();
  const promo = await loadProductPromo(db, args.accountId, args.productId);
  if (!promo || promo.mode !== 'MANUAL') return { adopted: 0 };
  const settings = await loadPromoSettings(db, args.accountId);
  let adopted = 0;
  const slots = await db.promotionSlot.findMany({ where: { productId: promo.productId, finish: { gt: now } }, include: { items: true } });
  // Lo que había armado la app en Automático.
  for (const s of slots.filter((x) => x.source === 'PLAN')) {
    if (s.items.some((i) => i.appliedAt !== null)) {
      await db.promotionSlot.update({ where: { id: s.id }, data: { source: 'MANUAL' } });
      await db.promotionSlotItem.updateMany({ where: { slotId: s.id }, data: { fixed: true } });
      s.source = 'MANUAL';
    } else {
      await db.promotionSlot.delete({ where: { id: s.id } });
    }
  }
  const live = slots.filter((s) => s.source === 'MANUAL' && !s.cancelled);
  const measureAt = new Date(now.getTime() + settings.rules.timing.measureDays * DAY);
  // Las campañas del canal en las que ya está o está anotado.
  const inside = promo.campaigns.filter((c) => c.status !== 'invited' && (!c.finish || c.finish > now));
  for (const group of new Set(inside.map((c) => c.group))) {
    const rows = inside.filter((c) => c.group === group);
    let slot = live.find((s) => s.group === group) ?? null;
    if (!slot) {
      const first = rows[0];
      const { layer, kind } = layerOfType(first.type);
      const starts = rows.map((c) => c.start).filter((d): d is Date => d !== null);
      const finishes = rows.map((c) => c.finish).filter((d): d is Date => d !== null);
      slot = await db.promotionSlot.create({
        data: {
          accountId: args.accountId,
          productId: promo.productId,
          layer,
          kind,
          group,
          name: first.name,
          start: starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : now,
          finish: finishes.length > 0 ? new Date(Math.max(...finishes.map((d) => d.getTime()))) : new Date(now.getTime() + 30 * DAY),
          targetMarginPct: settings.thresholds.healthyMarginPct,
          source: 'MANUAL',
          note: 'Ya estaba en el canal.',
        },
        include: { items: true },
      });
      live.push(slot);
    }
    for (const c of rows) {
      if (slot.items.some((i) => i.publicationId === c.publicationId)) continue;
      const o = promo.options.find((x) => x.publicationId === c.publicationId);
      if (!o) continue;
      const margin = c.price !== null ? marginAt(o.eco, c.price, c.channelPct, c.listPrice ?? o.eco.listPrice) : null;
      await db.promotionSlotItem.create({
        data: { slotId: slot.id, publicationId: c.publicationId, state: c.status === 'active' ? 'ON' : 'SCHEDULED', price: c.price, marginPct: margin === null ? null : Math.round(margin * 100) / 100, ref: c.ref, fixed: true, appliedAt: now, measureAt },
      });
      adopted++;
    }
  }
  // El descuento propio que ya tienen: una franja sin fin, hasta que alguien le ponga fecha.
  const withOwn = promo.options.filter((o) => o.externalId && (o.discountNow ?? 0) > 0 && o.eco.listPrice !== null);
  const covered = new Set(live.filter((s) => s.kind === 'OWN_DISCOUNT').flatMap((s) => s.items.filter((i) => i.state === 'ON' || i.state === 'PLANNED').map((i) => i.publicationId)));
  const missing = withOwn.filter((o) => !covered.has(o.publicationId));
  if (missing.length > 0) {
    let slot = live.find((s) => s.kind === 'OWN_DISCOUNT' && hasNoEnd(s.finish)) ?? null;
    if (!slot) {
      slot = await db.promotionSlot.create({
        data: { accountId: args.accountId, productId: promo.productId, layer: 'BASE', kind: 'OWN_DISCOUNT', name: 'Descuento propio', start: now, finish: NO_END, targetMarginPct: settings.thresholds.healthyMarginPct, source: 'MANUAL', note: 'Ya estaba en el canal, sin fecha de fin.' },
        include: { items: true },
      });
    }
    for (const o of missing) {
      if (slot.items.some((i) => i.publicationId === o.publicationId)) continue;
      const price = Math.round(finalPriceOf(o.eco.listPrice!, o.discountNow!));
      await db.promotionSlotItem.create({
        data: { slotId: slot.id, publicationId: o.publicationId, state: 'ON', price, discountPct: o.discountNow!, marginPct: o.marginNow === null ? null : Math.round(o.marginNow * 100) / 100, fixed: true, appliedAt: now },
      });
      adopted++;
    }
  }
  return { adopted };
}

/** Lo que está prendido o anotado en el canal y el plan automático no incluiría: para preguntar qué hacer antes de cambiar de modo. */
export type ModeConflict = { slotId: string; name: string; kind: string; finish: Date | null; publications: { itemId: string; externalId: string | null }[] };

/** Las franjas que una persona armó y que al pasar a Automático se reemplazan: las futuras se van, y de las que ya están en el canal hay que decidir. */
async function manualSlots(db: Db, productId: string, now: Date) {
  return db.promotionSlot.findMany({ where: { productId, source: 'MANUAL', finish: { gt: now } }, include: { items: { include: { publication: { select: { externalId: true } } } } } });
}

/** Los grupos de campaña y si lleva base, según el plan que armarían las reglas con las etiquetas de ahora. */
async function plannedBy(db: Db, accountId: string, promo: ProductPromo, now: Date): Promise<{ groups: Set<string>; base: boolean }> {
  const account = await db.account.findUniqueOrThrow({ where: { id: accountId }, select: { timezone: true } });
  const settings = await loadPromoSettings(db, accountId);
  const today = startOfDay(now, account.timezone);
  const sold = await unitsLast90(db, promo.options.map((o) => o.publicationId), now);
  const planned = planSlots({
    today,
    tags: promo.tags,
    rules: settings.rules,
    thresholds: settings.thresholds,
    events: await loadEvents(db, accountId, today),
    campaigns: campaignInfos(promo.campaigns),
    hasSales: [...sold.values()].some((n) => n > 0),
    ...competitorMargins(promo),
    existing: [],
  });
  return { groups: new Set(planned.filter((s) => s.group).map((s) => s.group!)), base: planned.some((s) => s.kind === 'OWN_DISCOUNT') };
}

/**
 * Antes de pasar a Automático: lo que hoy está prendido o anotado en el canal
 * y las reglas no incluirían. De eso hay que elegir si sigue hasta que termine
 * o si se saca ahora.
 */
export async function modeConflicts(db: Db, args: { accountId: string; productId: string; now?: Date }): Promise<ModeConflict[]> {
  const now = args.now ?? new Date();
  const promo = await loadProductPromo(db, args.accountId, args.productId);
  if (!promo) throw new PromoError('El producto no es de esta cuenta.');
  // Con las etiquetas que le pondría la regla al pasar, sin guardarlas.
  const proposed = (await classifyAccount(db, { accountId: args.accountId, productIds: [promo.productId], apply: false, includeManual: true, now })).products[0];
  const lifecycle = proposed?.lifecycle && !proposed.lifecycle.manual ? proposed.lifecycle.proposed : promo.tags.lifecycle;
  const competition = proposed?.competition && !proposed.competition.manual ? proposed.competition.proposed : promo.tags.competition;
  const plan = await plannedBy(db, args.accountId, { ...promo, mode: 'AUTO', tags: { ...promo.tags, lifecycle: lifecycle ?? 'GROWING', competition } }, now);
  const out: ModeConflict[] = [];
  for (const s of await manualSlots(db, promo.productId, now)) {
    const inside = s.items.filter((i) => i.state === 'ON' || i.state === 'SCHEDULED');
    if (inside.length === 0) continue;
    // La campaña que el plan también lleva, y el descuento propio cuando el plan lleva base, siguen sin preguntar.
    if (s.kind === 'OWN_DISCOUNT' ? plan.base : s.group !== null && plan.groups.has(s.group)) continue;
    out.push({ slotId: s.id, name: s.name, kind: s.kind, finish: hasNoEnd(s.finish) ? null : s.finish, publications: inside.map((i) => ({ itemId: i.id, externalId: i.publication.externalId })) });
  }
  return out;
}

/** Calcula las etiquetas del producto con la regla. Sin ciclo de vida propuesto, arranca como en crecimiento. */
async function ensureTags(db: Db, accountId: string, productId: string, now: Date): Promise<void> {
  await classifyAccount(db, { accountId, productIds: [productId], apply: true, includeManual: true, now });
  const row = await db.productPromotion.findUnique({ where: { productId }, select: { lifecycle: true, why: true } });
  if (!row?.lifecycle) {
    const why = { ...(row?.why && typeof row.why === 'object' && !Array.isArray(row.why) ? row.why : {}), lifecycle: 'La regla no tiene con qué decidir: arranca como en crecimiento. Cambialo si no corresponde.' };
    await db.productPromotion.upsert({ where: { productId }, create: { productId, lifecycle: 'GROWING', why }, update: { lifecycle: 'GROWING', why } });
  }
}

export type ModeChange = { mode: Mode; takenOut: AppliedAction[]; removed: number; kept: number };

/**
 * Cambia quién arma el almanaque de un producto.
 * A Automático: la regla le pone las etiquetas en ese momento, las franjas
 * armadas a mano que no empezaron se van y las reglas arman las suyas. De lo
 * que ya está en el canal y las reglas no incluirían, takeOut dice cuáles
 * franjas se sacan ahora; las demás siguen hasta que terminen.
 * A Manual: las franjas que armaron las reglas quedan para editarlas; con
 * clear, las que no empezaron se borran. Nunca saca nada del canal por su cuenta.
 */
export async function setMode(
  db: Db,
  args: { accountId: string; productId: string; mode: Mode; takeOut?: string[]; clear?: boolean; userId: string | null; now?: Date },
): Promise<ModeChange> {
  const now = args.now ?? new Date();
  const product = await db.product.findFirst({ where: { id: args.productId, accountId: args.accountId }, select: { id: true } });
  if (!product) throw new PromoError('El producto no es de esta cuenta.');
  const out: ModeChange = { mode: args.mode, takenOut: [], removed: 0, kept: 0 };
  if (args.mode === 'AUTO') {
    // Lo que el canal ya muestra queda registrado antes de cambiar, para no perderlo de vista.
    await adoptExisting(db, { accountId: args.accountId, productId: product.id, now });
    await ensureTags(db, args.accountId, product.id, now);
    const tagged = await loadProductPromo(db, args.accountId, product.id);
    const plan = tagged ? await plannedBy(db, args.accountId, { ...tagged, mode: 'AUTO' }, now) : { groups: new Set<string>(), base: false };
    for (const s of await manualSlots(db, product.id, now)) {
      const inside = s.items.filter((i) => i.state === 'ON' || i.state === 'SCHEDULED');
      if (inside.length === 0) {
        await db.promotionSlot.delete({ where: { id: s.id } });
        out.removed++;
        continue;
      }
      // Lo que estaba por entrar en esa franja ya no entra: el plan es de las reglas.
      await db.promotionSlotItem.deleteMany({ where: { slotId: s.id, state: 'PLANNED' } });
      if (s.group !== null && plan.groups.has(s.group)) {
        // La campaña que las reglas también llevan pasa a ser de ellas: lo que ya está adentro sigue y deciden el resto de las publicaciones.
        await db.promotionSlot.update({ where: { id: s.id }, data: { source: 'PLAN' } });
        await db.promotionSlotItem.updateMany({ where: { slotId: s.id }, data: { fixed: false } });
        out.kept++;
        continue;
      }
      if (args.takeOut?.includes(s.id)) {
        out.takenOut.push(...(await takeOut(db, { accountId: args.accountId, itemIds: inside.map((i) => i.id), why: 'Se sacó al pasar a Automático', userId: args.userId, now })));
      } else out.kept++;
    }
    await db.productPromotion.upsert({ where: { productId: product.id }, create: { productId: product.id, mode: 'AUTO', updatedById: args.userId }, update: { mode: 'AUTO', updatedById: args.userId } });
    await generatePlan(db, { accountId: args.accountId, productId: product.id, now });
    return out;
  }
  await db.productPromotion.upsert({ where: { productId: product.id }, create: { productId: product.id, mode: 'MANUAL', updatedById: args.userId }, update: { mode: 'MANUAL', updatedById: args.userId } });
  // Las franjas de las reglas quedan como armadas a mano, con sus precios, para editarlas.
  const planned = await db.promotionSlot.findMany({ where: { productId: product.id, source: 'PLAN', finish: { gt: now } }, include: { items: { select: { appliedAt: true } } } });
  for (const s of planned) {
    const started = s.items.some((i) => i.appliedAt !== null);
    if (args.clear && !started) {
      await db.promotionSlot.delete({ where: { id: s.id } });
      out.removed++;
      continue;
    }
    await db.promotionSlot.update({ where: { id: s.id }, data: { source: 'MANUAL' } });
    await db.promotionSlotItem.updateMany({ where: { slotId: s.id }, data: { fixed: true } });
    out.kept++;
  }
  await adoptExisting(db, { accountId: args.accountId, productId: product.id, now });
  return out;
}

/** En Manual: borra todas las franjas que todavía no empezaron. Lo que ya está en el canal queda. */
export async function clearManualPlan(db: Db, args: { accountId: string; productId: string; now?: Date }): Promise<number> {
  const now = args.now ?? new Date();
  const promo = await db.productPromotion.findFirst({ where: { productId: args.productId, product: { accountId: args.accountId } }, select: { mode: true } });
  if (promo?.mode === 'AUTO') throw new PromoError('En Automático el almanaque lo arman las reglas: para borrarlo, primero pasalo a Manual.');
  const slots = await db.promotionSlot.findMany({ where: { productId: args.productId, accountId: args.accountId, finish: { gt: now } }, include: { items: { select: { appliedAt: true } } } });
  const free = slots.filter((s) => !s.items.some((i) => i.appliedAt !== null));
  if (free.length > 0) await db.promotionSlot.deleteMany({ where: { id: { in: free.map((s) => s.id) } } });
  return free.length;
}
