import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { chooseMain, optionListPrice, planMainOptions, samePlanOptions, type OptionRow } from '@/domain/sale-options';
import { PRICING_DEFAULTS } from '@/domain/pricing';
import { planClash } from '@/lib/channel-push';
import { setProductCosts } from '@/lib/costs';
import { loadPriceStep, normalizeFromOption, saveFlatPrice, saveOptionPrice, savePriceDecision } from '@/lib/pricing';
import { flatProfit, optionPriceForProfit, resultAt } from '@/domain/option-table';
import { statusReasonOf } from '@/channels/mercadolibre/listings';
import { familyMeasures, type FamilyMember } from '@/lib/families';
import { assignSaleOptions, loadSaleOptions, SaleOptionError, setMainOption } from '@/lib/sale-options';

// Opciones de venta: varias publicaciones del canal para la misma medida.
// Datos inventados.

const row = (id: string, extra: Partial<OptionRow> = {}): OptionRow => ({
  id,
  channelProductId: 'UP-1',
  mainOptionId: null,
  status: 'ACTIVE',
  pipelineStatus: 'UNTOUCHED',
  familyLead: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...extra,
});

describe('la opción principal de cada medida', () => {
  it('se queda la que ya era principal, aunque esté finalizada', () => {
    const group = [row('a', { status: 'CLOSED' }), row('b', { mainOptionId: 'a' }), row('c', { mainOptionId: 'a' })];
    expect(chooseMain(group).id).toBe('a');
  });

  it('sin principal, gana la que tiene trabajo de pipeline, después la que se vende y después la más vieja', () => {
    expect(chooseMain([row('a'), row('b', { status: 'PAUSED', pipelineStatus: 'IN_PIPELINE' })]).id).toBe('b');
    expect(chooseMain([row('a', { status: 'PAUSED' }), row('b', { familyLead: true, status: 'CLOSED' })]).id).toBe('b');
    expect(chooseMain([row('a', { status: 'PAUSED' }), row('b')]).id).toBe('b');
    expect(chooseMain([row('b', { createdAt: new Date('2026-02-01') }), row('a', { createdAt: new Date('2026-03-01') })]).id).toBe('b');
  });

  it('cada otra opción apunta a la principal; las que van solas o salieron del grupo no apuntan a nadie', () => {
    const rows = [
      row('a', { pipelineStatus: 'IN_PIPELINE' }),
      row('b'),
      row('c', { channelProductId: 'UP-2', mainOptionId: 'a' }),
      row('d', { channelProductId: null }),
    ];
    expect(planMainOptions(rows)).toEqual(new Map([['b', 'a'], ['c', null]]));
    // Sin cambios, no devuelve nada.
    expect(planMainOptions([row('a'), row('b', { mainOptionId: 'a' })]).size).toBe(0);
  });

  it('avisa cuando dos opciones vivas de la misma medida tienen la misma forma de cobro', () => {
    const options = [
      { id: 'a', status: 'ACTIVE' as const, installments: 3 },
      { id: 'b', status: 'PAUSED' as const, installments: 3 },
      { id: 'c', status: 'CLOSED' as const, installments: 0 },
      { id: 'd', status: 'ACTIVE' as const, installments: 0 },
      { id: 'e', status: 'CLOSED' as const, installments: 3 },
    ];
    expect(samePlanOptions(options)).toEqual([{ plan: 3, label: '3 cuotas', options: [options[0], options[1]] }]);
  });

  it('la familia muestra cada medida una vez, con sus otras opciones adentro', () => {
    const m = (id: string, mainOptionId: string | null = null): FamilyMember => ({
      id, externalId: id, url: null, title: null, variantKey: null, measure: null, channelStatus: 'ACTIVE', price: null, ownPrice: false, lead: false, mainOptionId,
    });
    const measures = familyMeasures([m('std'), m('050'), m('050-b', '050'), m('suelta', 'de-otra-familia')]);
    expect(measures.map((x) => [x.id, x.options.map((o) => o.id)])).toEqual([['std', []], ['050', ['050-b']], ['suelta', []]]);
  });

  it('el precio de otra opción: el mismo costo y margen, con lo que cuesta su forma de cobro', () => {
    // (1,2 × 100.000 + 10.890) / 0,584446, con la cuota promocionada al 5 %.
    expect(optionListPrice({ cost: 100_000, marginPct: 20, params: PRICING_DEFAULTS, plan: 1, discountPct: 0 })).toBe(223_956);
    // Sin cuotas: divisor 0,634446.
    expect(optionListPrice({ cost: 100_000, marginPct: 20, params: PRICING_DEFAULTS, plan: 0, discountPct: 0 })).toBe(206_306);
    // Con descuento, el publicado sube para que el comprador pague lo mismo.
    expect(optionListPrice({ cost: 100_000, marginPct: 20, params: PRICING_DEFAULTS, plan: 0, discountPct: 10 })).toBe(229_229);
    expect(optionListPrice({ cost: 100_000, marginPct: 20, params: { ...PRICING_DEFAULTS, installments6Pct: null }, plan: 6, discountPct: 0 })).toBeNull();
  });

  it('el motivo del estado, en palabras, sin perder los que no conoce', () => {
    expect(statusReasonOf({ sub_status: [] })).toBeNull();
    expect(statusReasonOf({})).toBeNull();
    expect(statusReasonOf({ sub_status: ['waiting_for_patch'] })).toBe('Mercado Libre pide corregir datos para volver a activarla.');
    expect(statusReasonOf({ sub_status: ['deleted', 'algo_nuevo'] })).toBe('Eliminada. Motivo de Mercado Libre: algo_nuevo.');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('agrupar las opciones de venta en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = '';
  let productId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  let accountId = '';
  let userId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE listing_families, channel_copies, channel_sync_changes, title_works, description_drafts, price_decisions, pipeline_movements, publications, products, stores, channels, accounts, users CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    accountId = account.id;
    userId = (await db.user.create({ data: { id: 'u-juani', name: 'Juani', email: 'juani@prueba.com' } })).id;
    storeId = (await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } })).id;
    productId = (await db.product.create({ data: { accountId: account.id, name: 'Subconjunto SP-1' } })).id;
  });

  const listing = async (externalId: string, channelProductId: string | null, extra: { status?: 'ACTIVE' | 'PAUSED' | 'CLOSED'; installments?: number; inPipeline?: boolean } = {}) => {
    const p = await db.publication.create({
      data: { productId, storeId, externalId, title: 'Subconjunto', ...(extra.inPipeline ? { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'INFO' } : {}) },
    });
    await db.channelCopy.create({
      data: { publicationId: p.id, readAt: new Date(), status: extra.status ?? 'ACTIVE', installments: extra.installments ?? 3, channelProductId },
    });
    return p;
  };

  it('agrupa por la medida del canal, deja como principal la del pipeline y no cambia nada la segunda vez', async () => {
    const worked = await listing('MLA1', 'UP-050', { status: 'CLOSED', inPipeline: true });
    const live = await listing('MLA2', 'UP-050', { installments: 1 });
    const alone = await listing('MLA3', 'UP-STD');
    const unknown = await listing('MLA4', null);
    expect(await assignSaleOptions(db, storeId)).toBe(1);
    const byId = async (id: string) => (await db.publication.findUniqueOrThrow({ where: { id } })).mainOptionId;
    expect(await byId(worked.id)).toBeNull();
    expect(await byId(live.id)).toBe(worked.id);
    expect(await byId(alone.id)).toBeNull();
    expect(await byId(unknown.id)).toBeNull();
    expect(await assignSaleOptions(db, storeId)).toBe(0);

    // Si la otra opción pasa a otra medida, deja de apuntar.
    await db.channelCopy.update({ where: { publicationId: live.id }, data: { channelProductId: 'UP-OTRA' } });
    expect(await assignSaleOptions(db, storeId)).toBe(1);
    expect(await byId(live.id)).toBeNull();
  });

  it('muestra las opciones de la medida con su forma de cobro y avisa las repetidas', async () => {
    const main = await listing('MLA1', 'UP-050', { installments: 3 });
    const other = await listing('MLA2', 'UP-050', { installments: 1, status: 'PAUSED' });
    await listing('MLA3', 'UP-050', { installments: 3, status: 'PAUSED' });
    await assignSaleOptions(db, storeId);
    await db.channelCopy.update({ where: { publicationId: other.id }, data: { statusReason: 'Mercado Libre la pausó.', price: 286281 } });
    const data = await loadSaleOptions(db, other.id);
    expect(data?.mainId).toBe(main.id);
    expect(data?.options.map((o) => [o.externalId, o.planLabel, o.main])).toEqual([
      ['MLA1', '3 cuotas', true],
      ['MLA2', 'Cuota promocionada', false],
      ['MLA3', '3 cuotas', false],
    ]);
    expect(data?.options[1]).toMatchObject({ price: 286281, status: 'PAUSED', statusReason: 'Mercado Libre la pausó.' });
    expect(data?.samePlan).toEqual([{ plan: 3, label: '3 cuotas', codes: ['MLA1', 'MLA3'] }]);
    expect(await loadSaleOptions(db, (await listing('MLA9', 'UP-SOLA')).id)).toBeNull();
  });

  it('cambiar la principal pasa el trabajo del pipeline a la nueva, deja el de ella en la vieja y queda en el registro', async () => {
    const old = await listing('MLA1', 'UP-050', { status: 'CLOSED', inPipeline: true });
    const live = await listing('MLA2', 'UP-050');
    const third = await listing('MLA3', 'UP-050', { installments: 1 });
    await assignSaleOptions(db, storeId);
    await db.publication.update({ where: { id: old.id }, data: { pipelineStep: 'PRICE', title: 'Título trabajado', faq: '<p>Trae juntas.</p>' } });
    await db.titleWork.create({ data: { publicationId: old.id, words: { motor: 'use' } } });
    await db.titleWork.create({ data: { publicationId: live.id, words: { viejo: 'discard' } } });
    await db.descriptionDraft.create({ data: { publicationId: old.id, text: 'Descripción propuesta', model: 'x', usage: {}, costUsd: 0.1 } });
    await db.priceDecision.create({
      data: { publicationId: old.id, listPrice: 1000, finalPrice: 1000, cost: 500, marginPct: 30, minMarginPct: 15, params: {} },
    });
    await db.pipelineMovement.create({ data: { publicationId: old.id, step: 'PRICE' } });

    const r = await setMainOption(db, { accountId, publicationId: third.id, mainId: live.id, userId, reason: 'Se finalizó MLA1.' });
    expect(r).toEqual({ changed: true, from: 'MLA1', to: 'MLA2' });
    const after = await db.publication.findUniqueOrThrow({ where: { id: live.id }, include: { titleWork: true, descriptionDraft: true, priceDecisions: true, pipelineMovements: true } });
    expect(after).toMatchObject({ mainOptionId: null, pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE', title: 'Título trabajado', faq: '<p>Trae juntas.</p>' });
    expect(after.titleWork?.words).toEqual({ motor: 'use' });
    expect(after.descriptionDraft?.text).toBe('Descripción propuesta');
    expect(after.priceDecisions).toHaveLength(1);
    expect(after.pipelineMovements).toHaveLength(1);
    const before = await db.publication.findUniqueOrThrow({ where: { id: old.id }, include: { titleWork: true, descriptionDraft: true } });
    expect(before).toMatchObject({ mainOptionId: live.id, pipelineStatus: 'UNTOUCHED' });
    // Lo que tenía la nueva queda en la vieja: no se pierde.
    expect(before.titleWork?.words).toEqual({ viejo: 'discard' });
    expect(before.descriptionDraft).toBeNull();
    expect((await db.publication.findUniqueOrThrow({ where: { id: third.id } })).mainOptionId).toBe(live.id);
    const log = await db.channelSyncChange.findMany({ where: { kind: 'MAIN_OPTION_CHANGED' }, orderBy: { publicationId: 'asc' } });
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ before: { externalId: 'MLA1' }, after: { externalId: 'MLA2' }, message: 'Se finalizó MLA1.', userId });
    // La lectura siguiente respeta la elección.
    expect(await assignSaleOptions(db, storeId)).toBe(0);

    // Elegir la que ya es principal no cambia nada; una de otra medida no se puede.
    expect((await setMainOption(db, { accountId, publicationId: old.id, mainId: live.id, userId, reason: 'x' })).changed).toBe(false);
    const elsewhere = await listing('MLA8', 'UP-STD');
    await expect(setMainOption(db, { accountId, publicationId: live.id, mainId: elsewhere.id, userId, reason: 'x' })).rejects.toThrow(SaleOptionError);
  });

  it('en una familia, si la vieja era la principal de la familia, la familia pasa a la nueva', async () => {
    const old = await listing('MLA1', 'UP-050', { inPipeline: true, status: 'CLOSED' });
    const live = await listing('MLA2', 'UP-050', { inPipeline: true });
    const std = await listing('MLA5', 'UP-STD', { inPipeline: true });
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId: old.id, members: { connect: [{ id: old.id }, { id: live.id }, { id: std.id }] } } });
    await assignSaleOptions(db, storeId);
    expect((await db.publication.findUniqueOrThrow({ where: { id: live.id } })).mainOptionId).toBe(old.id);
    await setMainOption(db, { accountId, publicationId: old.id, mainId: live.id, userId, reason: 'x' });
    expect((await db.listingFamily.findUniqueOrThrow({ where: { id: family.id } })).leadId).toBe(live.id);
  });

  it('al guardar el precio, cada otra opción toma el suyo con su forma de cobro, y nunca se le cambian las cuotas', async () => {
    const product = await db.product.create({ data: { accountId, name: 'Subconjunto SP-9', variants: { create: [{ sku: 'SP-9-00', measure: 'STD', position: 0 }] } } });
    await setProductCosts(db, { accountId, productId: product.id, costs: { '': '100000' } });
    const main = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA20', title: 'Subconjunto' } });
    const other = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA21', title: 'Subconjunto' } });
    for (const [p, installments, status] of [[main, 3, 'ACTIVE'], [other, 1, 'PAUSED']] as const) {
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status, installments, price: 1, discount: 0, channelProductId: 'UP-SP9' } });
    }
    await assignSaleOptions(db, storeId);

    const r = await savePriceDecision(db, { accountId, publicationId: main.id, userId: null, listPrice: 238_224, discountPct: 0, plan: 3, overrides: {}, confirmBelowMin: true });
    expect(r.simulation.marginPct).toBeCloseTo(20, 1);
    expect(r.options).toEqual([expect.objectContaining({ externalId: 'MLA21', planLabel: 'Cuota promocionada', listPrice: expect.any(Number), reason: null })]);
    const after = await db.publication.findUniqueOrThrow({ where: { id: other.id }, include: { priceDecisions: true } });
    // Su forma de cobro sigue siendo la suya: no toma las 3 cuotas de la principal.
    expect(after).toMatchObject({ installments: 1, ownPrice: true });
    expect(Number(after.price)).toBe(r.options[0].listPrice);
    expect(Number(after.priceDecisions[0].marginPct)).toBeCloseTo(20, 0);
    expect(Number((await db.publication.findUniqueOrThrow({ where: { id: main.id } })).price)).toBe(238_224);

    // Subir cuotas: a la otra opción nunca, y a la principal no si queda igual a una viva.
    expect(await planClash(db, { id: other.id, mainOptionId: main.id }, 3)).toContain('no se cambia desde la app');
    expect(await planClash(db, { id: main.id, mainOptionId: null }, 1)).toBe('MLA21 ya tiene cuota promocionada: con dos opciones iguales, el canal apaga una.');
    expect(await planClash(db, { id: main.id, mainOptionId: null }, 6)).toBeNull();
    await db.channelCopy.update({ where: { publicationId: other.id }, data: { status: 'CLOSED' } });
    expect(await planClash(db, { id: main.id, mainOptionId: null }, 1)).toBeNull();
  });

  it('desde el precio sin cuotas, cada opción queda con la misma ganancia, con su descuento, y no se tocan las finalizadas ni las frenadas', async () => {
    const product = await db.product.create({ data: { accountId, name: 'Subconjunto SP-8', variants: { create: [{ sku: 'SP-8-00', measure: 'STD', position: 0 }] } } });
    await setProductCosts(db, { accountId, productId: product.id, costs: { '': '100000' } });
    const pubs: Record<string, string> = {};
    const rows = [
      ['MLA30', 0, 'ACTIVE', 0, false],
      ['MLA31', 1, 'ACTIVE', 10, false],
      ['MLA32', 6, 'UNDER_REVIEW', 0, false],
      ['MLA33', 3, 'CLOSED', 0, false],
      ['MLA34', 12, 'ACTIVE', 0, true],
    ] as const;
    for (const [code, installments, status, discount, blocked] of rows) {
      const p = await db.publication.create({ data: { productId: product.id, storeId, externalId: code, title: 'Subconjunto' } });
      await db.channelCopy.create({
        data: { publicationId: p.id, readAt: new Date(), status, installments, price: 1, discount, statusBlocked: blocked, channelProductId: 'UP-SP8' },
      });
      pubs[code] = p.id;
    }
    await assignSaleOptions(db, storeId);
    expect((await db.publication.findUniqueOrThrow({ where: { id: pubs.MLA31 } })).mainOptionId).toBe(pubs.MLA30);

    const r = await saveFlatPrice(db, { accountId, publicationId: pubs.MLA30, userId, flatPrice: 250_000, confirmBelowMin: false });
    const profit = flatProfit(250_000, 100_000, PRICING_DEFAULTS);
    expect(r.main).toMatchObject({ id: pubs.MLA30, listPrice: 250_000, plan: 0 });
    const low = optionPriceForProfit({ profit, cost: 100_000, params: PRICING_DEFAULTS, plan: 1, discountPct: 10 })!;
    const six = optionPriceForProfit({ profit, cost: 100_000, params: PRICING_DEFAULTS, plan: 6, discountPct: 0 })!;
    expect(r.options).toEqual([
      expect.objectContaining({ externalId: 'MLA31', listPrice: low, reason: null, note: null }),
      expect.objectContaining({ externalId: 'MLA32', listPrice: six, reason: null, note: expect.stringContaining('revisando') }),
      expect.objectContaining({ externalId: 'MLA33', listPrice: null, reason: expect.stringContaining('finalizada') }),
      expect.objectContaining({ externalId: 'MLA34', listPrice: null, reason: expect.stringContaining('frenó') }),
    ]);
    // Con su descuento del 10 %, el comprador paga lo que deja la misma ganancia, unos pesos más por redondear para arriba.
    const paid = resultAt(low * 0.9, 100_000, PRICING_DEFAULTS, 1).profit;
    expect(paid).toBeGreaterThanOrEqual(profit - 0.01);
    expect(paid - profit).toBeLessThan(5);
    // Queda guardado en cada una, con su descuento y su forma de cobro, para subir.
    const saved = await db.publication.findMany({ where: { id: { in: Object.values(pubs) } }, select: { externalId: true, price: true, discount: true, installments: true } });
    const by = Object.fromEntries(saved.map((x) => [x.externalId, x]));
    expect(Number(by.MLA30.price)).toBe(250_000);
    expect(Number(by.MLA31.price)).toBe(low);
    expect(Number(by.MLA31.discount)).toBe(10);
    expect(by.MLA31.installments).toBe(1);
    expect(Number(by.MLA32.price)).toBe(six);
    expect(by.MLA33.price).toBeNull();
    expect(by.MLA34.price).toBeNull();
  });

  it('el paso Precio trae cada publicación de la pestaña, la principal y sus otras formas de cobro, con su precio', async () => {
    const product = await db.product.create({ data: { accountId, name: 'Subconjunto SP-7', variants: { create: [{ sku: 'SP-7-00', measure: 'STD', position: 0 }] } } });
    await setProductCosts(db, { accountId, productId: product.id, costs: { '': '100000' } });
    const main = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA40', title: 'Subconjunto', price: 250_000 } });
    const low = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA41', title: 'Subconjunto', price: 270_000 } });
    for (const [p, installments, price] of [[main, 0, 250_000], [low, 1, 270_000]] as const) {
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', installments, price, discount: 0, channelProductId: 'UP-SP7' } });
    }
    await assignSaleOptions(db, storeId);
    const step = (await loadPriceStep(db, accountId, main.id))!;
    expect(step.groups).toHaveLength(1);
    expect(step.groups[0].options).toEqual([
      expect.objectContaining({ id: main.id, externalId: 'MLA40', main: true, mainId: main.id, channelInstallments: 0, channelPrice: 250_000 }),
      expect.objectContaining({ id: low.id, externalId: 'MLA41', main: false, mainId: main.id, channelInstallments: 1, channelPrice: 270_000 }),
    ]);
  });

  it('una forma de cobro personalizada no se recalcula desde el sin cuotas, hasta normalizar todas según una', async () => {
    const product = await db.product.create({ data: { accountId, name: 'Subconjunto SP-6', variants: { create: [{ sku: 'SP-6-00', measure: 'STD', position: 0 }] } } });
    await setProductCosts(db, { accountId, productId: product.id, costs: { '': '100000' } });
    const main = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA50', title: 'Subconjunto' } });
    const low = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA51', title: 'Subconjunto' } });
    const six = await db.publication.create({ data: { productId: product.id, storeId, externalId: 'MLA52', title: 'Subconjunto' } });
    for (const [p, installments] of [[main, 0], [low, 1], [six, 6]] as const) {
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', installments, price: 1, discount: 0, channelProductId: 'UP-SP6' } });
    }
    await assignSaleOptions(db, storeId);

    // La principal se guarda con Guardar precio, no sola.
    await expect(saveOptionPrice(db, { accountId, publicationId: main.id, userId, listPrice: 300_000, discountPct: 0, confirmBelowMin: false })).rejects.toThrow('Es la principal');
    const own = await saveOptionPrice(db, { accountId, publicationId: low.id, userId, listPrice: 300_000, discountPct: 0, confirmBelowMin: false });
    expect(own.simulation.finalPrice).toBe(300_000);
    expect(await db.publication.findUniqueOrThrow({ where: { id: low.id } })).toMatchObject({ customPrice: true, installments: 1 });

    // Guardar desde el sin cuotas no la toca.
    const flat = await saveFlatPrice(db, { accountId, publicationId: main.id, userId, flatPrice: 250_000, confirmBelowMin: false });
    expect(flat.options.find((o) => o.externalId === 'MLA51')).toMatchObject({ listPrice: null, reason: expect.stringContaining('personalizado') });
    expect(Number((await db.publication.findUniqueOrThrow({ where: { id: low.id } })).price)).toBe(300_000);

    // Normalizar según la de 6 cuotas: el sin cuotas que deja la misma ganancia, y todas desde ahí, la personalizada también.
    const sixPrice = Number((await db.publication.findUniqueOrThrow({ where: { id: six.id } })).price);
    const norm = await normalizeFromOption(db, { accountId, publicationId: six.id, userId, listPrice: sixPrice, discountPct: 0, confirmBelowMin: false });
    expect(Math.abs(norm.flatPrice - 250_000)).toBeLessThanOrEqual(1);
    const lowAfter = await db.publication.findUniqueOrThrow({ where: { id: low.id } });
    expect(lowAfter.customPrice).toBe(false);
    expect(Number(lowAfter.price)).not.toBe(300_000);
  });
});
