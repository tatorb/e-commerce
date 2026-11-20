// Trabajos en paralelo con un tope: varios a la vez, pero los del mismo grupo
// de a uno y en orden. Dentro de un tiempo: lo que no llegó a empezar vuelve en
// left, en el orden en que venía. Lo que empezó se espera hasta que termina.

export async function runInGroups<T, R>(
  items: T[],
  groupOf: (item: T) => string,
  work: (item: T) => Promise<R>,
  opts: { concurrency: number; budgetMs: number },
): Promise<{ done: Map<T, R>; left: T[] }> {
  const started = Date.now();
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(groupOf(item), [...(groups.get(groupOf(item)) ?? []), item]);
  const waiting = [...groups.values()];
  const done = new Map<T, R>();
  const begun = new Set<T>();
  const worker = async () => {
    for (let group = waiting.shift(); group; group = waiting.shift()) {
      for (const item of group) {
        if (Date.now() - started > opts.budgetMs) break;
        begun.add(item);
        done.set(item, await work(item));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, waiting.length)) }, worker));
  return { done, left: items.filter((i) => !begun.has(i)) };
}
