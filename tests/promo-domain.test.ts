import { describe, expect, it } from 'vitest';
import { PRICING_DEFAULTS, marginOf } from '@/domain/pricing';
import { decideCampaign, decideOwnDiscount, decideVolume, marginAt, priceForMargin, volumeEffectivePct, type Invite, type OptionEconomics } from '@/domain/promo/entry';
import { diffSlots, eventOf, layerOfType, planSlots, targetMargin, type CalendarEvent, type ExistingSlot, type PlanInput } from '@/domain/promo/plan';
import { DEFAULT_RULES, DEFAULT_THRESHOLDS, patchRules, readRules, thresholdsProblem } from '@/domain/promo/rules';
import { NO_TAGS, objectiveOf, readTags, tagsText } from '@/domain/promo/tags';
import { parsePromotionItems, parseSellerPromotions } from '@/channels/mercadolibre/promotions';
import { proposeCompetition, proposeLifecycle, type ProductFacts } from '@/domain/promo/classify';
import { priceRiskText } from '@/lib/promo/price-risk';

const params = { ...PRICING_DEFAULTS, shipping: 0 };
const eco = (over: Partial<OptionEconomics> = {}): OptionEconomics => ({ cost: 10_000, params, plan: 0, listPrice: null, ...over });
// El precio publicado que deja 30 % sin cuotas.
const list = priceForMargin(eco(), 30)!;
const invite = (over: Partial<Invite> = {}): Invite => ({ status: 'invited', join: 'price', price: null, minPrice: null, maxPrice: null, channelPct: null, listPrice: list, ...over });

