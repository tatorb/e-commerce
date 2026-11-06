import type { ChannelStatus } from '@/generated/prisma/enums';
import { planLabel } from './pricing';

// La reconciliación de las opciones de venta de una medida con lo que tiene el
// canal: qué publicaciones faltan traer, si la principal hay que pasarla a otro
// código, cuáles apagó el canal por repetidas y qué necesita una persona. Decide
// solo con los datos: el estado, la forma de cobro y si es la principal. El
// motivo que da el canal se muestra pero no decide. Sin la base de datos, para
// poder probarlo solo.

export type ReconcileOption = {
  // El id en la app. Null: el canal la tiene y la app no.
  id: string | null;
  externalId: string;
  status: ChannelStatus;
  statusReason: string | null;
  // La forma de cobro: 0 sin cuotas, 1 la cuota promocionada, o la cantidad de cuotas. Null si no se sabe.
  plan: number | null;
  price: number | null;
  main: boolean;
};

export type FindingKind =
  | 'new_option' // el canal la tiene y la app no: se suma como opción de venta
  | 'switch_main' // la principal no se puede usar y hay otra viva: la principal pasa a esa
  | 'no_replacement' // la principal está finalizada y no hay otra viva: tarea
  | 'duplicate_off' // el canal la apagó por repetida: se propone finalizarla
  | 'needs_fix' // la principal está inactiva para corregir: tarea y vuelve a Información
  | 'under_review' // la principal está en revisión: no se sube nada
  | 'same_plan_live'; // dos opciones vivas con la misma forma de cobro: el canal va a apagar una

export type Finding = {
  kind: FindingKind;
  // Los códigos del canal que toca.
  codes: string[];
  // A qué código pasa la principal, en switch_main.
  to?: string;
  text: string;
};

// Se puede vender y subirle cambios.
const LIVE: ChannelStatus[] = ['ACTIVE', 'PAUSED'];
// Ya no vuelve: finalizada o eliminada.
const GONE: ChannelStatus[] = ['CLOSED', 'DELETED'];

const isLive = (o: ReconcileOption) => LIVE.includes(o.status);
const planText = (plan: number | null) => (plan === null ? 'forma de cobro sin leer' : planLabel(plan).toLowerCase());
const why = (o: ReconcileOption) => (o.statusReason ? ` Motivo del canal: ${o.statusReason}` : '');

/** La viva que mejor reemplaza a la principal: la misma forma de cobro, después la activa. */
function bestReplacement(main: ReconcileOption, live: ReconcileOption[]): ReconcileOption | null {
  return (
    [...live].sort(
      (a, b) =>
        Number(b.plan === main.plan) - Number(a.plan === main.plan) ||
        Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') ||
        a.externalId.localeCompare(b.externalId),
    )[0] ?? null
  );
}

/** Lo que encuentra en las opciones de una medida. Vacío si todo está bien. */
export function reconcileMeasure(options: ReconcileOption[]): Finding[] {
  const out: Finding[] = [];
  for (const o of options.filter((x) => x.id === null)) {
    out.push({
      kind: 'new_option',
      codes: [o.externalId],
      text: `${o.externalId} es otra opción de venta de esta medida que la app no tenía (${planText(o.plan)}). Se suma.`,
    });
  }
  const main = options.find((o) => o.main && o.id !== null) ?? null;
  const live = options.filter(isLive);
  // Las apagadas que tienen la misma forma de cobro que una viva: el canal las apagó por repetidas.
  const twinOf = (o: ReconcileOption) => (o.plan === null ? null : (live.find((l) => l !== o && l.plan === o.plan) ?? null));

  if (main && !isLive(main)) {
    const twin = main.status === 'INACTIVE' ? twinOf(main) : null;
    const others = live.filter((l) => l !== main);
    if (twin) {
      out.push({
        kind: 'switch_main',
        codes: [main.externalId],
        to: twin.externalId,
        text: `La principal ${main.externalId} quedó inactiva y ${twin.externalId} tiene la misma forma de cobro (${planText(main.plan)}): el canal la apagó por repetida. La principal pasa a ${twin.externalId}.${why(main)}`,
      });
    } else if (main.status === 'INACTIVE') {
      out.push({
        kind: 'needs_fix',
        codes: [main.externalId],
        text: `La principal ${main.externalId} quedó inactiva: el canal pide revisarla. Se mantiene el código, se crea una tarea y vuelve al paso Información.${why(main)}`,
      });
    } else if (others.length > 0) {
      const to = bestReplacement(main, others)!;
      out.push({
        kind: 'switch_main',
        codes: [main.externalId],
        to: to.externalId,
        text: `La principal ${main.externalId} está ${GONE.includes(main.status) ? 'finalizada' : 'en revisión'} y ${to.externalId} sigue a la venta (${planText(to.plan)}). La principal pasa a ${to.externalId}.${why(main)}`,
      });
    } else if (GONE.includes(main.status)) {
      out.push({
        kind: 'no_replacement',
        codes: [main.externalId],
        text: `La principal ${main.externalId} está finalizada y no hay otra opción a la venta en esta medida. Se crea una tarea: ¿volver a publicar?${why(main)}`,
      });
    } else {
      out.push({
        kind: 'under_review',
        codes: [main.externalId],
        text: `La principal ${main.externalId} está en revisión del canal: no se le sube nada hasta que termine.${why(main)}`,
      });
    }
  }

  // Las otras opciones apagadas por repetidas: se propone finalizarlas.
  for (const o of options) {
    if (o === main || o.status !== 'INACTIVE') continue;
    const twin = twinOf(o);
    if (!twin) continue;
    out.push({
      kind: 'duplicate_off',
      codes: [o.externalId],
      text: `${o.externalId} quedó inactiva con la misma forma de cobro que ${twin.externalId} (${planText(o.plan)}): el canal la apagó por repetida. Conviene finalizarla.${why(o)}`,
    });
  }
  // Si la principal pasa a otra, la vieja apagada por repetida también se propone finalizar.
  const switched = out.find((f) => f.kind === 'switch_main');
  if (switched && main && main.status === 'INACTIVE' && twinOf(main)) {
    out.push({ kind: 'duplicate_off', codes: [main.externalId], text: `${main.externalId} quedó apagada por repetida. Conviene finalizarla.` });
  }

  // Dos vivas con la misma forma de cobro: el canal va a apagar una.
  const byPlan = new Map<number, ReconcileOption[]>();
  for (const o of live) if (o.plan !== null) byPlan.set(o.plan, [...(byPlan.get(o.plan) ?? []), o]);
  for (const [plan, list] of byPlan) {
    if (list.length < 2) continue;
    out.push({
      kind: 'same_plan_live',
      codes: list.map((o) => o.externalId),
      text: `${list.map((o) => o.externalId).join(' y ')} tienen la misma forma de cobro (${planText(plan)}): el canal va a apagar una. Conviene cambiar o finalizar una de las dos.`,
    });
  }
  return out;
}
