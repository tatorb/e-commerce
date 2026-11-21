import { describe, expect, it } from 'vitest';
import { PRICING_DEFAULTS, marginOf } from '@/domain/pricing';
import { decideCampaign, decideOwnDiscount, decideVolume, marginAt, priceForMargin, volumeEffectivePct, type Invite, type OptionEconomics } from '@/domain/promo/entry';
import { diffSlots, eventOf, layerOfType, planSlots, targetMargin, type CalendarEvent, type ExistingSlot, type PlanInput } from '@/domain/promo/plan';
import { DEFAULT_RULES, DEFAULT_THRESHOLDS, patchRules, readRules, thresholdsProblem } from '@/domain/promo/rules';
import { NO_TAGS, objectiveOf, readTags, tagsText } from '@/domain/promo/tags';

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
    expect(small).toMatchObject({ in: true, capped: true, discountPct: 5 });
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
    expect(patchRules(DEFAULT_RULES, { classify: { newDays: 45 } }).classify).toMatchObject({ newDays: 45, matureUnits90: 20 });
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
    expect(fight[0]).toMatchObject({ targetMarginPct: 17, name: 'Base, para igualar a la competencia' });
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
