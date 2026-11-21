import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { ChannelPromotionSweep, SellerPromotion, SweepItem } from '@/channels/promotion-sweep';
import { variantKey } from '@/domain/media';
import { PRICING_DEFAULTS } from '@/domain/pricing';
import { priceForMargin } from '@/domain/promo/entry';
import { setProductCosts } from '@/lib/costs';
import { loadOverview } from '@/lib/promo/overview';
import { generatePlan } from '@/lib/promo/plan';
import { loadPromoSettings, savePromoSettings } from '@/lib/promo/settings';
import { sweepInvitations } from '@/lib/promo/sweep';
import { setOptionsExcluded, setPromoTags } from '@/lib/promo/tags';
import { loadProductGrid } from '@/lib/promo/view';
import { TRANSACTION_OPTIONS } from '@/lib/transaction-options';

// Promociones con la base: una familia con dos medidas y seis formas de cobro
// en cada una, cada una publicada al precio que deja 30 %. Datos inventados.

const url = process.env.TEST_DATABASE_URL;
const PLANS = [0, 1, 3, 6, 9, 12] as const;
const COST = 100_000;
const eco = (plan: (typeof PLANS)[number], listPrice: number | null = null) => ({ cost: COST, params: PRICING_DEFAULTS, plan, listPrice });
const listOf = (plan: (typeof PLANS)[number]) => priceForMargin(eco(plan), 30)!;