describe('promociones: si una forma de cobro entra a una oferta', () => {
  it('el precio que deja una rentabilidad deja esa rentabilidad', () => {
    for (const plan of [0, 3, 12] as const) {
      const p = priceForMargin(eco({ plan }), 15)!;
      expect(marginOf(p, 10_000, params, plan)!).toBeGreaterThanOrEqual(15);
      expect(marginOf(p - 2, 10_000, params, plan)!).toBeLessThan(15);
    }
    // Con lo que pone el canal, el comprador paga menos por la misma rentabilidad.
    expect(priceForMargin(eco({ listPrice: list }), 15, 10)!).toBeLessThan(priceForMargin(eco({ listPrice: list }), 15)!);
    expect(priceForMargin(eco({ cost: null }), 15)).toBeNull();
  });

  it('eligiendo el precio: entra al que deja la rentabilidad buscada si el canal lo acepta', () => {
    const d = decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ maxPrice: list - 1, minPrice: 1000 }), targetMarginPct: 15, floorMarginPct: 10 });
    expect(d).toMatchObject({ in: true, capped: false });
    if (!d.in) throw new Error();
    expect(d.price).toBe(priceForMargin(eco({ listPrice: list }), 15));
    expect(d.marginPct).toBeGreaterThanOrEqual(15);
  });

  it('si el tope del canal es más bajo: entra al tope mientras deje el piso; si no, queda afuera con el motivo', () => {
    const at12 = priceForMargin(eco({ listPrice: list }), 12)!;
    const capped = decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ maxPrice: at12 }), targetMarginPct: 15, floorMarginPct: 10 });
    expect(capped).toMatchObject({ in: true, capped: true, price: at12 });
    const at8 = priceForMargin(eco({ listPrice: list }), 8)!;
    const out = decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ maxPrice: at8 }), targetMarginPct: 15, floorMarginPct: 10 });
    expect(out).toMatchObject({ in: false, reason: 'BELOW_FLOOR', price: at8 });
    if (out.in) throw new Error();
    expect(out.text).toContain('menos que el piso de 10 %');
    // Con el piso más bajo, la misma entra.
    expect(decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ maxPrice: at8 }), targetMarginPct: 15, floorMarginPct: 7 })).toMatchObject({ in: true, capped: true });
  });

  it('cada forma de cobro se mide con el costo de sus cuotas', () => {
    // El mismo tope entra sin cuotas y queda afuera en 12 cuotas.
    const top = priceForMargin(eco({ listPrice: list }), 12)!;
    const args = { invite: invite({ maxPrice: top }), targetMarginPct: 15, floorMarginPct: 10 };
    expect(decideCampaign({ eco: eco({ listPrice: list, plan: 0 }), ...args }).in).toBe(true);
    expect(decideCampaign({ eco: eco({ listPrice: list, plan: 12 }), ...args })).toMatchObject({ in: false, reason: 'BELOW_FLOOR' });
  });

  it('aceptando el precio del canal, lo que pone el canal cuenta; sin invitación o sin costo queda afuera', () => {
    const price = priceForMargin(eco({ listPrice: list }), 8)!;
    const base = { targetMarginPct: 15, floorMarginPct: 10 };
    expect(decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ join: 'accept', price }), ...base })).toMatchObject({ in: false, reason: 'BELOW_FLOOR' });
    // Con 10 % del precio publicado puesto por el canal, deja más que el piso.
    const withChannel = decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ join: 'accept', price, channelPct: 10 }), ...base });
    expect(withChannel).toMatchObject({ in: true, price });
    expect(decideCampaign({ eco: eco({ listPrice: list }), invite: null, ...base })).toMatchObject({ in: false, reason: 'NOT_INVITED' });
    expect(decideCampaign({ eco: eco({ cost: null, listPrice: list }), invite: invite(), ...base })).toMatchObject({ in: false, reason: 'NO_COST' });
    expect(decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ join: null }), ...base })).toMatchObject({ in: false, reason: 'CHANNEL_ONLY' });
    // La que ya está adentro sigue adentro, y avisa si deja menos que el piso.
    const inside = decideCampaign({ eco: eco({ listPrice: list }), invite: invite({ status: 'active', join: null, price }), ...base });
    expect(inside).toMatchObject({ in: true, price });
    if (!inside.in) throw new Error();
    expect(inside.note).toContain('menos que el piso');
  });

  it('el descuento propio: el % que deja la rentabilidad buscada, nunca menos del mínimo del canal ni debajo del piso', () => {
    const d = decideOwnDiscount({ eco: eco({ listPrice: list }), targetMarginPct: 20, floorMarginPct: 10 });
    if (!d.in) throw new Error();
    expect(d.discountPct).toBeGreaterThan(5);
    expect(d.marginPct).toBeGreaterThanOrEqual(20);
    expect(marginAt(eco({ listPrice: list }), d.price)).toBeCloseTo(d.marginPct, 1);
    // Buscando casi lo mismo que deja el precio publicado, va el 5 %.
    const small = decideOwnDiscount({ eco: eco({ listPrice: list }), targetMarginPct: 29, floorMarginPct: 10 });
    expect(small).toMatchObject({ in: true, capped: false, discountPct: 5, note: expect.stringContaining('descuento más chico') });
    // Un precio publicado que ya deja el piso justo no aguanta ni el 5 %.
    const tight = priceForMargin(eco(), 11)!;
    expect(decideOwnDiscount({ eco: eco({ listPrice: tight }), targetMarginPct: 15, floorMarginPct: 10 })).toMatchObject({ in: false, reason: 'BELOW_FLOOR' });
  });

  it('el descuento por cantidad se mide por lo que deja cada unidad', () => {
    expect(volumeEffectivePct({ kind: 'lleva_paga', buyQuantity: 3, payQuantity: 2, discountPct: null })).toBeCloseTo(33.33, 1);
    expect(volumeEffectivePct({ kind: 'descuento_en_la_unidad', buyQuantity: 2, payQuantity: null, discountPct: 50 })).toBe(25);
    expect(volumeEffectivePct({ kind: 'descuento_llevando', buyQuantity: 2, payQuantity: null, discountPct: 10 })).toBe(10);
    expect(decideVolume({ eco: eco({ listPrice: list }), effectivePct: 33.33, channelPct: null, floorMarginPct: 10, targetMarginPct: 15 })).toMatchObject({ in: false, reason: 'BELOW_FLOOR' });
    expect(decideVolume({ eco: eco({ listPrice: list }), effectivePct: 8, channelPct: null, floorMarginPct: 10, targetMarginPct: 15 })).toMatchObject({ in: true });
  });
});

