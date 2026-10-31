import { describe, expect, it } from 'vitest';
import { mercadolibreSalesLedger, parsePaymentMoney, parseSaleRecord, parseShipment } from '@/channels/mercadolibre/sales';
import { cashFlow, dispatchUrgency, parsePeriod, saleCost, saleMoney, splitShipping, summarize, type SaleParams } from '@/domain/sales';

// Las cuentas de Ventas y lo que se entiende de Mercado Libre, sin base de datos. Datos inventados.

const params: SaleParams = { vatRatePct: 21, taxesPct: 5, packaging: 500, channelFeePct: 14 };

describe('lo que se entiende de una venta de Mercado Libre', () => {
  it('importes, comisión por línea, comprador, pagos y envío', () => {
    const rec = parseSaleRecord({
      id: 2000009001,
      pack_id: 3000000001,
      status: 'paid',
      date_created: '2026-10-20T10:00:00.000-03:00',
      date_closed: '2026-10-20T10:01:00.000-03:00',
      currency_id: 'ARS',
      total_amount: 30000,
      paid_amount: 32000,
      seller: { id: 7 },
      buyer: { id: 99, nickname: 'COMPRADOR.PRUEBA', first_name: 'Ana', last_name: 'Prueba' },
      tags: ['paid', 'not_delivered'],
      order_items: [
        { item: { id: 'MLA9100001', title: 'Subconjunto SP-900', variation_id: null, seller_sku: 'SP-900-00' }, quantity: 2, unit_price: 15000, full_unit_price: 17000, sale_fee: 2100 },
      ],
      payments: [{ id: 555001, status: 'approved', transaction_amount: 32000, installments: 6, payment_type: 'credit_card', date_approved: '2026-10-20T10:01:00.000-03:00' }],
      shipping: { id: 44000001 },
      mediations: [],
    })!;
    expect(rec).toMatchObject({
      packId: '3000000001',
      state: 'paid',
      currency: 'ARS',
      itemsAmount: 30000,
      paidAmount: 32000,
      buyer: { id: '99', nickname: 'COMPRADOR.PRUEBA', name: 'Ana Prueba' },
      shipmentId: '44000001',
      claim: false,
      cancel: null,
    });
    // La comisión que informa Mercado Libre es por unidad: la línea lleva la de las 2.
    expect(rec.lines).toEqual([
      { listingId: 'MLA9100001', variationId: null, sku: 'SP-900-00', quantity: 2, title: 'Subconjunto SP-900', unitPrice: 15000, listPrice: 17000, fee: 4200 },
    ]);
    expect(rec.payments).toEqual([{ id: '555001', state: 'approved', amount: 32000, installments: 6, method: 'Tarjeta de crédito', approvedAt: '2026-10-20T10:01:00.000-03:00', refunded: 0 }]);
    // La parte del stock sigue igual.
    expect(rec.order).toMatchObject({ orderId: '2000009001', counts: true, cancelled: false });

    const cancelled = parseSaleRecord({
      id: 2000009002,
      status: 'cancelled',
      date_created: '2026-10-20T10:00:00.000-03:00',
      cancel_detail: { requested_by: 'buyer', description: 'Se arrepintió' },
      mediations: [{ id: 1 }],
      order_items: [],
      total_amount: 1000,
    })!;
    expect(cancelled).toMatchObject({ state: 'cancelled', claim: true, cancel: { by: 'buyer', reason: 'Se arrepintió' }, itemsAmount: 1000 });
    expect(parseSaleRecord({ id: 1, status: 'payment_required', date_created: 'x' })).toMatchObject({ state: 'pending' });
    expect(parseSaleRecord({ status: 'paid' })).toBeNull();
  });

  it('el envío: estado en palabras de la app, quién lo lleva, plazos y lo que paga cada uno', () => {
    const s = parseShipment(
      {
        id: 44000001,
        status: 'ready_to_ship',
        substatus: 'printed',
        mode: 'me2',
        logistic_type: 'cross_docking',
        tracking_number: 'TRK-1',
        shipping_option: { cost: 2000, estimated_handling_limit: { date: '2026-10-21T13:00:00.000-03:00' }, estimated_delivery_time: { date: '2026-10-24T00:00:00.000-03:00' } },
        status_history: { date_shipped: null, date_delivered: null },
        delay: [],
      },
      { receiver: { cost: 2000 }, senders: [{ cost: 3500.4 }] },
    );
    expect(s).toEqual({
      shipmentId: '44000001',
      state: 'to_ship',
      detail: 'Etiqueta impresa',
      kind: 'pickup',
      kindLabel: 'Colecta',
      tracking: 'TRK-1',
      dispatchBy: '2026-10-21T13:00:00.000-03:00',
      estimatedAt: '2026-10-24T00:00:00.000-03:00',
      shippedAt: null,
      deliveredAt: null,
      delayed: false,
      sellerCost: 3500.4,
      buyerCost: 2000,
    });
    // Ya lo retiró el correo aunque diga listo para despachar; Full lo despacha el canal; si vuelve, volvió.
    expect(parseShipment({ id: 1, status: 'ready_to_ship', substatus: 'picked_up', logistic_type: 'drop_off' }, null)).toMatchObject({ state: 'shipped', kind: 'drop_off', sellerCost: null });
    expect(parseShipment({ id: 1, status: 'delivered', logistic: { mode: 'me2', type: 'fulfillment' } }, null)).toMatchObject({ state: 'delivered', kind: 'channel', kindLabel: 'Full' });
    expect(parseShipment({ id: 1, status: 'not_delivered', substatus: 'returning_to_sender' }, null)).toMatchObject({ state: 'returned', kind: 'none' });
    expect(parseShipment({ id: 1, status: 'shipped', substatus: 'delayed', mode: 'custom' }, null)).toMatchObject({ state: 'shipped', delayed: true, kind: 'seller' });
  });

  it('lo que informa Mercado Pago, y los avisos de ventas, envíos y pagos', () => {
    expect(parsePaymentMoney({ id: 555001, money_release_date: '2026-11-02T10:00:00.000-03:00', money_release_status: 'pending', transaction_details: { net_received_amount: 24500 } })).toEqual({
      id: '555001',
      net: 24500,
      releaseAt: '2026-11-02T10:00:00.000-03:00',
      released: false,
      refunded: 0,
    });
    expect(parsePaymentMoney({ id: 1, money_release_status: 'released' })).toMatchObject({ released: true, net: null });
    const n = (topic: string, resource: string) => mercadolibreSalesLedger.parseSaleNotice({ topic, resource, user_id: 7, application_id: 99 });
    expect(n('orders_v2', '/orders/2000009001')).toEqual({ userId: '7', appId: '99', kind: 'order', id: '2000009001' });
    expect(n('shipments', '/shipments/44000001')).toMatchObject({ kind: 'shipment', id: '44000001' });
    expect(n('payments', '/collections/555001')).toMatchObject({ kind: 'payment', id: '555001' });
    expect(n('questions', '/questions/1')).toBeNull();
    expect(mercadolibreSalesLedger.saleUrl('2000009001')).toBe('https://www.mercadolibre.com.ar/ventas/2000009001/detalle');
  });
});