describe.skipIf(!url)('promociones en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }), transactionOptions: TRANSACTION_OPTIONS });
  const now = new Date('2026-12-01T15:00:00Z');
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
  let accountId = '';
  let productId = '';
  let storeId = '';
  // Las publicaciones: code[medida][forma de cobro].
  const ids: Record<string, string> = {};

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE channel_connections, promotion_logs, promotion_slot_items, promotion_slots, promotion_events, channel_promotion_items, promotion_options, product_promotions, promotion_settings, listing_families, channel_copies, channel_sync_changes, price_decisions, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    const variants = [
      { sku: 'SP-9-00', measure: 'STD' },
      { sku: 'SP-9-60', measure: '0,60 mm' },
    ];
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-9', brand: 'Persan', variants: { create: variants.map((v, i) => ({ ...v, position: i })) } } })).id;
    await setProductCosts(db, { accountId, productId, costs: { [variantKey(variants[0])!]: String(COST), [variantKey(variants[1])!]: String(COST) } });
    const mains: string[] = [];
    for (const [m, v] of variants.entries()) {
      let main: string | null = null;
      for (const plan of PLANS) {
        const code = `MLA${m + 1}${String(plan).padStart(2, '0')}`;
        const p: { id: string } = await db.publication.create({
          data: { productId, storeId, externalId: code, title: 'Subconjunto', variantKey: variantKey(v), mainOptionId: main, price: listOf(plan), installments: plan, channelStatus: 'ACTIVE' },
        });
        await db.channelCopy.create({ data: { publicationId: p.id, readAt: now, status: 'ACTIVE', installments: plan, price: listOf(plan), details: { skus: [v.sku] } } });
        ids[code] = p.id;
        if (plan === 0) {
          main = p.id;
          mains.push(p.id);
        }
      }
    }
    const family = await db.listingFamily.create({ data: { storeId, productId, leadId: mains[0] } });
    await db.publication.updateMany({ where: { id: { in: mains } }, data: { familyId: family.id } });
    // Estas pruebas son del almanaque que arman las reglas: el producto está en Automático.
    await db.productPromotion.create({ data: { productId, mode: 'AUTO' } });
  });

  // Una campaña tradicional que invita a todas menos a 12 cuotas de la 0,60, con un tope que en 9 y 12 cuotas queda bajo el piso.
  const deal: SellerPromotion = { id: 'P-1', type: 'DEAL', name: 'HOT SALE', status: 'pending', start: day(20), finish: day(27), deadline: day(18), channelPct: null, sellerPct: null };
  const fakeSweep = (pageSize = 5): ChannelPromotionSweep & { calls: number } => {
    const all: SweepItem[] = Object.keys(ids)
      .filter((code) => code !== 'MLA212')
      .map((code) => {
        const plan = Number(code.slice(4)) as (typeof PLANS)[number];
        const list = listOf(plan);
        // El tope: el precio que en esa forma de cobro deja 16 %, 12 % u 8 % según las cuotas.
        const top = priceForMargin(eco(plan, list), plan >= 9 ? 8 : plan >= 3 ? 12 : 16)!;
        return {
          externalId: code,
          type: 'DEAL',
          deadline: deal.deadline,
          stock: null,
          campaign: {
            ref: JSON.stringify(['DEAL', 'P-1', null]),
            group: 'DEAL:P-1',
            name: 'HOT SALE',
            kind: 'Campaña tradicional',
            status: 'invited',
            price: null,
            channelPct: null,
            sellerPct: null,
            start: deal.start,
            finish: deal.finish,
            join: 'price',
            canLeave: false,
            pausesOwnDiscount: true,
            range: { minPrice: Math.round(list * 0.4), maxPrice: top, suggestedPrice: null },
            listPrice: list,
          },
        };
      });
    const impl = {
      calls: 0,
      async promotions() {
        return [deal];
      },
      async items(_token: string, _p: SellerPromotion, cursor: string | null) {
        impl.calls++;
        const from = cursor ? Number(cursor) : 0;
        const next = from + pageSize < all.length ? String(from + pageSize) : null;
        return { items: all.slice(from, from + pageSize), next };
      },
    };
    return impl;
  };

  async function connect() {
    const { encrypt } = await import('@/lib/crypto');
    process.env.CHANNEL_TOKEN_KEY ??= 'clave-de-prueba-para-las-conexiones-de-los-canales';
    await db.channelConnection.create({
      data: { storeId, appId: '1234567890', appSecret: encrypt('secreto-de-prueba'), appSecretHint: 'ueba', status: 'ACTIVE', externalUserId: '123', accessToken: encrypt('token'), refreshToken: encrypt('refresh'), expiresAt: new Date(Date.now() + 6 * 3_600_000) },
    });
  }

  it('los ajustes: el piso y lo saludable se cambian a mano, y el piso no puede pasar a lo saludable', async () => {
    expect((await loadPromoSettings(db, accountId)).thresholds).toEqual({ healthyMarginPct: 15, floorMarginPct: 10 });
    const saved = await savePromoSettings(db, { accountId, userId: null, healthyMarginPct: 18, floorMarginPct: 12, rules: { timing: { baseDays: 10 } } });
    expect(saved.thresholds).toEqual({ healthyMarginPct: 18, floorMarginPct: 12 });
    expect(saved.rules.timing.baseDays).toBe(10);
    expect(saved.paused).toBe(false);
    await expect(savePromoSettings(db, { accountId, userId: null, floorMarginPct: 20 })).rejects.toThrow('El piso no puede ser más alto');
  });

  it('lee las invitaciones de toda la cuenta de a páginas, sigue donde quedó y borra lo que el canal ya no informa', async () => {
    await connect();
    const sweep = fakeSweep();
    // Una invitación vieja que el canal ya no informa.
    await db.channelPromotionItem.create({ data: { publicationId: ids.MLA100, group: 'DEAL:VIEJA', ref: 'x', type: 'DEAL', kind: 'Campaña tradicional', status: 'invited', seenAt: day(-3) } });
    // Sin tiempo: lee una página y avisa que falta.
    const first = await sweepInvitations(db, { accountId, budgetMs: 0, sweep, now: () => now });
    expect(first).toMatchObject({ pending: true, finished: false });
    const rest = await sweepInvitations(db, { accountId, budgetMs: 60_000, sweep, now: () => now });
    expect(rest).toMatchObject({ pending: false, finished: true, error: null });
    expect(await db.channelPromotionItem.count({ where: { group: 'DEAL:P-1' } })).toBe(11);
    expect(await db.channelPromotionItem.count({ where: { group: 'DEAL:VIEJA' } })).toBe(0);
    expect((await loadPromoSettings(db, accountId)).sweptAt).toEqual(now);
    const row = await db.channelPromotionItem.findFirstOrThrow({ where: { publicationId: ids.MLA100 } });
    expect(row).toMatchObject({ status: 'invited', join: 'price', type: 'DEAL', name: 'HOT SALE' });
    expect(Number(row.maxPrice)).toBe(priceForMargin(eco(0, listOf(0)), 16));
  });

  it('la grilla muestra cada forma de cobro: adentro, al tope o afuera y por qué, aunque todavía no haya almanaque', async () => {
    await connect();
    await sweepInvitations(db, { accountId, budgetMs: 60_000, sweep: fakeSweep(50), now: () => now });
    await setOptionsExcluded(db, { accountId, publicationIds: [ids.MLA101], excluded: true, why: 'No la quiero en eventos', userId: null });
    const grid = (await loadProductGrid(db, accountId, productId, now))!;
    expect(grid.measures.map((m) => [m.measure, m.options.map((o) => o.plan)])).toEqual([
      ['STD', [0, 1, 3, 6, 9, 12]],
      ['0,60 mm', [0, 1, 3, 6, 9, 12]],
    ]);
    // Cada una está publicada al precio que deja 30 % con sus cuotas.
    for (const m of grid.measures) for (const o of m.options) expect(o.marginNow).toBeGreaterThanOrEqual(30);
    expect(grid.columns).toHaveLength(1);
    const col = grid.columns[0];
    expect(col).toMatchObject({ slotId: null, source: 'CHANNEL', layer: 'EVENT', name: 'HOT SALE', targetMarginPct: 15 });
    const cell = (code: string) => col.cells.find((c) => c.publicationId === ids[code])!;
    // Sin cuotas: el tope deja 16 %, así que entra al precio que deja 15 %.
    expect(cell('MLA100')).toMatchObject({ state: 'PLANNED', capped: false, label: 'Por entrar', price: priceForMargin(eco(0, listOf(0)), 15) });
    // 3 y 6 cuotas: al tope, que deja 12 %.
    expect(cell('MLA103')).toMatchObject({ state: 'PLANNED', capped: true, label: 'Por entrar, al tope' });
    expect(cell('MLA106').marginPct).toBeGreaterThanOrEqual(12);
    // 9 y 12 cuotas: el tope deja 8 %, menos que el piso.
    expect(cell('MLA109')).toMatchObject({ state: 'OUT', reason: 'BELOW_FLOOR', label: 'Afuera: bajo el piso' });
    expect(cell('MLA109').text).toContain('menos que el piso de 10 %');
    // La que el canal no invita y la prohibida a mano, con su motivo.
    expect(cell('MLA212')).toMatchObject({ state: 'OUT', reason: 'NOT_INVITED' });
    expect(cell('MLA101')).toMatchObject({ state: 'OUT', reason: 'FORBIDDEN' });
    expect(col.counts).toEqual({ in: 7, capped: 4, out: 5, failed: 0 });
    // Con el piso en 7 %, las de 9 y 12 cuotas entran al tope.
    await savePromoSettings(db, { accountId, userId: null, floorMarginPct: 7 });
    const lower = (await loadProductGrid(db, accountId, productId, now))!;
    expect(lower.columns[0].cells.find((c) => c.publicationId === ids.MLA109)).toMatchObject({ state: 'PLANNED', capped: true });
  });

  it('con las etiquetas arma el almanaque, decide cada forma de cobro y al rearmar no toca lo que ya empezó', async () => {
    await connect();
    await sweepInvitations(db, { accountId, budgetMs: 60_000, sweep: fakeSweep(50), now: () => now });
    // Sin ciclo de vida no hay almanaque.
    expect(await generatePlan(db, { accountId, productId, now })).toMatchObject({ skipped: expect.stringContaining('ciclo de vida'), slots: 0 });
    expect(await setPromoTags(db, { accountId, productIds: [productId], change: { lifecycle: 'GROWING', stockControl: true }, userId: null })).toBe(1);
    const tagged = await db.productPromotion.findUniqueOrThrow({ where: { productId } });
    expect(tagged).toMatchObject({ lifecycle: 'GROWING', stockControl: true, manual: ['lifecycle'], mode: 'AUTO' });

    const preview = await generatePlan(db, { accountId, productId, now, preview: true });
    expect(preview.created).toBeGreaterThan(3);
    expect(await db.promotionSlot.count()).toBe(0);
    const made = await generatePlan(db, { accountId, productId, now });
    expect(made).toMatchObject({ skipped: null, created: preview.created, removed: 0 });
    const slots = await db.promotionSlot.findMany({ orderBy: { start: 'asc' }, include: { items: true } });
    const event = slots.find((s) => s.layer === 'EVENT')!;
    expect(event).toMatchObject({ kind: 'CAMPAIGN', group: 'DEAL:P-1', name: 'HOT SALE', source: 'PLAN' });
    expect(Number(event.targetMarginPct)).toBe(15);
    expect(event.items).toHaveLength(12);
    expect(event.items.filter((i) => i.state === 'PLANNED')).toHaveLength(8);
    expect(event.items.find((i) => i.publicationId === ids.MLA112)).toMatchObject({ state: 'OUT', reason: 'BELOW_FLOOR' });
    // La base: tramos de 14 días con el descuento propio, escalonados hacia el evento.
    const base = slots.filter((s) => s.layer === 'BASE');
    expect(base.length).toBeGreaterThan(4);
    expect(base[0].kind).toBe('OWN_DISCOUNT');
    expect(Number(base[0].targetMarginPct)).toBe(18);
    const first = base[0].items.find((i) => i.publicationId === ids.MLA100)!;
    expect(first.state).toBe('PLANNED');
    expect(Number(first.discountPct)).toBeGreaterThanOrEqual(5);
    expect(Number(first.marginPct)).toBeGreaterThanOrEqual(18);

    // Rearmar el mismo día no cambia nada.
    expect(await generatePlan(db, { accountId, productId, now })).toMatchObject({ created: 0, removed: 0, updated: 0 });
    // Una semana después, el primer tramo ya empezó: queda como está y el resto sigue desde donde termina.
    const later = day(7);
    await db.promotionSlotItem.updateMany({ where: { slotId: base[0].id }, data: { state: 'ON', appliedAt: now } });
    await setPromoTags(db, { accountId, productIds: [productId], change: { lifecycle: 'MATURE' }, userId: null });
    const again = await generatePlan(db, { accountId, productId, now: later });
    // Madurada no lleva base: los tramos que no habían empezado se van.
    expect(again.removed).toBe(base.length - 1);
    const after = await db.promotionSlot.findMany({ where: { layer: 'BASE' }, include: { items: true } });
    expect(after.map((s) => s.id)).toEqual([base[0].id]);
    expect(after[0].items.every((i) => i.state === 'ON')).toBe(true);
    expect(await db.promotionSlot.count({ where: { layer: 'EVENT' } })).toBe(1);

    // La lista de la cuenta: el producto con sus etiquetas y sus cuentas, y los filtros.
    const list = await loadOverview(db, accountId, {}, later);
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0]).toMatchObject({ name: 'Subconjunto SP-9', brand: 'Persan', options: 12, on: 12, planned: 8, out: 4, objective: 'HOLD' });
    expect(list.brands).toEqual(['Persan']);
    expect((await loadOverview(db, accountId, { lifecycle: 'NEW' }, later)).total).toBe(0);
    expect((await loadOverview(db, accountId, { state: 'con_ofertas', brand: 'persan', query: 'mla106' }, later)).total).toBe(1);
  });

  it('desde Claude: etiquetas, reglas, calendario, almanaque, grilla y vista previa de lo que toca', async () => {
    process.env.DATABASE_URL ??= url;
    const { PROMO_TOOLS } = await import('@/lib/mcp/promo-tools');
    const tool = (name: string) => PROMO_TOOLS.find((t) => t.name === name)!;
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const ctx = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = async (name: string, args: Record<string, unknown>): Promise<any> => tool(name).run(ctx, tool(name).input.parse(args));
    await connect();
    await sweepInvitations(db, { accountId, budgetMs: 60_000, sweep: fakeSweep(50) });

    // El piso y lo saludable se configuran a mano.
    const settings = await run('update_promotion_settings', { cuenta: 'prueba', saludable_pct: 16, piso_pct: 11, reglas: { timing: { baseDays: 10 } } });
    expect(settings).toMatchObject({ rentabilidad: { saludable_pct: 16, piso_pct: 11 }, freno_de_emergencia: false });
    await expect(run('update_promotion_settings', { cuenta: 'prueba', piso_pct: 30 })).rejects.toThrow('El piso no puede ser más alto');
    expect((await run('get_promotion_settings', { cuenta: 'prueba' })).reglas.timing.baseDays).toBe(10);

    // El calendario, con anticipación.
    const event = await run('manage_event_calendar', { cuenta: 'prueba', accion: 'guardar', nombre: 'Hot Sale', tipo: 't1', desde: '2027-05-10', hasta: '2027-05-17', texto_de_la_campana: 'hot sale' });
    expect(event).toMatchObject({ guardado: true, nombre: 'Hot Sale', tipo: 't1' });
    expect((await run('manage_event_calendar', { cuenta: 'prueba', accion: 'listar' })).calendario).toHaveLength(1);
    await expect(run('manage_event_calendar', { cuenta: 'prueba', accion: 'guardar', nombre: 'Sin fechas' })).rejects.toThrow('hacen falta');

    // La lista de la cuenta y las etiquetas a mano, por publicación o por filtro.
    const list = await run('get_promotions', { cuenta: 'prueba' });
    expect(list.productos).toEqual([expect.objectContaining({ producto: 'Subconjunto SP-9', marca: 'Persan', etiquetas: [], objetivo: null, formas_de_cobro: 12 })]);
    await expect(run('set_promotion_tags', { cuenta: 'prueba', ciclo_de_vida: 'madurada' })).rejects.toThrow('Decí de qué productos');
    const tagged = await run('set_promotion_tags', { cuenta: 'prueba', filtro: { marca: 'Persan', ciclo_de_vida: 'sin_etiqueta' }, ciclo_de_vida: 'madurada', prioridad: 'empujar', rearmar: true });
    expect(tagged).toMatchObject({ productos_cambiados: 1, almanaques_rearmados: 1 });

    // La grilla: el producto por cualquiera de sus formas de cobro.
    const detail = await run('get_promotions', { cuenta: 'prueba', publicacion: ids.MLA206 });
    expect(detail).toMatchObject({ producto: 'Subconjunto SP-9', objetivo: 'Sostener madurada', etiquetas: { ciclo_de_vida: 'Madurada', prioridad: 'Empujar' }, puestas_a_mano: ['ciclo_de_vida'] });
    expect(detail.medidas.map((m: { medida: string; formas_de_cobro: unknown[] }) => [m.medida, m.formas_de_cobro.length])).toEqual([['STD', 6], ['0,60 mm', 6]]);
    const slot = detail.franjas.find((f: { oferta: string }) => f.oferta === 'HOT SALE');
    // En un evento, Empujar busca lo saludable: va más a fondo solo en los picos.
    expect(slot).toMatchObject({ capa: 'Evento', origen: 'almanaque', rentabilidad_buscada_pct: 16 });
    const cell = slot.casilleros.find((c: { publicacion: string }) => c.publicacion === 'MLA100');
    expect(cell).toMatchObject({ forma_de_cobro: 'Sin cuotas', medida: 'STD', estado: 'Por entrar' });
    expect(cell.rentabilidad_pct).toBeGreaterThanOrEqual(16);
    expect(slot.casilleros.find((c: { publicacion: string }) => c.publicacion === 'MLA212')).toMatchObject({ estado: 'Afuera: no invitada' });

    // Prohibir una forma de cobro: queda afuera con el motivo.
    await run('exclude_from_promotions', { cuenta: 'prueba', publicaciones: [ids.MLA100], prohibir: true, motivo: 'La dejo sin oferta' });
    const after = await run('get_promotions', { cuenta: 'prueba', publicacion: ids.MLA100 });
    expect(after.franjas[0].casilleros.find((c: { publicacion: string }) => c.publicacion === 'MLA100')).toMatchObject({ estado: 'Afuera: prohibida', motivo: expect.stringContaining('La dejo sin oferta') });

    // La vista previa de lo que toca hoy: faltan 20 días para la campaña, no hay nada. Los casilleros elegidos, sí.
    expect(await run('apply_promotion_changes', { cuenta: 'prueba', accion: 'lo_que_toca' })).toMatchObject({ vista_previa: true, cambios: 0 });
    const other = slot.casilleros.find((c: { publicacion: string }) => c.publicacion === 'MLA200');
    const preview = await run('apply_promotion_changes', { cuenta: 'prueba', accion: 'prender', casilleros: [other.casillero] });
    expect(preview).toMatchObject({ vista_previa: true, cambios: 1, prender: 1 });
    expect(preview.detalle[0]).toMatchObject({ publicacion: 'MLA200', que: 'prender', oferta: 'HOT SALE', precio_para_el_comprador: other.precio_para_el_comprador });

    // Una franja que no va: el almanaque no la vuelve a armar.
    await run('set_promotion_slot', { cuenta: 'prueba', publicacion: ids.MLA100, accion: 'no_va', franja: slot.franja, motivo: 'Este año no' });
    await run('generate_promotion_plan', { cuenta: 'prueba', todos: true });
    const gone = await run('get_promotions', { cuenta: 'prueba', publicacion: ids.MLA100, solo_franjas: true });
    expect(gone.franjas).toEqual([expect.objectContaining({ franja: slot.franja, no_va: true, origen: 'a_mano', nota: 'Este año no' })]);

    // La regla propone el ciclo de vida, y no pisa lo puesto a mano.
    const proposed = await run('classify_promotions', { cuenta: 'prueba', todos: true });
    expect(proposed).toMatchObject({ productos: 1, cambian: 0, guardado: false });
    expect(proposed.propuestas[0].propone[0]).toContain('Está puesto a mano');
    // Qué competencia hay que relevar: no tiene ninguna cargada.
    const stale = await run('refresh_competitors', { cuenta: 'prueba' });
    expect(stale.productos).toEqual([expect.objectContaining({ producto: 'Subconjunto SP-9', por_que: 'No tiene competidores cargados.' })]);
  });

  it('con control de stock y poco stock, no se abren ofertas nuevas en esa medida', async () => {
    await connect();
    await sweepInvitations(db, { accountId, budgetMs: 60_000, sweep: fakeSweep(50), now: () => now });
    await db.product.update({ where: { id: productId }, data: { stockSince: day(-30) } });
    const [std, other] = await db.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' } });
    await db.productStock.createMany({
      data: [
        { productId, key: variantKey(std)!, label: 'STD', quantity: 2 },
        { productId, key: variantKey(other)!, label: '0,60 mm', quantity: 40 },
      ],
    });
    await setPromoTags(db, { accountId, productIds: [productId], change: { lifecycle: 'MATURE', stockControl: true }, userId: null });
    await generatePlan(db, { accountId, productId, now });
    const event = await db.promotionSlot.findFirstOrThrow({ where: { layer: 'EVENT' }, include: { items: true } });
    expect(event.items.find((i) => i.publicationId === ids.MLA100)).toMatchObject({ state: 'OUT', reason: 'LOW_STOCK' });
    expect(event.items.find((i) => i.publicationId === ids.MLA200)).toMatchObject({ state: 'PLANNED' });
    // Sin control de stock, la misma medida entra.
    await setPromoTags(db, { accountId, productIds: [productId], change: { stockControl: false }, userId: null });
    await generatePlan(db, { accountId, productId, now });
    expect(await db.promotionSlotItem.findFirstOrThrow({ where: { slotId: event.id, publicationId: ids.MLA100 } })).toMatchObject({ state: 'PLANNED' });
  });
});
