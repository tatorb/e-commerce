import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PRICING_DEFAULTS } from '@/domain/pricing';
import { priceForMargin } from '@/domain/promo/entry';
import { TRANSACTION_OPTIONS } from '@/lib/transaction-options';

// Prender y apagar según el almanaque, con el canal simulado: lo que se manda
// queda anotado en sent. Datos inventados.

const sent: { what: string; publicationId: string; value: unknown }[] = [];
let reject: ((what: string, publicationId: string) => string | null) | null = null;

vi.mock('@/lib/channel-push', () => ({
  PushError: class PushError extends Error {},
  pushDrafts: async (db: PrismaClient, args: { publicationId: string }) => {
    const p = await db.publication.findUniqueOrThrow({ where: { id: args.publicationId }, select: { discount: true } });
    const why = reject?.('discount', args.publicationId) ?? null;
    if (why) return { sent: [], rejected: [{ field: 'discount', message: why }], confirmed: false, campaigns: [] };
    sent.push({ what: 'discount', publicationId: args.publicationId, value: Number(p.discount) });
    await db.channelCopy.update({ where: { publicationId: args.publicationId }, data: { discount: p.discount } });
    return { sent: ['discount'], rejected: [], confirmed: true, campaigns: [] };
  },
}));
vi.mock('@/lib/channel-campaigns', () => ({
  CampaignError: class CampaignError extends Error {},
  sendCampaignNow: async (_db: PrismaClient, args: { publicationId: string; choice: { action: string; price: number | null; stock?: number | null } }) => {
    const why = reject?.(args.choice.action, args.publicationId) ?? null;
    if (why) return { ok: false, error: why };
    sent.push({ what: args.choice.action, publicationId: args.publicationId, value: args.choice.stock ? { price: args.choice.price, stock: args.choice.stock } : args.choice.price });
    return { ok: true };
  },
}));

const url = process.env.TEST_DATABASE_URL;
const COST = 100_000;
const eco = (plan: 0 | 12, listPrice: number | null = null) => ({ cost: COST, params: PRICING_DEFAULTS, plan, listPrice });
const listOf = (plan: 0 | 12) => priceForMargin(eco(plan), 30)!;

