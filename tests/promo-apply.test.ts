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
    await db.productPromotion.create({ data: { productId, lifecycle: 'GROWING', manual: ['lifecycle'] } });
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

  it('la pasada de cada hora: arma el almanaque que falta y, solo con la ejecución automática prendida, manda lo que toca', async () => {
    const { promotionsPass } = await import('@/lib/promo/run');
    const { classifyAccount } = await import('@/lib/promo/classify');
    // Una cuenta que no usa Promociones no se toca.
    expect(await promotionsPass(db, { budgetMs: 60_000, now })).toMatchObject({ accounts: 0, planned: 0, applied: 0 });
    // Con las invitaciones y la clasificación al día, y la ejecución automática apagada: arma el almanaque y no manda nada.
    await db.promotionSettings.create({ data: { accountId, sweptAt: now, classifiedAt: now } });
    const off = await promotionsPass(db, { budgetMs: 60_000, now });
    expect(off).toMatchObject({ accounts: 1, planned: 1, applied: 0, pending: false });
    expect(sent).toEqual([]);
    expect(await db.promotionSlotItem.count({ where: { state: 'PLANNED' } })).toBeGreaterThan(0);
    // Prendida: manda la base que empieza hoy, una vez.
    await db.promotionSettings.update({ where: { accountId }, data: { autoApply: true } });
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
