// El costo de reposición sin IVA es del producto, uno por medida, con la
// misma clave que el stock (src/domain/stock.ts). Cada publicación hereda el
// de la medida que vende. En el paso Precio, las medidas con el mismo costo
// comparten un precio, y las que cuestan distinto se calculan cada una en su
// pestaña. Este módulo no sabe de la base de datos, para poder probarlo solo.

/** El costo de una medida: el suyo o, si todavía no se cargó por medida, el general del producto. */
export function costOf(costs: ReadonlyMap<string, number>, general: number | null, key: string): number | null {
  return costs.get(key) ?? general;
}

/** El más alto de varios costos, para un precio que vale para todas esas medidas. Null si falta alguno. */
export function highestCost(costs: (number | null)[]): number | null {
  if (costs.length === 0 || costs.some((c) => c === null)) return null;
  return Math.max(...(costs as number[]));
}

/** Dos costos son el mismo si coinciden al centavo. */
const sameCost = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.round(a * 100) === Math.round(b * 100));

/**
 * Agrupa por costo, en el orden en que vienen: cada grupo es una pestaña del
 * paso Precio, con un precio para todos los suyos. Los que no tienen costo van
 * juntos.
 */
export function costGroups<T extends { cost: number | null }>(items: T[]): { cost: number | null; items: T[] }[] {
  const groups: { cost: number | null; items: T[] }[] = [];
  for (const item of items) {
    const found = groups.find((g) => sameCost(g.cost, item.cost));
    if (found) found.items.push(item);
    else groups.push({ cost: item.cost, items: [item] });
  }
  return groups;
}

/** "STD", "STD y 0.50", "STD, 0.25 y 0.50". */
export function measuresText(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}
