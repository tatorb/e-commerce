// Las etiquetas de promociones de un producto, que valen para todas sus
// publicaciones, y el objetivo que sale de ellas. Sin la base de datos.

export const LIFECYCLES = ['NEW', 'GROWING', 'MATURE', 'CLEARANCE'] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  NEW: 'Nueva a posicionar',
  GROWING: 'En crecimiento',
  MATURE: 'Madurada',
  CLEARANCE: 'A liquidar',
};

export const COMPETITIONS = ['PRICE_FIGHT', 'NO_COMPETITION'] as const;
export type Competition = (typeof COMPETITIONS)[number];
export const COMPETITION_LABEL: Record<Competition, string> = { PRICE_FIGHT: 'Pelea por precio', NO_COMPETITION: 'Sin competencia' };

export const PRIORITIES = ['PUSH', 'SEASONAL'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { PUSH: 'Empujar', SEASONAL: 'Estacional' };

/** Los grupos de etiquetas: cada uno se pone a mano o lo propone una regla. */
export const TAG_GROUPS = ['lifecycle', 'competition', 'inCatalog', 'stockControl', 'priority'] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];
export const TAG_GROUP_LABEL: Record<TagGroup, string> = {
  lifecycle: 'Ciclo de vida',
  competition: 'Competencia',
  inCatalog: 'En catálogo',
  stockControl: 'Control de stock',
  priority: 'Prioridad comercial',
};
/** Los que propone una regla; los demás son solo a mano. */
export const RULE_GROUPS: readonly TagGroup[] = ['lifecycle', 'competition', 'inCatalog'];

export type PromoTags = {
  lifecycle: Lifecycle | null;
  competition: Competition | null;
  inCatalog: boolean;
  stockControl: boolean;
  priority: Priority | null;
};

export const NO_TAGS: PromoTags = { lifecycle: null, competition: null, inCatalog: false, stockControl: false, priority: null };

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);

/** Las etiquetas como están guardadas, descartando lo que no se reconoce. */
export function readTags(row: { lifecycle?: string | null; competition?: string | null; inCatalog?: boolean; stockControl?: boolean; priority?: string | null } | null | undefined): PromoTags {
  if (!row) return NO_TAGS;
  return {
    lifecycle: oneOf(LIFECYCLES, row.lifecycle),
    competition: oneOf(COMPETITIONS, row.competition),
    inCatalog: row.inCatalog === true,
    stockControl: row.stockControl === true,
    priority: oneOf(PRIORITIES, row.priority),
  };
}

export const OBJECTIVES = ['POSITION', 'PRICE', 'CLEAR', 'HOLD'] as const;
export type Objective = (typeof OBJECTIVES)[number];
export const OBJECTIVE_LABEL: Record<Objective, string> = {
  POSITION: 'Posicionar',
  PRICE: 'Competir por precio',
  CLEAR: 'Rotar o liquidar',
  HOLD: 'Sostener madurada',
};

/** El objetivo que sale de las etiquetas. Null sin ciclo de vida: todavía no tiene almanaque. */
export function objectiveOf(tags: PromoTags): Objective | null {
  if (tags.lifecycle === null) return null;
  if (tags.lifecycle === 'CLEARANCE') return 'CLEAR';
  if (tags.competition === 'PRICE_FIGHT') return 'PRICE';
  return tags.lifecycle === 'MATURE' ? 'HOLD' : 'POSITION';
}

/** Las etiquetas en palabras, para mostrarlas juntas. */
export function tagsText(tags: PromoTags): string[] {
  return [
    tags.lifecycle ? LIFECYCLE_LABEL[tags.lifecycle] : null,
    tags.competition ? COMPETITION_LABEL[tags.competition] : null,
    tags.inCatalog ? 'En catálogo' : null,
    tags.stockControl ? 'Control de stock' : null,
    tags.priority ? PRIORITY_LABEL[tags.priority] : null,
  ].filter((x): x is string => x !== null);
}