describe.skipIf(!url)('promociones: prender y apagar según el almanaque', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }), transactionOptions: TRANSACTION_OPTIONS });
  const now = new Date('2026-12-01T15:00:00Z');
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
  let accountId = '';
  let productId = '';
  let flat = '';
  let twelve = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    sent.length = 0;
    reject = null;
    await db.$executeRawUnsafe(
      'TRUNCATE sales, publication_visit_days, promotion_logs, promotion_slot_items, promotion_slots, promotion_events, channel_promotion_items, promotion_options, product_promotions, promotion_settings, listing_families, channel_copies, channel_sync_changes, price_decisions, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    const storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    const v = { sku: 'SP-9-00', measure: 'STD' };
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-9', replacementCost: COST, variants: { create: [{ ...v, position: 0 }] } } })).id;
    const pub = async (code: string, plan: 0 | 12, mainOptionId: string | null) => {
      const p = await db.publication.create({ data: { productId, storeId, externalId: code, title: 'Subconjunto', mainOptionId, price: listOf(plan), installments: plan, discount: 0, channelStatus: 'ACTIVE' } });
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: now, status: 'ACTIVE', installments: plan, price: listOf(plan), discount: 0, details: { skus: [v.sku] } } });
      return p.id;
    };
    flat = await pub('MLA1', 0, null);
    twelve = await pub('MLA2', 12, flat);
    // El almanaque lo arman las reglas: el producto está en Automático.
    await db.productPromotion.create({ data: { productId, mode: 'AUTO', lifecycle: 'GROWING', manual: ['lifecycle'] } });
  });

  // Una invitación a una campaña tradicional que empieza en 10 días, con un tope que deja 16 % en cada forma de cobro.
  const invite = async (publicationId: string, plan: 0 | 12, over: object = {}) =>
    db.channelPromotionItem.create({
      data: {
        publicationId,
        group: 'DEAL:P-1',
        ref: JSON.stringify(['DEAL', 'P-1', null]),
        type: 'DEAL',
        name: 'HOT SALE',
        kind: 'Campaña tradicional',
        status: 'invited',
        join: 'price',
        start: day(10),
        finish: day(17),
        deadline: day(9),
        maxPrice: priceForMargin(eco(plan, listOf(plan)), 16),
        listPrice: listOf(plan),
        seenAt: now,
        ...over,
      },
    });

  it('la base se prende el día que empieza, por forma de cobro, y al terminar el tramo pasa al siguiente sin apagarse', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue, dueActions } = await import('@/lib/promo/apply');
    await generatePlan(db, { accountId, productId, now });
    const due = await dueActions(db, { accountId, joinLeadDays: 3, now });
    expect(due.map((d) => [d.externalId, d.action, d.kind])).toEqual([
      ['MLA1', 'ON', 'OWN_DISCOUNT'],
      ['MLA2', 'ON', 'OWN_DISCOUNT'],
    ]);
    const r = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now });
    expect(r.done.map((d) => [d.externalId, d.ok, d.state])).toEqual([
      ['MLA1', true, 'ON'],
      ['MLA2', true, 'ON'],
    ]);
    // Cada una con su descuento: el que deja la rentabilidad del tramo con sus cuotas.
    expect(sent.map((s) => s.what)).toEqual(['discount', 'discount']);
    for (const s of sent) expect(s.value).toBeGreaterThanOrEqual(5);
    const item = await db.promotionSlotItem.findFirstOrThrow({ where: { publicationId: flat, state: 'ON' } });
    expect(item.appliedAt).toEqual(now);
    expect(item.measureAt).toEqual(day(7));
    expect(Number((await db.publication.findUniqueOrThrow({ where: { id: flat } })).discount)).toBe(sent[0].value);
    const logs = await db.promotionLog.findMany({ where: { publicationId: flat } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ kind: 'ON', auto: true });
    expect(logs[0].text).toContain('Se prendió descuento propio');
    // Volver a correr no manda nada.
    sent.length = 0;
    expect((await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now })).done).toEqual([]);
    // A los 14 días empieza el tramo siguiente: se manda el nuevo y el anterior queda terminado sin apagarlo aparte.
    const next = day(14);
    const second = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: next });
    expect(second.done.every((d) => d.action === 'ON' && d.ok)).toBe(true);
    expect(sent.map((s) => s.what)).toEqual(['discount', 'discount']);
  });

  it('sin tramo siguiente, al terminar se saca el descuento', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue } = await import('@/lib/promo/apply');
    await generatePlan(db, { accountId, productId, now });
    await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now });
    // Pasa a madurada: la base que seguía se va.
    await db.productPromotion.update({ where: { productId }, data: { lifecycle: 'MATURE' } });
    await generatePlan(db, { accountId, productId, now: day(1) });
    sent.length = 0;
    const off = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: day(14) });
    expect(off.done.map((d) => [d.externalId, d.action, d.state])).toEqual([
      ['MLA1', 'OFF', 'ENDED'],
      ['MLA2', 'OFF', 'ENDED'],
    ]);
    expect(sent).toEqual([
      { what: 'discount', publicationId: flat, value: 0 },
      { what: 'discount', publicationId: twelve, value: 0 },
    ]);
  });

  it('a una campaña se entra unos días antes; la que el canal rechaza se reintenta y después queda como no se pudo', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue, dueActions, putBack } = await import('@/lib/promo/apply');
    await db.productPromotion.update({ where: { productId }, data: { lifecycle: 'MATURE' } });
    await invite(flat, 0);
    await invite(twelve, 12);
    await generatePlan(db, { accountId, productId, now });
    // Faltan 10 días y la invitación vence en 9: todavía no toca.
    expect(await dueActions(db, { accountId, joinLeadDays: 3, now })).toEqual([]);
    // Un día antes de que venza la invitación, sí.
    const when = day(8);
    reject = (what, id) => (what === 'join' && id === twelve ? 'Item is not eligible' : null);
    const r = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: when });
    expect(r.done.map((d) => [d.externalId, d.ok, d.state])).toEqual([
      ['MLA1', true, 'SCHEDULED'],
      ['MLA2', false, 'PLANNED'],
    ]);
    expect(sent).toEqual([{ what: 'join', publicationId: flat, value: priceForMargin(eco(0, listOf(0)), 15) }]);
    const failed = await db.promotionSlotItem.findFirstOrThrow({ where: { publicationId: twelve } });
    expect(failed).toMatchObject({ attempts: 1, lastError: 'Item is not eligible' });
    expect(failed.nextTryAt).toEqual(new Date(when.getTime() + 3_600_000));
    // Antes de la hora no se vuelve a intentar.
    expect((await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: when })).done).toEqual([]);
    // Después de cuatro intentos queda como no se pudo, con el motivo.
    let at = when;
    for (let i = 0; i < 3; i++) {
      at = new Date(at.getTime() + 13 * 3_600_000);
      await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: at });
    }
    expect(await db.promotionSlotItem.findFirstOrThrow({ where: { publicationId: twelve } })).toMatchObject({ state: 'FAILED', attempts: 4, reason: 'REJECTED' });
    expect(await db.promotionLog.count({ where: { publicationId: twelve, kind: 'ERROR' } })).toBe(4);
    // A mano se vuelve a intentar.
    reject = null;
    expect(await putBack(db, { accountId, itemIds: [failed.id], now: at })).toBe(1);
    const again = await applyDue(db, { accountId, auto: false, userId: null, budgetMs: 60_000, now: at });
    expect(again.done.map((d) => [d.externalId, d.ok])).toEqual([['MLA2', true]]);
  });

  it('antes de prender vuelve a sacar la rentabilidad: si el costo subió y ya no deja el piso, no entra', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue } = await import('@/lib/promo/apply');
    await db.productPromotion.update({ where: { productId }, data: { lifecycle: 'MATURE' } });
    await invite(flat, 0);
    await generatePlan(db, { accountId, productId, now });
    expect(await db.promotionSlotItem.findFirstOrThrow({ where: { publicationId: flat } })).toMatchObject({ state: 'PLANNED' });
    // El costo sube 20 %: al tope del canal ya no llega al piso.
    await db.product.update({ where: { id: productId }, data: { replacementCost: COST * 1.2 } });
    const r = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: day(8) });
    expect(r.done).toEqual([]);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].why).toContain('menos que el piso');
    expect(sent).toEqual([]);
    expect(await db.promotionSlotItem.findFirstOrThrow({ where: { publicationId: flat } })).toMatchObject({ state: 'OUT', reason: 'BELOW_FLOOR' });
    expect(await db.promotionLog.findFirstOrThrow({ where: { publicationId: flat } })).toMatchObject({ kind: 'SKIP' });
  });

  it('sacar a mano: sale del canal, queda como sacada a mano y el almanaque no la vuelve a meter; una franja que no va no se prende', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue, takeOut } = await import('@/lib/promo/apply');
    const { cancelSlot, saveManualSlot } = await import('@/lib/promo/manual');
    await generatePlan(db, { accountId, productId, now });
    await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now });
    const item = await db.promotionSlotItem.findFirstOrThrow({ where: { publicationId: twelve, state: 'ON' } });
    sent.length = 0;
    const out = await takeOut(db, { accountId, itemIds: [item.id], why: 'No rinde en 12 cuotas', userId: null, now });
    expect(out.map((o) => [o.externalId, o.ok, o.state])).toEqual([['MLA2', true, 'OUT']]);
    expect(sent).toEqual([{ what: 'discount', publicationId: twelve, value: 0 }]);
    await generatePlan(db, { accountId, productId, now });
    expect(await db.promotionSlotItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ state: 'OUT', reason: 'MANUAL' });
    // Una franja que se decide que no va: no se prende y el almanaque no la vuelve a armar.
    const next = await db.promotionSlot.findFirstOrThrow({ where: { layer: 'BASE', start: { gt: now } }, orderBy: { start: 'asc' } });
    await cancelSlot(db, { accountId, slotId: next.id, cancelled: true, userId: null, now });
    await generatePlan(db, { accountId, productId, now });
    expect(await db.promotionSlot.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({ cancelled: true, source: 'MANUAL' });
    // Una franja a mano con otra rentabilidad, nunca debajo del piso.
    await expect(saveManualSlot(db, { accountId, input: { productId, slotId: next.id, targetMarginPct: 5 }, now })).rejects.toThrow('piso');
    await saveManualSlot(db, { accountId, input: { productId, slotId: next.id, targetMarginPct: 12 }, now });
    expect(await db.promotionSlot.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({ cancelled: false, source: 'MANUAL' });
    expect(Number((await db.promotionSlotItem.findFirstOrThrow({ where: { slotId: next.id, publicationId: flat } })).marginPct)).toBeGreaterThanOrEqual(12);
  });

  it('una relámpago reserva las unidades que pide el canal', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue } = await import('@/lib/promo/apply');
    await db.channelPromotionItem.create({
      data: { publicationId: flat, group: 'LIGHTNING:P-9', ref: JSON.stringify(['LIGHTNING', 'P-9', null]), type: 'LIGHTNING', name: 'Relámpago', kind: 'Oferta relámpago', status: 'invited', join: 'price', start: day(2), finish: day(2.25), maxPrice: listOf(0) - 1, stockMin: 2, stockMax: 5, listPrice: listOf(0), seenAt: now },
    });
    await generatePlan(db, { accountId, productId, now });
    const peak = await db.promotionSlot.findFirstOrThrow({ where: { layer: 'PEAK' }, include: { items: true } });
    expect(peak.items.find((i) => i.publicationId === flat)).toMatchObject({ state: 'PLANNED', stock: 2 });
    expect(peak.items.find((i) => i.publicationId === twelve)).toMatchObject({ state: 'OUT', reason: 'NOT_INVITED' });
    sent.length = 0;
    await applyDue(db, { accountId, itemIds: peak.items.map((i) => i.id), auto: false, userId: null, budgetMs: 60_000, now });
    expect(sent).toEqual([{ what: 'join', publicationId: flat, value: { price: priceForMargin(eco(0, listOf(0)), 15), stock: 2 } }]);
  });

  it('la pasada de cada hora: arma el almanaque que falta y, salvo con el freno de emergencia puesto, manda lo que toca', async () => {
    const { promotionsPass } = await import('@/lib/promo/run');
    const { classifyAccount } = await import('@/lib/promo/classify');
    // Una cuenta que no usa Promociones no se toca.
    expect(await promotionsPass(db, { budgetMs: 60_000, now })).toMatchObject({ accounts: 0, planned: 0, applied: 0 });
    // Con las invitaciones y la clasificación al día, y el freno de emergencia puesto: arma el almanaque y no manda nada.
    await db.promotionSettings.create({ data: { accountId, sweptAt: now, classifiedAt: now, paused: true } });
    const off = await promotionsPass(db, { budgetMs: 60_000, now });
    expect(off).toMatchObject({ accounts: 1, planned: 1, applied: 0, pending: false });
    expect(sent).toEqual([]);
    expect(await db.promotionSlotItem.count({ where: { state: 'PLANNED' } })).toBeGreaterThan(0);
    // Con el freno suelto: manda la base que empieza hoy, una vez.
    await db.promotionSettings.update({ where: { accountId }, data: { paused: false } });
    const on = await promotionsPass(db, { budgetMs: 60_000, now });
    expect(on).toMatchObject({ planned: 0, applied: 2, failed: 0 });
    expect(sent.map((x) => x.what)).toEqual(['discount', 'discount']);
    expect((await promotionsPass(db, { budgetMs: 60_000, now })).applied).toBe(0);
    expect(await db.promotionLog.count({ where: { auto: true, kind: 'ON' } })).toBe(2);

    // La regla: recién publicado es nuevo a posicionar, pero lo puesto a mano no se pisa.
    const kept = await classifyAccount(db, { accountId, apply: true, now });
    expect(kept.changed).toEqual([]);
    expect(kept.products[0].lifecycle).toMatchObject({ now: 'GROWING', proposed: 'NEW', manual: true, changes: false });
    await db.productPromotion.update({ where: { productId }, data: { manual: [] } });
    const changed = await classifyAccount(db, { accountId, apply: true, now });
    expect(changed.changed).toEqual([productId]);
    expect(await db.productPromotion.findUniqueOrThrow({ where: { productId } })).toMatchObject({ lifecycle: 'NEW', why: { lifecycle: expect.stringContaining('menos de 60') } });
    // Con un competidor más barato que el sin cuotas, cargado en el producto o en una publicación: pelea por precio.
    await db.competitorListing.create({ data: { publicationId: twelve, title: 'Otro vendedor', listPrice: listOf(0) + 50_000, position: 0 } });
    expect((await classifyAccount(db, { accountId, apply: false, now })).products[0].competition).toMatchObject({ proposed: null, changes: false });
    await db.competitorListing.create({ data: { productId, title: 'El más barato', listPrice: listOf(0), discountPct: 10, position: 1 } });
    const fight = await classifyAccount(db, { accountId, apply: true, now });
    expect(fight.products[0].facts.competitorPrice).toBe(Math.round(listOf(0) * 0.9));
    expect(await db.productPromotion.findUniqueOrThrow({ where: { productId } })).toMatchObject({ competition: 'PRICE_FIGHT' });
  });

  it('un producto nace en Manual con lo que ya tiene inscripto; pasa a Automático preguntando por lo que las reglas no incluirían, y vuelve a Manual con sus franjas', async () => {
    const { adoptExisting, clearManualPlan, modeConflicts, setMode } = await import('@/lib/promo/mode');
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue } = await import('@/lib/promo/apply');
    const { loadProductGrid } = await import('@/lib/promo/view');
    const { hasNoEnd } = await import('@/domain/promo/plan');
    // Sin haber tocado nada, está en Manual. En el canal ya tiene un descuento propio en sin cuotas y está adentro de una campaña en 12 cuotas.
    await db.productPromotion.deleteMany();
    await db.publication.update({ where: { id: flat }, data: { discount: 10 } });
    await db.channelCopy.update({ where: { publicationId: flat }, data: { discount: 10 } });
    await invite(twelve, 12, { status: 'active', join: null, canLeave: true, price: priceForMargin(eco(12, listOf(12)), 12), start: day(-2), finish: day(20) });
    expect((await loadProductGrid(db, accountId, productId, now))!.mode).toBe('MANUAL');
    // En Manual las reglas no arman nada.
    expect(await generatePlan(db, { accountId, productId, now })).toMatchObject({ skipped: expect.stringContaining('Está en Manual'), created: 0 });
    expect(await db.promotionSlot.count()).toBe(0);

    // Nace con lo que el canal ya muestra: el descuento propio como franja sin fin y la campaña, cada una solo con su publicación.
    expect(await adoptExisting(db, { accountId, productId, now })).toEqual({ adopted: 2 });
    expect(await adoptExisting(db, { accountId, productId, now })).toEqual({ adopted: 0 });
    const born = await db.promotionSlot.findMany({ orderBy: { kind: 'asc' }, include: { items: true } });
    expect(born.map((s) => [s.kind, s.source, s.items.map((i) => [i.publicationId, i.state, i.fixed])])).toEqual([
      ['CAMPAIGN', 'MANUAL', [[twelve, 'ON', true]]],
      ['OWN_DISCOUNT', 'MANUAL', [[flat, 'ON', true]]],
    ]);
    const own = born.find((s) => s.kind === 'OWN_DISCOUNT')!;
    const campaign = born.find((s) => s.kind === 'CAMPAIGN')!;
    expect(hasNoEnd(own.finish)).toBe(true);
    expect(Number(own.items[0].discountPct)).toBe(10);
    // Nada de esto tocó el canal, y no hay nada para ejecutar.
    expect(sent).toEqual([]);
    expect((await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now })).done).toEqual([]);

    // Antes de pasar a Automático: recién publicado, la regla lo pone como nuevo, que lleva base y no eventos sin ventas.
    // El descuento propio sigue con la base; de la campaña hay que decidir.
    const conflicts = await modeConflicts(db, { accountId, productId, now });
    expect(conflicts.map((c) => [c.slotId, c.name, c.publications.map((p) => p.externalId)])).toEqual([[campaign.id, 'HOT SALE', ['MLA2']]]);
    // Se pasa sacando la campaña del canal.
    const toAuto = await setMode(db, { accountId, productId, mode: 'AUTO', takeOut: [campaign.id], userId: null, now });
    expect(toAuto).toMatchObject({ mode: 'AUTO', kept: 1 });
    expect(toAuto.takenOut.map((t) => [t.externalId, t.ok])).toEqual([['MLA2', true]]);
    expect(sent).toEqual([{ what: 'leave', publicationId: twelve, value: priceForMargin(eco(12, listOf(12)), 12) }]);
    expect(await db.productPromotion.findUniqueOrThrow({ where: { productId } })).toMatchObject({ mode: 'AUTO', lifecycle: 'NEW' });
    // Las reglas armaron su base, aunque siga la franja sin fin.
    const base = await db.promotionSlot.findMany({ where: { source: 'PLAN', layer: 'BASE' }, orderBy: { start: 'asc' } });
    expect(base.length).toBeGreaterThan(2);
    // Al prenderse la base, reemplaza al descuento que tenía: la franja sin fin queda terminada.
    sent.length = 0;
    const applied = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now });
    expect(applied.done.map((d) => [d.externalId, d.action, d.ok])).toEqual([
      ['MLA1', 'ON', true],
      ['MLA2', 'ON', true],
    ]);
    expect(await db.promotionSlotItem.findFirstOrThrow({ where: { slotId: own.id } })).toMatchObject({ state: 'ENDED' });

    // De vuelta a Manual: las franjas de las reglas quedan para editarlas, con sus precios.
    const toManual = await setMode(db, { accountId, productId, mode: 'MANUAL', userId: null, now });
    expect(toManual).toMatchObject({ mode: 'MANUAL', removed: 0, kept: base.length });
    expect(await db.promotionSlot.count({ where: { source: 'PLAN' } })).toBe(0);
    expect(await db.promotionSlotItem.count({ where: { slotId: base[1].id, fixed: true } })).toBe(2);
    // En Manual, lo que estaba por entrar sigue en el plan y la app lo ejecuta en su fecha.
    sent.length = 0;
    const later = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: day(14) });
    expect(later.done.every((d) => d.ok && d.action === 'ON')).toBe(true);
    expect(sent.map((x) => x.what)).toEqual(['discount', 'discount']);
    // Borrar lo planeado saca solo lo que no empezó.
    const removed = await clearManualPlan(db, { accountId, productId, now: day(14) });
    expect(removed).toBe(base.length - 2);
    expect(await db.promotionSlot.count({ where: { layer: 'BASE', finish: { gt: day(14) }, id: { not: own.id } } })).toBe(1);
    // En Automático no se borra a mano.
    await setMode(db, { accountId, productId, mode: 'AUTO', userId: null, now: day(14) });
    await expect(clearManualPlan(db, { accountId, productId, now: day(14) })).rejects.toThrow('primero pasalo a Manual');
  });

  it('al pasar a Automático, una campaña que las reglas también llevan pasa a ser de ellas: lo que ya está adentro sigue y deciden las demás publicaciones', async () => {
    const { adoptExisting, modeConflicts, setMode } = await import('@/lib/promo/mode');
    // En Manual, con el ciclo de vida puesto a mano en madurada, que lleva eventos. La de 12 cuotas ya está adentro; la sin cuotas está invitada.
    await db.productPromotion.update({ where: { productId }, data: { mode: 'MANUAL', lifecycle: 'MATURE', manual: ['lifecycle'] } });
    await invite(flat, 0);
    await invite(twelve, 12, { status: 'active', join: null, canLeave: true, price: priceForMargin(eco(12, listOf(12)), 12) });
    await adoptExisting(db, { accountId, productId, now });
    const slot = await db.promotionSlot.findFirstOrThrow({ include: { items: true } });
    expect(slot).toMatchObject({ source: 'MANUAL', group: 'DEAL:P-1' });
    expect(slot.items.map((i) => i.publicationId)).toEqual([twelve]);
    // Las reglas también llevan esa campaña: no hay nada que preguntar.
    expect(await modeConflicts(db, { accountId, productId, now })).toEqual([]);
    const r = await setMode(db, { accountId, productId, mode: 'AUTO', userId: null, now });
    expect(r).toMatchObject({ kept: 1, removed: 0, takenOut: [] });
    const after = await db.promotionSlot.findUniqueOrThrow({ where: { id: slot.id }, include: { items: true } });
    expect(after.source).toBe('PLAN');
    expect(new Map(after.items.map((i) => [i.publicationId, i.state]))).toEqual(new Map([[twelve, 'ON'], [flat, 'PLANNED']]));
    expect(await db.promotionSlot.count({ where: { group: 'DEAL:P-1' } })).toBe(1);
    expect(sent).toEqual([]);
  });

  it('en Manual se arma el almanaque a mano: descuento propio con fechas, una campaña del canal, lo que se pisa y una reserva', async () => {
    const { enrollManual, quoteEnroll, repriceManual } = await import('@/lib/promo/enroll');
    const { applyDue, dueActions } = await import('@/lib/promo/apply');
    const { adoptExisting } = await import('@/lib/promo/mode');
    const { hasNoEnd } = await import('@/domain/promo/plan');
    const both = (by: 'MARGIN' | 'PRICE' | 'PCT', value: number) => [flat, twelve].map((publicationId) => ({ publicationId, by, value }));
    // En Automático no se arma a mano.
    await expect(enrollManual(db, { accountId, input: { productId, kind: 'OWN_DISCOUNT', rows: both('MARGIN', 20) }, now })).rejects.toThrow('primero pasalo a Manual');
    await db.productPromotion.update({ where: { productId }, data: { mode: 'MANUAL' } });

    // Lo que quedaría, sin guardar: cada una con su precio, con el costo de sus cuotas. Debajo del piso avisa y deja seguir.
    const low = await quoteEnroll(db, { accountId, input: { productId, kind: 'OWN_DISCOUNT', rows: both('MARGIN', 6) }, now });
    expect(low.rows.map((r) => [r.problem, r.warning?.includes('menos que el piso de 10 %')])).toEqual([[null, true], [null, true]]);
    // Lo que el canal no va a aceptar no entra: un descuento propio de menos de 5 %.
    const tiny = await quoteEnroll(db, { accountId, input: { productId, kind: 'OWN_DISCOUNT', rows: both('PCT', 3) }, now });
    expect(tiny.rows.every((r) => r.problem?.includes('menos de 5 %'))).toBe(true);
    await expect(enrollManual(db, { accountId, input: { productId, kind: 'OWN_DISCOUNT', rows: both('PCT', 3) }, now })).rejects.toThrow('No se pudo inscribir ninguna');
    expect(await db.promotionSlot.count()).toBe(0);

    // Descuento propio desde hoy, sin fin, buscando 20 % en cada una.
    const own = await enrollManual(db, { accountId, input: { productId, kind: 'OWN_DISCOUNT', rows: both('MARGIN', 20) }, now });
    if (!own.saved) throw new Error('no guardó');
    expect(own).toMatchObject({ enrolled: 2, skipped: [], cut: 0 });
    const ownSlot = await db.promotionSlot.findUniqueOrThrow({ where: { id: own.slotId }, include: { items: true } });
    expect(ownSlot).toMatchObject({ source: 'MANUAL', kind: 'OWN_DISCOUNT', layer: 'BASE' });
    expect(hasNoEnd(ownSlot.finish)).toBe(true);
    for (const i of ownSlot.items) {
      expect(i).toMatchObject({ state: 'PLANNED', fixed: true, priceBy: 'MARGIN' });
      expect(Number(i.marginPct)).toBeGreaterThanOrEqual(20);
      expect(Number(i.discountPct)).toBeGreaterThanOrEqual(5);
    }
    // Nada se mandó al guardar. La app lo ejecuta en su fecha.
    expect(sent).toEqual([]);
    const first = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now });
    expect(first.done.map((d) => [d.externalId, d.action, d.ok])).toEqual([
      ['MLA1', 'ON', true],
      ['MLA2', 'ON', true],
    ]);
    expect(sent.map((x) => x.what)).toEqual(['discount', 'discount']);
    // Las reglas no la vuelven a decidir: sigue con el precio que se cargó, aunque cambie el costo.
    await db.product.update({ where: { id: productId }, data: { replacementCost: COST * 1.3 } });
    await adoptExisting(db, { accountId, productId, now });
    expect((await db.promotionSlotItem.findMany({ where: { slotId: own.slotId } })).every((i) => i.state === 'ON')).toBe(true);
    await db.product.update({ where: { id: productId }, data: { replacementCost: COST } });

    // Una campaña del canal, del día 10 al 17. Fuera de lo que acepta el canal, no entra.
    await invite(flat, 0);
    await invite(twelve, 12);
    const tooHigh = await quoteEnroll(db, { accountId, input: { productId, kind: 'CAMPAIGN', group: 'DEAL:P-1', rows: [{ publicationId: flat, by: 'PRICE', value: listOf(0) - 10 }] }, now });
    expect(tooHigh.rows[0].problem).toContain('o menos en esta campaña');
    // Se pisa con el descuento propio: sin decir qué hacer, no guarda y dice con qué.
    const asked = await enrollManual(db, { accountId, input: { productId, kind: 'CAMPAIGN', group: 'DEAL:P-1', rows: both('MARGIN', 15) }, now });
    expect(asked.saved).toBe(false);
    expect(asked.quote.overlaps.map((o) => [o.externalId, o.name, o.canCut])).toEqual([
      ['MLA1', 'Descuento propio', true],
      ['MLA2', 'Descuento propio', true],
    ]);
    expect(await db.promotionSlot.count()).toBe(1);
    // Cortando la anterior: el descuento propio termina cuando empieza la campaña.
    const cut = await enrollManual(db, { accountId, input: { productId, kind: 'CAMPAIGN', group: 'DEAL:P-1', rows: both('MARGIN', 15), overlap: 'cut' }, now });
    if (!cut.saved) throw new Error('no guardó');
    expect(cut).toMatchObject({ enrolled: 2, cut: 2 });
    expect((await db.promotionSlot.findUniqueOrThrow({ where: { id: own.slotId } })).finish).toEqual(day(10));
    const campaign = await db.promotionSlot.findUniqueOrThrow({ where: { id: cut.slotId }, include: { items: true } });
    expect(campaign).toMatchObject({ kind: 'CAMPAIGN', layer: 'EVENT', group: 'DEAL:P-1', name: 'HOT SALE', start: day(10), finish: day(17) });
    expect(Number(campaign.items.find((i) => i.publicationId === flat)!.price)).toBe(priceForMargin(eco(0, listOf(0)), 15));
    // Antes de que entre se le puede cambiar el precio a una; ya adentro, no.
    const item = campaign.items.find((i) => i.publicationId === twelve)!;
    const repriced = await repriceManual(db, { accountId, itemId: item.id, by: 'MARGIN', value: 16 });
    expect(repriced.marginPct).toBeGreaterThanOrEqual(16);
    const on = await db.promotionSlotItem.findFirstOrThrow({ where: { slotId: own.slotId } });
    await expect(repriceManual(db, { accountId, itemId: on.id, by: 'PCT', value: 12 })).rejects.toThrow('Ya está en el canal');

    // Una reserva para un evento que todavía no tiene invitación: no hay nada para mandar hasta que llegue.
    const event = await db.promotionEvent.create({ data: { accountId, name: 'Cyber Monday', tier: 'T1', start: day(40), finish: day(47), match: 'cyber' } });
    const reserve = await enrollManual(db, { accountId, input: { productId, kind: 'RESERVE', eventId: event.id, rows: both('MARGIN', 14) }, now });
    if (!reserve.saved) throw new Error('no guardó');
    const waiting = await db.promotionSlot.findUniqueOrThrow({ where: { id: reserve.slotId }, include: { items: true } });
    expect(waiting).toMatchObject({ kind: 'CAMPAIGN', group: null, eventId: event.id, name: 'Cyber Monday', start: day(40) });
    expect(waiting.items.every((i) => i.state === 'PLANNED' && i.price === null && Number(i.priceValue) === 14)).toBe(true);
    expect((await dueActions(db, { accountId, joinLeadDays: 3, now: day(39) })).filter((d) => d.slotId === reserve.slotId)).toEqual([]);
    // Llega la invitación del canal, solo para la sin cuotas: la reserva pasa a ser de esa campaña, con el precio que se había cargado.
    const cyberList = listOf(0);
    await db.channelPromotionItem.create({
      data: { publicationId: flat, group: 'DEAL:P-7', ref: JSON.stringify(['DEAL', 'P-7', null]), type: 'DEAL', name: 'CYBER MONDAY 2027', kind: 'Campaña tradicional', status: 'invited', join: 'price', start: day(41), finish: day(46), maxPrice: cyberList - 1, listPrice: cyberList, seenAt: now },
    });
    await adoptExisting(db, { accountId, productId, now });
    const bound = await db.promotionSlot.findUniqueOrThrow({ where: { id: reserve.slotId }, include: { items: true } });
    expect(bound).toMatchObject({ group: 'DEAL:P-7', name: 'CYBER MONDAY 2027', start: day(41), finish: day(46) });
    expect(bound.items.find((i) => i.publicationId === flat)).toMatchObject({ state: 'PLANNED', ref: JSON.stringify(['DEAL', 'P-7', null]) });
    expect(Number(bound.items.find((i) => i.publicationId === flat)!.price)).toBe(priceForMargin(eco(0, cyberList), 14));
    expect(bound.items.find((i) => i.publicationId === twelve)).toMatchObject({ state: 'OUT', reason: 'NOT_INVITED' });
  });

  it('en Manual, en una campaña del canal se puede entrar más tarde y salir antes: la app lo hace sola esos días', async () => {
    const { enrollManual } = await import('@/lib/promo/enroll');
    const { applyDue, dueActions } = await import('@/lib/promo/apply');
    await db.productPromotion.update({ where: { productId }, data: { mode: 'MANUAL' } });
    await invite(flat, 0);
    // La campaña va del día 10 al 17: se entra el 12 y se sale el 14.
    const r = await enrollManual(db, { accountId, input: { productId, kind: 'CAMPAIGN', group: 'DEAL:P-1', start: day(12), finish: day(14), rows: [{ publicationId: flat, by: 'MARGIN', value: 15 }] }, now });
    if (!r.saved) throw new Error('no guardó');
    expect(await db.promotionSlot.findUniqueOrThrow({ where: { id: r.slotId } })).toMatchObject({ start: day(12), finish: day(14) });
    // Fuera de la ventana del canal no se puede: queda en las fechas de la campaña.
    const wide = await enrollManual(db, { accountId, input: { productId, kind: 'CAMPAIGN', group: 'DEAL:P-1', start: day(1), finish: day(60), rows: [{ publicationId: flat, by: 'MARGIN', value: 15 }], overlap: 'keep' }, now });
    if (!wide.saved) throw new Error('no guardó');
    expect(await db.promotionSlot.findUniqueOrThrow({ where: { id: wide.slotId } })).toMatchObject({ start: day(10), finish: day(17) });
    await db.promotionSlot.delete({ where: { id: wide.slotId } });
    // No entra antes del 12, aunque la campaña ya empezó.
    expect(await dueActions(db, { accountId, joinLeadDays: 3, now: day(11) })).toEqual([]);
    const joined = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: day(12) });
    expect(joined.done.map((d) => [d.externalId, d.action, d.ok, d.state])).toEqual([['MLA1', 'ON', true, 'ON']]);
    // El canal la muestra adentro, y la campaña sigue hasta el 17: el 14 la app la saca.
    await db.channelPromotionItem.updateMany({ where: { publicationId: flat }, data: { status: 'active', canLeave: true } });
    sent.length = 0;
    expect((await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: day(13) })).done).toEqual([]);
    const left = await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now: day(14) });
    expect(left.done.map((d) => [d.externalId, d.action, d.ok, d.state])).toEqual([['MLA1', 'OFF', true, 'ENDED']]);
    expect(sent.map((x) => x.what)).toEqual(['leave']);
  });

  it('a los días mide el antes y el después y lo deja en la bitácora', async () => {
    const { generatePlan } = await import('@/lib/promo/plan');
    const { applyDue } = await import('@/lib/promo/apply');
    const { measureDue } = await import('@/lib/promo/measure');
    await generatePlan(db, { accountId, productId, now });
    await applyDue(db, { accountId, auto: true, userId: null, budgetMs: 60_000, now });
    const utc = (n: number) => new Date(Date.UTC(2026, 11, 1 + n));
    await db.publicationVisitDay.createMany({
      data: [-3, -2, -1].map((n) => ({ publicationId: flat, day: utc(n), visits: 10 })).concat([0, 1, 2].map((n) => ({ publicationId: flat, day: utc(n), visits: 30 }))),
    });
    // Todavía no llegó el día.
    expect((await measureDue(db, { accountId, budgetMs: 60_000, now: day(3) })).measured).toEqual([]);
    const m = await measureDue(db, { accountId, budgetMs: 60_000, now: day(9) });
    const mine = m.measured.find((x) => x.publicationId === flat)!;
    expect(mine.measurement).toMatchObject({ days: 7, before: { visits: 30, units: 0 }, after: { visits: 90, units: 0 } });
    const log = await db.promotionLog.findFirstOrThrow({ where: { publicationId: flat, kind: 'MEASURE' } });
    expect(log.text).toContain('visitas 30 → 90');
    // No se mide dos veces.
    expect((await measureDue(db, { accountId, budgetMs: 60_000, now: day(10) })).measured).toEqual([]);
  });
});