describe('promociones: etiquetas y reglas', () => {
  it('el objetivo sale de las etiquetas', () => {
    expect(objectiveOf(NO_TAGS)).toBeNull();
    expect(objectiveOf({ ...NO_TAGS, lifecycle: 'NEW' })).toBe('POSITION');
    expect(objectiveOf({ ...NO_TAGS, lifecycle: 'GROWING', competition: 'PRICE_FIGHT' })).toBe('PRICE');
    expect(objectiveOf({ ...NO_TAGS, lifecycle: 'CLEARANCE', competition: 'PRICE_FIGHT' })).toBe('CLEAR');
    expect(objectiveOf({ ...NO_TAGS, lifecycle: 'MATURE' })).toBe('HOLD');
    expect(readTags({ lifecycle: 'otra', competition: 'PRICE_FIGHT', priority: 'PUSH', stockControl: true })).toEqual({ lifecycle: null, competition: 'PRICE_FIGHT', inCatalog: false, stockControl: true, priority: 'PUSH' });
    expect(tagsText({ lifecycle: 'MATURE', competition: null, inCatalog: true, stockControl: true, priority: 'PUSH' })).toEqual(['Madurada', 'En catálogo', 'Control de stock', 'Empujar']);
  });

  it('las reglas guardadas toman del valor de partida lo que falta o no vale', () => {
    expect(readRules(null)).toEqual(DEFAULT_RULES);
    const r = readRules({ timing: { baseDays: 10, horizonDays: 'x' }, recipes: { MATURE: { base: true, baseMarginPct: 22 } } });
    expect(r.timing).toEqual(DEFAULT_RULES.timing);
    expect(readRules({ timing: { baseDays: 10 } }).timing.baseDays).toBe(10);
    expect(r.recipes.MATURE).toMatchObject({ base: true, baseMarginPct: 22, events: 'always' });
    expect(patchRules(DEFAULT_RULES, { classify: { newDays: 45 } }).classify).toMatchObject({ newDays: 45, matureUnits90: 3, clearanceAuto: false, growingMinUnits90: 1 });
    expect(thresholdsProblem({ healthyMarginPct: 15, floorMarginPct: 10 })).toBeNull();
    expect(thresholdsProblem({ healthyMarginPct: 9, floorMarginPct: 10 })).toContain('piso');
  });
});

