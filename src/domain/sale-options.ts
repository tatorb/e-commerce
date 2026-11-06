import type { ChannelStatus, PipelineStatus } from '@/generated/prisma/enums';
import { planLabel } from './pricing';

// Opciones de venta: el canal puede vender la misma medida en varias
// publicaciones, cada una con su forma de cobro y su precio. Se agrupan por el
// código de la medida en el canal, que la app no interpreta. Una es la
// principal, la que se trabaja en el pipeline; las demás apuntan a ella.
// Sin la base de datos, para poder probarlo solo.

export type OptionRow = {
  id: string;
  // La medida del canal. Null: el canal no la informa, y la publicación va sola.
  channelProductId: string | null;
  // La principal a la que apunta hoy. Null: es la principal o va sola.
  mainOptionId: string | null;
  status: ChannelStatus | null;
  pipelineStatus: PipelineStatus;
  // Si es la principal de su familia: ahí vive el trabajo del pipeline.
  familyLead: boolean;
  createdAt: Date;
};

// Para elegir la principal cuando no hay una: primero la que se vende, después la pausada.
const STATUS_RANK: Record<ChannelStatus, number> = { ACTIVE: 0, PAUSED: 1, UNDER_REVIEW: 2, INACTIVE: 3, UNPUBLISHED: 4, CLOSED: 5, DELETED: 6 };


/**
 * La principal de un grupo de opciones de la misma medida. Se queda la que ya
 * era principal; si no hay, la que tiene trabajo de pipeline, después la que
 * se vende y, a igualdad, la más vieja en la app.
 */
export function chooseMain(group: OptionRow[]): OptionRow {
  const ids = new Set(group.map((r) => r.id));
  // La principal de hoy: a la que apuntan las demás del grupo.
  const votes = new Map<string, number>();
  for (const r of group) if (r.mainOptionId && ids.has(r.mainOptionId)) votes.set(r.mainOptionId, (votes.get(r.mainOptionId) ?? 0) + 1);
  const current = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (current) return group.find((r) => r.id === current)!;
  return [...group].sort(
    (a, b) =>
      Number(b.familyLead) - Number(a.familyLead) ||
      Number(b.pipelineStatus !== 'UNTOUCHED') - Number(a.pipelineStatus !== 'UNTOUCHED') ||
      (a.status ? STATUS_RANK[a.status] : 9) - (b.status ? STATUS_RANK[b.status] : 9) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  )[0];
}

/**
 * A qué principal tiene que apuntar cada publicación: null si es la principal
 * o va sola. Devuelve solo las que cambian.
 */
export function planMainOptions(rows: OptionRow[]): Map<string, string | null> {
  const groups = new Map<string, OptionRow[]>();
  for (const r of rows) {
    if (!r.channelProductId) continue;
    groups.set(r.channelProductId, [...(groups.get(r.channelProductId) ?? []), r]);
  }
  const target = new Map<string, string | null>(rows.map((r) => [r.id, null]));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const main = chooseMain(group);
    for (const r of group) if (r.id !== main.id) target.set(r.id, main.id);
  }
  const changes = new Map<string, string | null>();
  for (const r of rows) {
    const want = target.get(r.id) ?? null;
    if (want !== r.mainOptionId) changes.set(r.id, want);
  }
  return changes;
}

// Las que todavía cuentan en el canal: una finalizada ya no choca con otra.
const LIVE: ChannelStatus[] = ['ACTIVE', 'PAUSED', 'UNDER_REVIEW', 'INACTIVE'];

/**
 * Las opciones de una misma medida con la misma forma de cobro: el canal
 * apaga una de las dos. Una lista por forma de cobro repetida.
 */
export function samePlanOptions<T extends { id: string; status: ChannelStatus | null; installments: number | null }>(
  options: T[],
): { plan: number; label: string; options: T[] }[] {
  const byPlan = new Map<number, T[]>();
  for (const o of options) {
    if (o.installments === null || !o.status || !LIVE.includes(o.status)) continue;
    byPlan.set(o.installments, [...(byPlan.get(o.installments) ?? []), o]);
  }
  return [...byPlan.entries()].filter(([, list]) => list.length > 1).map(([plan, list]) => ({ plan, label: planLabel(plan), options: list }));
}