describe('lo que deja una venta', () => {
  it('el neto, lo estimado con los parámetros de la cuenta y la ganancia sobre el costo', () => {
    const m = saleMoney({ state: 'PAID', itemsAmount: 30000, listAmount: 34000, fee: 4200, shippingCost: 3500, netReceived: null, cost: 10000, params });
    expect(m).toMatchObject({ sold: 30000, discount: 4000, fee: 4200, net: 22300, received: 22300, receivedFromPayment: false, vat: 5206.61, taxes: 1500, packaging: 500, cost: 10000 });
    // 22300 − 5206,61 − 1500 − 500 − 10000
    expect(m.profit).toBe(5093.39);
    expect(m.marginPct).toBe(50.93);
    // Sin la comisión del canal, se estima; sin el costo del envío, cuenta 0 y se avisa; sin costo, sin ganancia.
    const guess = saleMoney({ state: 'PAID', itemsAmount: 10000, listAmount: null, fee: null, shippingCost: null, netReceived: 8000, cost: null, params });
    expect(guess).toMatchObject({ fee: 1400, feeEstimated: true, shipping: 0, shippingUnknown: true, net: 8600, received: 8000, receivedFromPayment: true, withheld: 600, profit: null, discount: null });
    // Una cancelada no deja nada.
    expect(saleMoney({ state: 'CANCELLED', itemsAmount: 10000, listAmount: null, fee: 1400, shippingCost: 0, netReceived: null, cost: 100, params })).toMatchObject({ cancelled: true, sold: 0, net: 0, profit: null });
  });

  it('el costo de la venta y el envío de un carrito repartido', () => {
    expect(saleCost([{ cost: 1000, quantity: 2 }, { cost: 250.5, quantity: 1 }])).toBe(2250.5);
    expect(saleCost([{ cost: 1000, quantity: 2 }, { cost: null, quantity: 1 }])).toBeNull();
    expect(splitShipping(3000, [10000, 20000])).toEqual([1000, 2000]);
    expect(splitShipping(1000, [1, 1, 1])).toEqual([333.33, 333.33, 333.34]);
  });

  it('el resumen de un período cuenta aparte las canceladas, las sin pagar y las sin costo', () => {
    const paid = (cost: number | null) => saleMoney({ state: 'PAID', itemsAmount: 10000, listAmount: 10000, fee: 1400, shippingCost: 1000, netReceived: null, cost, params });
    const s = summarize([
      { state: 'PAID', claim: false, units: 1, money: paid(3000), itemsAmount: 10000 },
      { state: 'PAID', claim: true, units: 2, money: paid(null), itemsAmount: 10000 },
      { state: 'CANCELLED', claim: false, units: 1, money: saleMoney({ state: 'CANCELLED', itemsAmount: 5000, listAmount: null, fee: null, shippingCost: null, netReceived: null, cost: null, params }), itemsAmount: 5000 },
      { state: 'PENDING', claim: false, units: 1, money: paid(1), itemsAmount: 7000 },
    ]);
    expect(s).toMatchObject({ count: 2, units: 3, sold: 20000, fee: 2800, shipping: 2000, net: 15200, withoutCost: 1, claims: 1, cancelled: { count: 1, amount: 5000 }, pending: { count: 1, amount: 7000 } });
    expect(s.withCost).toMatchObject({ count: 1, sold: 10000, cost: 3000 });
  });
});