describe('promociones: el almanaque', () => {
  const today = new Date('2026-12-01T03:00:00Z');
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000);
  const hotSale: CalendarEvent = { id: 'e1', name: 'Hot Sale', tier: 'T1', start: day(40), finish: day(47), match: 'hot sale' };
  const input = (over: Partial<PlanInput> = {}): PlanInput => ({
    today,
    tags: { ...NO_TAGS, lifecycle: 'GROWING' },
    rules: DEFAULT_RULES,
    thresholds: DEFAULT_THRESHOLDS,
    events: [hotSale],
    campaigns: [],
    hasSales: true,
    competitorMarginPct: null,
    listMarginPct: 30,
    existing: [],
    ...over,
  });
  const deal = { group: 'DEAL:P1', type: 'DEAL', name: 'HOT SALE 2027', start: day(40), finish: day(47) };
  const lightning = { group: 'LIGHTNING:P2', type: 'LIGHTNING', name: 'Relámpago', start: day(3), finish: day(3.25) };

  it('las campañas del canal caen en su capa y se reconocen en el calendario', () => {
    expect(layerOfType('LIGHTNING')).toEqual({ layer: 'PEAK', kind: 'CAMPAIGN' });
    expect(layerOfType('VOLUME')).toEqual({ layer: 'BASE', kind: 'VOLUME' });
    expect(layerOfType('MARKETPLACE_CAMPAIGN')).toEqual({ layer: 'EVENT', kind: 'CAMPAIGN' });
    expect(eventOf(deal, [hotSale])?.id).toBe('e1');
    expect(eventOf({ ...deal, name: 'Semana X', start: day(41), finish: day(46) }, [hotSale])?.id).toBe('e1');
    expect(eventOf({ ...deal, name: 'Semana X', start: day(1), finish: day(5) }, [hotSale])).toBeNull();
  });

  it('sin ciclo de vida no hay almanaque', () => {
    expect(planSlots(input({ tags: NO_TAGS, campaigns: [deal] }))).toEqual([]);
  });

  it('en crecimiento: base escalonada hacia el evento, evento a lo saludable y los picos', () => {
    const slots = planSlots(input({ campaigns: [deal, lightning] }));
    const base = slots.filter((s) => s.layer === 'BASE');
    // Tramos de 14 días hasta el horizonte, sin huecos.
    expect(base[0].start).toEqual(today);
    for (let i = 1; i < base.length; i++) expect(base[i].start).toEqual(base[i - 1].finish);
    expect(base.at(-1)!.finish).toEqual(day(90));
    // A 40 días del evento, 22 %; a 26 y a 12 días, 18 %; después del evento, 25 %.
    expect(base.slice(0, 4).map((s) => s.targetMarginPct)).toEqual([22, 18, 18, 25]);
    // El evento va a lo saludable, y la base que lleva a él deja más.
    const event = slots.find((s) => s.layer === 'EVENT')!;
    expect(event).toMatchObject({ kind: 'CAMPAIGN', group: 'DEAL:P1', eventId: 'e1', targetMarginPct: 15 });
    expect(Math.min(...base.slice(0, 3).map((s) => s.targetMarginPct))).toBeGreaterThan(event.targetMarginPct);
    expect(slots.find((s) => s.layer === 'PEAK')).toMatchObject({ group: 'LIGHTNING:P2', targetMarginPct: 15 });
  });

  it('nueva: eventos solo si ya vendió; madurada: sin base ni picos; a liquidar: picos y por cantidad', () => {
    const volume = { group: 'VOLUME:P3', type: 'VOLUME', name: '3x2', start: day(-5), finish: day(20) };
    const all = [deal, lightning, volume];
    const kinds = (over: Partial<PlanInput>) => [...new Set(planSlots(input({ campaigns: all, ...over })).map((s) => `${s.layer}:${s.kind}`))].sort();
    expect(kinds({ tags: { ...NO_TAGS, lifecycle: 'NEW' }, hasSales: false })).toEqual(['BASE:OWN_DISCOUNT', 'PEAK:CAMPAIGN']);
    expect(kinds({ tags: { ...NO_TAGS, lifecycle: 'NEW' }, hasSales: true })).toEqual(['BASE:OWN_DISCOUNT', 'EVENT:CAMPAIGN', 'PEAK:CAMPAIGN']);
    expect(kinds({ tags: { ...NO_TAGS, lifecycle: 'MATURE' } })).toEqual(['EVENT:CAMPAIGN']);
    expect(kinds({ tags: { ...NO_TAGS, lifecycle: 'CLEARANCE' } })).toEqual(['BASE:VOLUME', 'PEAK:CAMPAIGN']);
  });

  it('empujar baja un escalón sin pasar el piso; la competencia prende la base y fija cuánto baja', () => {
    expect(targetMargin(null, { ...NO_TAGS, priority: 'PUSH' }, DEFAULT_RULES, DEFAULT_THRESHOLDS)).toBe(12.5);
    expect(targetMargin(11, { ...NO_TAGS, priority: 'PUSH' }, DEFAULT_RULES, DEFAULT_THRESHOLDS)).toBe(10);
    // Madurada no lleva base, salvo que pelee por precio y el competidor esté más barato.
    const mature = { ...NO_TAGS, lifecycle: 'MATURE' as const, competition: 'PRICE_FIGHT' as const };
    const fight = planSlots(input({ tags: mature, competitorMarginPct: 17, events: [] })).filter((s) => s.layer === 'BASE');
    expect(fight.length).toBeGreaterThan(0);
    expect(fight[0]).toMatchObject({ targetMarginPct: 17, name: 'Descuento propio, para igualar a la competencia' });
    // Nunca debajo del piso, aunque el competidor esté más abajo.
    expect(planSlots(input({ tags: mature, competitorMarginPct: 4, events: [] })).find((s) => s.layer === 'BASE')!.targetMarginPct).toBe(10);
    // Si ya está más barata que el competidor, no hace falta base.
    expect(planSlots(input({ tags: mature, competitorMarginPct: 35, events: [] }))).toEqual([]);
  });

  it('las fechas propias del rubro son para los estacionales, con el descuento propio, y cortan la base', () => {
    const own: CalendarEvent = { id: 'e2', name: 'Día del mecánico', tier: 'OWN', start: day(5), finish: day(8), match: null };
    expect(planSlots(input({ events: [own] })).some((s) => s.eventId === 'e2')).toBe(false);
    const slots = planSlots(input({ events: [own], tags: { ...NO_TAGS, lifecycle: 'GROWING', priority: 'SEASONAL' } }));
    expect(slots.find((s) => s.eventId === 'e2')).toMatchObject({ layer: 'EVENT', kind: 'OWN_DISCOUNT', targetMarginPct: 15 });
    const base = slots.filter((s) => s.layer === 'BASE');
    expect(base[0]).toMatchObject({ start: today, finish: day(5) });
    expect(base[1].start).toEqual(day(8));
  });

  it('lo que ya empezó o se decidió a mano no se toca: la base sigue desde el tramo en curso y la campaña no se repite', () => {
    const existing: ExistingSlot[] = [
      { id: 's1', layer: 'BASE', kind: 'OWN_DISCOUNT', group: null, eventId: null, start: day(-4), finish: day(10), source: 'PLAN', cancelled: false, locked: true },
      { id: 's2', layer: 'EVENT', kind: 'CAMPAIGN', group: 'DEAL:P1', eventId: 'e1', start: day(40), finish: day(47), source: 'MANUAL', cancelled: true, locked: false },
      { id: 's3', layer: 'BASE', kind: 'OWN_DISCOUNT', group: null, eventId: null, start: day(10), finish: day(24), source: 'PLAN', cancelled: false, locked: false },
      { id: 's4', layer: 'PEAK', kind: 'CAMPAIGN', group: 'LIGHTNING:VIEJA', eventId: null, start: day(2), finish: day(3), source: 'PLAN', cancelled: false, locked: false },
    ];
    const planned = planSlots(input({ campaigns: [deal, lightning], existing }));
    expect(planned.some((s) => s.group === 'DEAL:P1')).toBe(false);
    expect(planned.filter((s) => s.layer === 'BASE')[0].start).toEqual(day(10));
    const diff = diffSlots(existing, planned);
    // El tramo que seguía se actualiza, la relámpago vieja se va, y lo trabado queda.
    expect(diff.update.map((u) => u.id)).toEqual(['s3']);
    expect(diff.remove).toEqual(['s4']);
    expect(diff.create.some((s) => s.group === 'LIGHTNING:P2')).toBe(true);
  });
});

