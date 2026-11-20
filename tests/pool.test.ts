import { describe, expect, it } from 'vitest';
import { runInGroups } from '@/lib/pool';

// Trabajos en paralelo con tope, los de un mismo grupo de a uno. Datos inventados.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runInGroups', () => {
  it('hace varios a la vez sin pasar el tope, y los del mismo grupo de a uno y en orden', async () => {
    let running = 0;
    let most = 0;
    const order: string[] = [];
    const items = ['a1', 'a2', 'b1', 'c1', 'd1', 'e1'];
    const { done, left } = await runInGroups(
      items,
      (x) => x[0],
      async (x) => {
        running++;
        most = Math.max(most, running);
        order.push(x);
        await wait(20);
        running--;
        return x.toUpperCase();
      },
      { concurrency: 3, budgetMs: 10_000 },
    );
    expect(most).toBe(3);
    expect(left).toEqual([]);
    expect([...done.values()].sort()).toEqual(['A1', 'A2', 'B1', 'C1', 'D1', 'E1']);
    expect(order.indexOf('a1')).toBeLessThan(order.indexOf('a2'));
  });

  it('pasado el tiempo no empieza más: lo que falta vuelve en orden, y lo empezado termina', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const { done, left } = await runInGroups(items, (x) => String(x), async (x) => {
      await wait(30);
      return x;
    }, { concurrency: 2, budgetMs: 40 });
    expect(done.size).toBeGreaterThanOrEqual(2);
    expect(done.size).toBeLessThan(10);
    expect([...done.keys(), ...left].sort((a, b) => a - b)).toEqual(items);
    expect(left).toEqual([...left].sort((a, b) => a - b));
  });
});