describe('la plata, los períodos y los envíos', () => {
  const tz = 'America/Argentina/Buenos_Aires';
  const now = new Date('2026-10-31T15:00:00.000Z');

  it('lo liberado en el período y lo que falta, por día y sin fecha', () => {
    const range = { from: new Date('2026-10-01T03:00:00.000Z'), to: new Date('2026-11-01T03:00:00.000Z') };
    const c = cashFlow(
      [
        { state: 'PAID', received: 1000, releaseAt: new Date('2026-10-10T12:00:00.000Z'), released: true },
        { state: 'PAID', received: 500, releaseAt: new Date('2026-09-10T12:00:00.000Z'), released: true },
        { state: 'PAID', received: 2000, releaseAt: new Date('2026-11-03T12:00:00.000Z'), released: false },
        { state: 'PAID', received: 300, releaseAt: new Date('2026-11-03T20:00:00.000Z'), released: null },
        { state: 'PAID', received: 700, releaseAt: null, released: null },
        // Con la fecha pasada y retenida, por ejemplo por un reclamo: sin fecha.
        { state: 'PAID', received: 100, releaseAt: new Date('2026-10-20T12:00:00.000Z'), released: false },
        { state: 'CANCELLED', received: 9999, releaseAt: null, released: null },
      ],
      range,
      now,
      tz,
    );
    expect(c.released).toEqual({ amount: 1000, count: 1 });
    expect(c.waiting).toEqual({ amount: 3100, count: 4, days: [{ day: '2026-11-03', amount: 2300, count: 2 }], undated: { amount: 800, count: 2 } });
  });

  it('los períodos en la zona horaria de la cuenta', () => {
    expect(parsePeriod({}, now, tz)).toMatchObject({ key: '30d', fromDay: '2026-10-02', toDay: '2026-10-31' });
    const month = parsePeriod({ periodo: 'mes' }, now, tz);
    expect(month).toMatchObject({ fromDay: '2026-10-01', toDay: '2026-10-31', label: 'Este mes' });
    expect(month.from.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(month.to.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(parsePeriod({ periodo: 'mes-pasado' }, now, tz)).toMatchObject({ fromDay: '2026-09-01', toDay: '2026-09-30' });
    expect(parsePeriod({ desde: '2026-10-20', hasta: '2026-10-10' }, now, tz)).toMatchObject({ key: 'fechas', fromDay: '2026-10-10', toDay: '2026-10-20', label: 'Del 10/10/2026 al 20/10/2026' });
    expect(parsePeriod({ periodo: 'otro' }, now, tz, 'mes').key).toBe('mes');
  });

  it('cuánto falta para despachar', () => {
    expect(dispatchUrgency(new Date('2026-10-31T14:00:00.000Z'), now, tz)).toBe('late');
    expect(dispatchUrgency(new Date('2026-10-31T22:00:00.000Z'), now, tz)).toBe('today');
    expect(dispatchUrgency(new Date('2026-11-01T14:00:00.000Z'), now, tz)).toBe('later');
    expect(dispatchUrgency(null, now, tz)).toBeNull();
  });
});