describe('promociones: lo que informa Mercado Libre de toda la cuenta', () => {
  // Con la forma de las respuestas de la documentación de Mercado Libre.
  const sellerBody = {
    results: [
      { id: 'P-MLA1', type: 'DEAL', status: 'pending', start_date: '2027-05-10T03:00:00Z', finish_date: '2027-05-17T03:00:00Z', deadline_date: '2027-05-09T03:00:00Z', name: 'Hot Sale' },
      { id: 'P-MLA2', type: 'VOLUME', status: 'started', start_date: '2026-11-01T03:00:00Z', finish_date: '2026-12-31T03:00:00Z', name: '3x2', benefits: { type: 'VOLUME', meli_percent: 9.9999, seller_percent: 23.3331 } },
      { id: 'P-MLA3', type: 'LIGHTNING', status: 'started', name: 'Relámpago' },
      { id: 'P-MLA4', type: 'PRICE_DISCOUNT', status: 'started' },
      { type: 'DEAL' },
    ],
    paging: { total: 5 },
  };

  it('la lista de promociones del vendedor, sin el descuento propio', () => {
    const list = parseSellerPromotions(sellerBody);
    expect(list.map((p) => [p.id, p.type])).toEqual([
      ['P-MLA1', 'DEAL'],
      ['P-MLA2', 'VOLUME'],
      ['P-MLA3', 'LIGHTNING'],
    ]);
    expect(list[0].deadline).toEqual(new Date('2027-05-09T03:00:00Z'));
    expect(list[1]).toMatchObject({ channelPct: 9.9999, sellerPct: 23.3331 });
    expect(parseSellerPromotions(null)).toEqual([]);
  });

  it('las publicaciones de una campaña tradicional: invitada con su tope, y adentro con su precio', () => {
    const [deal] = parseSellerPromotions(sellerBody);
    const page = parsePromotionItems(deal, {
      results: [
        { id: 'MLA100', status: 'candidate', price: 0, original_price: 1000, min_discounted_price: 400, max_discounted_price: 900, suggested_discounted_price: 850 },
        { id: 'MLA200', status: 'started', price: 800, original_price: 1000 },
        { id: 'MLA300', status: 'finished', price: 800 },
      ],
      paging: { searchAfter: 'abc' },
    });
    expect(page.next).toBe('abc');
    expect(page.items.map((i) => i.externalId)).toEqual(['MLA100', 'MLA200']);
    expect(page.items[0].campaign).toMatchObject({ group: 'DEAL:P-MLA1', name: 'Hot Sale', status: 'invited', join: 'price', pausesOwnDiscount: true, listPrice: 1000, range: { minPrice: 400, maxPrice: 900, suggestedPrice: 850 } });
    expect(page.items[0].deadline).toEqual(new Date('2027-05-09T03:00:00Z'));
    expect(page.items[1].campaign).toMatchObject({ status: 'active', join: null, canLeave: true, price: 800 });
    // La última página no trae por dónde seguir.
    expect(parsePromotionItems(deal, { results: [], paging: {} }).next).toBeNull();
  });

  it('una relámpago se pide con precio y unidades, y una vez activa no se puede sacar', () => {
    const lightning = parseSellerPromotions(sellerBody)[2];
    const page = parsePromotionItems(lightning, {
      results: [
        { id: 'MLA100', status: 'candidate', price: 4000, original_price: 5000, max_discounted_price: 4950, min_discounted_price: 1500, start_date: '2026-12-02T15:00:00Z', finish_date: '2026-12-02T23:00:00Z', stock: { min: 2, max: 5 } },
        { id: 'MLA200', status: 'pending', price: 4000 },
        { id: 'MLA300', status: 'started', price: 4000 },
      ],
    });
    expect(page.items[0]).toMatchObject({ type: 'LIGHTNING', stock: { min: 2, max: 5 } });
    expect(page.items[0].campaign).toMatchObject({ status: 'invited', join: 'price', kind: 'Oferta relámpago', range: { minPrice: 1500, maxPrice: 4950 }, start: new Date('2026-12-02T15:00:00Z') });
    expect(page.items[1].campaign).toMatchObject({ status: 'scheduled', canLeave: true });
    expect(page.items[2].campaign).toMatchObject({ status: 'active', canLeave: false });
  });

  it('en una por cantidad, cada publicación lleva lo que pone el canal y lo que pone la tienda', () => {
    const volume = parseSellerPromotions(sellerBody)[1];
    const page = parsePromotionItems(volume, { results: [{ id: 'MLA100', status: 'started', price: 0, original_price: 1000, offer_id: 'OFFER-1' }] });
    expect(page.items[0].campaign).toMatchObject({ group: 'VOLUME:P-MLA2', status: 'active', channelPct: 9.9999, sellerPct: 23.3331, canLeave: false, join: null });
    expect(JSON.parse(page.items[0].campaign.ref)).toEqual(['VOLUME', 'P-MLA2', 'OFFER-1']);
  });
});

