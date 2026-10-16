import { describe, expect, it } from 'vitest';
import { parsePrice } from '@/domain/money';

describe('precio escrito a mano', () => {
  it.each([
    ['', null],
    ['125000', 125000],
    ['125.000', 125000],
    ['1.125.000', 1125000],
    ['$ 125.000,50', 125000.5],
    ['125000,5', 125000.5],
    ['125000.50', 125000.5],
  ])('%s', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });

  it.each(['abc', '15,8,1', '-100', '1.58.145'])('rechaza %s', (raw) => {
    expect(parsePrice(raw)).toBe('invalid');
  });
});
