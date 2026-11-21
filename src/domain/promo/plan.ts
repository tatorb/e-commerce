import type { PromoRules, Recipe, Thresholds } from './rules';
import type { PromoTags } from './tags';

// El almanaque de un producto: las franjas que le tocan según sus etiquetas,
// el calendario de eventos y las campañas a las que el canal lo invita. Vale
// para todas sus formas de cobro; qué pasa con cada una se decide aparte
// (entry.ts). Lo que ya empezó no se toca: se arma de hoy en adelante. Sin la
// base de datos.

export const LAYERS = ['PEAK', 'EVENT', 'BASE'] as const;
export type Layer = (typeof LAYERS)[number];
export const LAYER_LABEL: Record<Layer, string> = { PEAK: 'Pico', EVENT: 'Evento', BASE: 'Base' };

export const SLOT_KINDS = ['CAMPAIGN', 'OWN_DISCOUNT', 'VOLUME'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const EVENT_TIERS = ['T1', 'T2', 'BOOST', 'SHARED', 'OWN'] as const;
export type EventTier = (typeof EVENT_TIERS)[number];
export const EVENT_TIER_LABEL: Record<EventTier, string> = {
  T1: 'Evento T1 (Hot Sale, Black Friday, Cyber Monday)',
  T2: 'Evento T2',
  BOOST: 'Potencia tus ventas',
  SHARED: 'Ofertas compartidas',
  OWN: 'Fecha propia del rubro',
};

// Los tipos de campaña del canal que son picos y los que son por cantidad; lo demás son eventos.
const PEAK_TYPES = new Set(['DOD', 'LIGHTNING', 'SMART_LIGHTNING']);
const VOLUME_TYPES = new Set(['VOLUME']);

/** En qué capa cae una campaña del canal, por su tipo. */
export function layerOfType(type: string): { layer: Layer; kind: SlotKind } {
  if (PEAK_TYPES.has(type)) return { layer: 'PEAK', kind: 'CAMPAIGN' };
  if (VOLUME_TYPES.has(type)) return { layer: 'BASE', kind: 'VOLUME' };
  return { layer: 'EVENT', kind: 'CAMPAIGN' };
}

export type CalendarEvent = { id: string; name: string; tier: EventTier; start: Date; finish: Date; match: string | null };

/** Una campaña del canal a la que invitan a alguna forma de cobro del producto, o en la que está. */
export type ChannelCampaignInfo = { group: string; type: string; name: string; start: Date | null; finish: Date | null };

/** Una franja que ya existe. locked: ya empezó o ya se hizo algo en el canal; el almanaque no la toca. */
export type ExistingSlot = { id: string; layer: Layer; kind: SlotKind; group: string | null; eventId: string | null; start: Date; finish: Date; source: 'PLAN' | 'MANUAL'; cancelled: boolean; locked: boolean };

export type PlannedSlot = { layer: Layer; kind: SlotKind; group: string | null; name: string; eventId: string | null; start: Date; finish: Date; targetMarginPct: number };

const DAY = 86_400_000;
const days = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** El evento del calendario al que corresponde una campaña del canal: por el texto de su nombre, o por las fechas. */
export function eventOf(c: ChannelCampaignInfo, events: CalendarEvent[]): CalendarEvent | null {
  const name = norm(c.name);
  const byName = events.find((e) => (e.match && name.includes(norm(e.match))) || name.includes(norm(e.name)));
  if (byName) return byName;
  if (!c.start || !c.finish) return null;
  // La campaña cae entera dentro del evento, con un día de margen.
  return events.find((e) => e.tier !== 'OWN' && c.start!.getTime() >= e.start.getTime() - DAY && c.finish!.getTime() <= e.finish.getTime() + DAY) ?? null;
}

/** La rentabilidad de una capa: la de la receta o la saludable, con "Empujar" un escalón más abajo, nunca debajo del piso. */
export function targetMargin(recipeMargin: number | null, tags: PromoTags, rules: PromoRules, t: Thresholds): number {
  const base = recipeMargin ?? t.healthyMarginPct;
  const pushed = tags.priority === 'PUSH' ? base - rules.timing.pushStepPct : base;
  return Math.max(t.floorMarginPct, Math.round(pushed * 100) / 100);
}

/** La rentabilidad de un tramo de la base, según cuántos días faltan para el próximo evento. */
function baseMargin(recipe: Recipe, daysToEvent: number | null): number | null {
  if (daysToEvent === null) return recipe.baseMarginPct;
  const step = [...recipe.baseSteps].sort((a, b) => a.daysBefore - b.daysBefore).find((s) => daysToEvent <= s.daysBefore);
  return step ? step.marginPct : recipe.baseMarginPct;
}

export type PlanInput = {
  // El primer momento del día de hoy, en la hora de la cuenta.
  today: Date;
  tags: PromoTags;
  rules: PromoRules;
  thresholds: Thresholds;
  events: CalendarEvent[];
  campaigns: ChannelCampaignInfo[];
  // Si vendió en los últimos 90 días.
  hasSales: boolean;
  // La rentabilidad que deja igualar al competidor más barato, comparado contra el sin cuotas. Null si no hay competidor o no pelea por precio.
  competitorMarginPct: number | null;
  // La rentabilidad que deja hoy el precio publicado sin cuotas, para saber si la competencia pide base.
  listMarginPct: number | null;
  existing: ExistingSlot[];
};

/**
 * Las franjas de hoy en adelante. No repite las que ya existen para la misma
 * campaña (aunque estén sacadas a mano) ni pisa los tramos de base que ya
 * empezaron: la base sigue desde donde termina el tramo en curso.
 */
export function planSlots(input: PlanInput): PlannedSlot[] {
  const { tags, rules, thresholds: t, today } = input;
  if (tags.lifecycle === null) return [];
  const recipe = rules.recipes[tags.lifecycle];
  const horizon = new Date(today.getTime() + rules.timing.horizonDays * DAY);
  const out: PlannedSlot[] = [];
  // Las campañas que ya tienen su franja, o que alguien decidió que no van.
  const taken = new Set(input.existing.filter((s) => s.group && (s.locked || s.cancelled || s.source === 'MANUAL')).map((s) => s.group!));

  const eventsOn = recipe.events === 'always' || (recipe.events === 'with_sales' && input.hasSales);
  const eventMargin = targetMargin(recipe.eventMarginPct, tags, rules, t);

  // Eventos, picos y por cantidad: una franja por cada campaña del canal.
  const eventStarts: Date[] = [];
  for (const c of input.campaigns) {
    if (c.finish && c.finish.getTime() <= today.getTime()) continue;
    const { layer, kind } = layerOfType(c.type);
    const on = layer === 'PEAK' ? recipe.peaks : kind === 'VOLUME' ? recipe.volume : eventsOn;
    const event = layer === 'EVENT' ? eventOf(c, input.events) : null;
    const start = c.start ?? event?.start ?? today;
    if (layer === 'EVENT' && on) eventStarts.push(start);
    if (!on || taken.has(c.group)) continue;
    const margin = layer === 'PEAK' ? targetMargin(recipe.peakMarginPct, tags, rules, t) : kind === 'VOLUME' ? Math.max(t.floorMarginPct, t.healthyMarginPct) : eventMargin;
    out.push({ layer, kind, group: c.group, name: c.name, eventId: event?.id ?? null, start, finish: c.finish ?? event?.finish ?? horizon, targetMarginPct: margin });
  }

  // Las fechas propias del rubro, para los estacionales: van con el descuento propio.
  const ownTaken = new Set(input.existing.filter((s) => s.eventId && s.kind === 'OWN_DISCOUNT' && (s.locked || s.cancelled || s.source === 'MANUAL')).map((s) => s.eventId!));
  const ownEvents = tags.priority === 'SEASONAL' ? input.events.filter((e) => e.tier === 'OWN' && e.finish.getTime() > today.getTime() && e.start.getTime() < horizon.getTime()) : [];
  for (const e of ownEvents) {
    eventStarts.push(e.start);
    if (ownTaken.has(e.id)) continue;
    out.push({ layer: 'EVENT', kind: 'OWN_DISCOUNT', group: null, name: e.name, eventId: e.id, start: e.start.getTime() < today.getTime() ? today : e.start, finish: e.finish, targetMarginPct: eventMargin });
  }
  // Los eventos del calendario que todavía no tienen campaña en el canal también marcan hacia dónde escalona la base.
  if (eventsOn) for (const e of input.events) if (e.tier !== 'OWN' && e.start.getTime() > today.getTime()) eventStarts.push(e.start);

  // La base. La competencia la prende aunque la receta la tenga apagada, y fija lo mínimo que tiene que bajar.
  const fight = tags.competition === 'PRICE_FIGHT' && input.competitorMarginPct !== null && (input.listMarginPct === null || input.competitorMarginPct < input.listMarginPct);
  if (recipe.base || fight) {
    // Sigue desde donde termina el tramo de base en curso, para no moverla antes de tiempo.
    const running = input.existing.filter((s) => s.layer === 'BASE' && s.kind === 'OWN_DISCOUNT' && !s.cancelled && (s.locked || s.source === 'MANUAL') && s.finish.getTime() > today.getTime());
    let cursor = running.reduce((latest, s) => (s.finish.getTime() > latest.getTime() ? s.finish : latest), today);
    const ownBusy = [...out.filter((s) => s.kind === 'OWN_DISCOUNT'), ...input.existing.filter((s) => s.kind === 'OWN_DISCOUNT' && s.layer === 'EVENT' && !s.cancelled && (s.locked || s.source === 'MANUAL'))];
    while (cursor.getTime() < horizon.getTime()) {
      let finish = new Date(Math.min(cursor.getTime() + rules.timing.baseDays * DAY, horizon.getTime()));
      // Una fecha propia usa el descuento propio: la base se corta ahí y sigue después.
      const clash = ownBusy.filter((s) => s.finish.getTime() > cursor.getTime() && s.start.getTime() < finish.getTime()).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
      if (clash) {
        if (clash.start.getTime() <= cursor.getTime()) {
          cursor = clash.finish;
          continue;
        }
        finish = clash.start;
      }
      const next = eventStarts.filter((s) => s.getTime() > cursor.getTime()).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      const fromRecipe = recipe.base ? targetMargin(baseMargin(recipe, next ? days(cursor, next) : null), tags, rules, t) : null;
      // La base que lleva a un evento deja más rentabilidad que el evento: su descuento queda por debajo.
      const overEvent = fromRecipe !== null && next ? Math.max(fromRecipe, eventMargin + rules.timing.baseOverEventPct) : fromRecipe;
      const fromFight = fight ? Math.max(t.floorMarginPct, Math.round(input.competitorMarginPct! * 100) / 100) : null;
      const margin = overEvent !== null && fromFight !== null ? Math.min(overEvent, fromFight) : (overEvent ?? fromFight)!;
      out.push({ layer: 'BASE', kind: 'OWN_DISCOUNT', group: null, name: fromFight !== null && margin === fromFight ? 'Descuento propio, para igualar a la competencia' : 'Descuento propio', eventId: null, start: cursor, finish, targetMarginPct: margin });
      cursor = finish;
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Con qué franja existente se corresponde una planeada: la misma campaña, la misma fecha propia o el mismo tramo de base. */
export const slotKey = (s: { layer: Layer; kind: SlotKind; group: string | null; eventId: string | null; start: Date }) =>
  s.kind === 'OWN_DISCOUNT' ? (s.layer === 'EVENT' ? `own:${s.eventId}` : `base:${s.start.toISOString().slice(0, 10)}`) : `${s.kind}:${s.group}`;

/**
 * Cómo pasar de las franjas que hay a las planeadas: las que se crean, las que
 * cambian de fechas o de rentabilidad y las que se van. Solo se van o cambian
 * las que armó el almanaque y todavía no empezaron.
 */
export function diffSlots(existing: ExistingSlot[], planned: PlannedSlot[]): { create: PlannedSlot[]; update: { id: string; slot: PlannedSlot }[]; remove: string[] } {
  const free = existing.filter((s) => s.source === 'PLAN' && !s.locked && !s.cancelled);
  const byKey = new Map(free.map((s) => [slotKey(s), s]));
  const create: PlannedSlot[] = [];
  const update: { id: string; slot: PlannedSlot }[] = [];
  const kept = new Set<string>();
  for (const p of planned) {
    const match = byKey.get(slotKey(p));
    if (match && !kept.has(match.id)) {
      kept.add(match.id);
      update.push({ id: match.id, slot: p });
    } else create.push(p);
  }
  return { create, update, remove: free.filter((s) => !kept.has(s.id)).map((s) => s.id) };
}