describe('promociones: la regla que propone etiquetas y el aviso al subir el precio', () => {
  const rules = DEFAULT_RULES.classify;
  const facts = (over: Partial<ProductFacts>): ProductFacts => ({ ageDays: 400, units90: 10, units30: 3, unitsClearance: 10, stock: 20, flatPrice: 1000, competitorPrice: null, ...over });

  it('el ciclo de vida sale de la antigüedad y las ventas', () => {
    expect(proposeLifecycle(facts({ ageDays: 20 }), rules)).toMatchObject({ value: 'NEW' });
    // De partida, "a liquidar" es solo a mano, y lo que no vendió nada queda sin ciclo de vida.
    const none = proposeLifecycle(facts({ units90: 0, units30: 0, unitsClearance: 0 }), rules);
    expect(none).toMatchObject({ value: null });
    expect(none!.why).toContain('queda sin ciclo de vida');
    expect(proposeLifecycle(facts({ units90: 6, units30: 2 }), rules)).toMatchObject({ value: 'MATURE' });
    expect(proposeLifecycle(facts({ units90: 6, units30: 5 }), rules)).toMatchObject({ value: 'GROWING' });
    expect(proposeLifecycle(facts({ units90: 2 }), rules)).toMatchObject({ value: 'GROWING' });
    // Con la regla de liquidar prendida y todos con ciclo de vida.
    const loose = { ...rules, clearanceAuto: true, growingMinUnits90: 0 };
    expect(proposeLifecycle(facts({ units90: 0, units30: 0, unitsClearance: 0 }), loose)).toMatchObject({ value: 'CLEARANCE' });
    // Sin stock no hay qué liquidar.
    expect(proposeLifecycle(facts({ units90: 0, units30: 0, unitsClearance: 0, stock: 0 }), loose)).toMatchObject({ value: 'GROWING' });
    // Sin las ventas completas de la tienda no propone nada.
    expect(proposeLifecycle(facts({ units90: null, units30: null, unitsClearance: null }), rules)).toBeNull();
    expect(proposeLifecycle(facts({ ageDays: 20 }), rules)!.why).toContain('20 días');
  });

  it('pelea por precio si el competidor más barato está cerca o por debajo del sin cuotas', () => {
    expect(proposeCompetition(facts({}), rules)).toBeNull();
    expect(proposeCompetition(facts({ competitorPrice: 900 }), rules)).toMatchObject({ value: 'PRICE_FIGHT' });
    expect(proposeCompetition(facts({ competitorPrice: 1080 }), rules)).toMatchObject({ value: 'PRICE_FIGHT' });
    expect(proposeCompetition(facts({ competitorPrice: 1300 }), rules)).toMatchObject({ value: null });
  });

  it('el aviso de las campañas que se pierden al subir el precio', () => {
    expect(priceRiskText([], 'Mercado Libre')).toBeNull();
    const risks = [
      { publicationId: 'a', externalId: 'MLA1', campaigns: ['Compartida'], rising: false },
      { publicationId: 'b', externalId: 'MLA2', campaigns: ['Compartida', '3x2'], rising: true },
    ];
    expect(priceRiskText(risks, 'Mercado Libre')).toContain('2 publicaciones están en Compartida, 3x2 (MLA1, MLA2)');
    // Al guardar un precio, solo las que ya tienen un precio más alto por subir.
    expect(priceRiskText(risks, 'Mercado Libre', true)).toContain('Una publicación está en Compartida, 3x2 (MLA2)');
    expect(priceRiskText([risks[0]], 'Mercado Libre', true)).toBeNull();
  });
});
