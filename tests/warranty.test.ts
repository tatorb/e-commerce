import { describe, expect, it } from 'vitest';
import { makeWarranty, parseWarrantyTime, sameWarranty, warrantyFromText, warrantyLabel } from '@/domain/warranty';
import { fingerprint } from '@/domain/channel-sync';
import { warrantyOf, warrantyTerms, withWarranty } from '@/channels/mercadolibre/warranty';
import { parseItem } from '@/channels/mercadolibre/listings';
import { warrantyForCreate } from '@/lib/warranty';

// La garantía: cómo se dice, cómo se compara y cómo se traduce a Mercado Libre. Datos de prueba.

describe('la garantía', () => {
  it('se dice en palabras y compara el mismo tiempo dicho de otra forma', () => {
    expect(warrantyLabel(makeWarranty('seller', 15, 'days'))).toBe('Garantía del vendedor, 15 días');
    expect(warrantyLabel(makeWarranty('factory', 1, 'years'))).toBe('Garantía de fábrica, 1 año');
    expect(warrantyLabel(makeWarranty('none'))).toBe('Sin garantía');
    expect(sameWarranty(makeWarranty('seller', 1, 'years'), makeWarranty('seller', 12, 'months'))).toBe(true);
    expect(sameWarranty(makeWarranty('seller', 30, 'days'), makeWarranty('seller', 1, 'months'))).toBe(false);
    expect(sameWarranty(makeWarranty('seller', 6, 'months'), makeWarranty('factory', 6, 'months'))).toBe(false);
    expect(parseWarrantyTime(' 90 dias ')).toEqual({ amount: 90, unit: 'days' });
    expect(parseWarrantyTime('1 año')).toEqual({ amount: 1, unit: 'years' });
    expect(warrantyFromText('De fábrica')).toBeNull();
    expect(() => makeWarranty('seller', 20, 'years')).toThrow('no puede pasar de 10 años');
  });

  it('sin cargar en la app sigue a la del canal: no queda nada para subir', () => {
    expect(fingerprint('warranty', null)).toBe(fingerprint('photos', null));
    expect(fingerprint('warranty', makeWarranty('seller', 15, 'days'))).toBe(fingerprint('warranty', { type: 'seller', amount: 15, unit: 'days' }));
  });

  it('en Mercado Libre: se lee de los términos de venta y se manda con los demás como estaban', () => {
    expect(warrantyOf({ sale_terms: [{ id: 'WARRANTY_TYPE', value_id: '2230279', value_name: 'Garantía de fábrica' }, { id: 'WARRANTY_TIME', value_name: '6 meses' }] })).toEqual({
      type: 'factory',
      amount: 6,
      unit: 'months',
    });
    expect(warrantyOf({ sale_terms: [{ id: 'WARRANTY_TYPE', value_name: 'Sin garantía' }] })).toEqual({ type: 'none', amount: null, unit: null });
    expect(warrantyOf({ sale_terms: [] })).toEqual({ type: 'none', amount: null, unit: null });
    // Sin pedir los términos, no se sabe cuál tiene.
    expect(parseItem({ id: 'MLA9', title: 'Prueba' }).warranty).toBeUndefined();
    expect(parseItem({ id: 'MLA9', title: 'Prueba', sale_terms: [{ id: 'WARRANTY_TIME', value_struct: { number: 15, unit: 'días' } }] }).warranty).toEqual({
      type: 'seller',
      amount: 15,
      unit: 'days',
    });
    expect(warrantyTerms(makeWarranty('none'))).toEqual([{ id: 'WARRANTY_TYPE', value_name: 'Sin garantía' }]);
    expect(withWarranty([{ id: 'INVOICE', value_id: '6891885', value_name: 'Factura A' }, { id: 'WARRANTY_TIME', value_name: '3 meses' }], makeWarranty('seller', 15, 'days'))).toEqual([
      { id: 'INVOICE', value_id: '6891885', value_name: 'Factura A' },
      { id: 'WARRANTY_TYPE', value_name: 'Garantía del vendedor' },
      { id: 'WARRANTY_TIME', value_name: '15 días' },
    ]);
  });

  it('al crear: la de la publicación, si no la de la cuenta, si no la de la ficha', () => {
    const account = makeWarranty('seller', 15, 'days');
    expect(warrantyForCreate({ type: 'factory', amount: 1, unit: 'years' }, account, '6 meses')).toEqual({ warranty: makeWarranty('factory', 1, 'years'), from: 'publicación' });
    expect(warrantyForCreate(null, account, '6 meses')).toEqual({ warranty: account, from: 'cuenta' });
    expect(warrantyForCreate(null, null, '6 meses')).toEqual({ warranty: makeWarranty('seller', 6, 'months'), from: 'ficha' });
    expect(warrantyForCreate(null, null, 'Consultar')).toEqual({ warranty: null, from: null });
  });
});
