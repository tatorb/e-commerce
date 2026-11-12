import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mercadolibrePublisher, PRICE_AUTOMATED, rejectionMessage } from '@/channels/mercadolibre/publish';
import { mercadolibreQuestions } from '@/channels/mercadolibre/questions';

// Por qué Mercado Libre no aceptó un cambio, y el precio que no cambia por la
// automatización de precios, contra un Mercado Libre simulado. Datos inventados.

describe('el motivo de un rechazo', () => {
  it('no toma un aviso como motivo: solo las causas que frenan', () => {
    const body = {
      message: 'Validation error',
      error: 'validation_error',
      cause: [
        { type: 'warning', code: 'create.item.attribute.business_conditional', message: 'Attribute [COLOR] to be added' },
        { type: 'error', code: 'item.title.minimum_length', message: 'Title too short' },
      ],
    };
    expect(rejectionMessage(400, body)).toMatch(/^Mercado Libre pide un título con más detalle del producto: Title too short Respuesta completa:/);
  });

  it('un título corto no se explica como largo', () => {
    expect(rejectionMessage(400, { cause: [{ type: 'error', code: 'item.title.minimum_length', message: 'Include more features' }] })).toMatch(/^Mercado Libre pide un título con más detalle/);
    expect(rejectionMessage(400, { cause: [{ code: 'item.title.length.invalid' }] })).toContain('más largo');
  });

  it('un rechazo con solo avisos no muestra un aviso como motivo', () => {
    const body = { message: 'Validation error', error: 'validation_error', cause: [{ type: 'warning', code: 'item.attributes.normalized', message: 'Attribute [X] normalized' }] };
    expect(rejectionMessage(400, body)).toMatch(/^Mercado Libre no lo aceptó: Validation error Respuesta completa:/);
  });

  it('el título le gana a un dato de catálogo que se nombra en el mismo motivo', () => {
    expect(rejectionMessage(400, { cause: [{ type: 'error', code: 'item.title.invalid', message: 'Title must not repeat the attribute BRAND' }] })).toMatch(
      /^Mercado Libre no aceptó el título: Title must not repeat the attribute BRAND/,
    );
  });

  it('"finalizada" solo cuando Mercado Libre dice que está finalizada', () => {
    expect(rejectionMessage(400, { cause: [{ type: 'error', code: 'item.status.closed', message: 'Item is closed' }] })).toBe(
      'La publicación está finalizada en Mercado Libre: no se puede cambiar.',
    );
    expect(rejectionMessage(400, { error: 'item.status.invalid', message: 'Item status does not allow this change', cause: [] })).toBe(
      'Mercado Libre no deja este cambio por el estado de la publicación: Item status does not allow this change',
    );
    expect(rejectionMessage(400, { cause: [{ type: 'error', code: 'item.status.under_review', message: 'Item is under_review' }] })).toContain('en revisión');
  });

  it('una marca que pide acreditación no se muestra como "en revisión"', () => {
    const body = { cause: [{ type: 'error', code: 'moderations.seller.not_authorized', message: 'Seller is not authorized for this brand and category' }] };
    expect(rejectionMessage(400, body)).toMatch(/^Mercado Libre no lo aceptó: Seller is not authorized for this brand and category/);
  });

  it('el precio con la automatización de precios prendida', () => {
    const body = { message: 'Cannot modify price on items with dynamic pricing', error: 'item.price.not_modifiable', status: 400, cause: [] };
    expect(rejectionMessage(400, body)).toBe(PRICE_AUTOMATED);
  });
});

describe('cambios contra Mercado Libre simulado', () => {
  let server: http.Server;
  const puts: { path: string; body: unknown }[] = [];
  let answers = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const send = (status: number, data: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
        const id = u.pathname.split('/')[2] ?? '';
        if (req.method === 'GET' && u.pathname.startsWith('/items/')) return send(200, { id, variations: [] });
        if (req.method === 'PUT' && u.pathname.startsWith('/items/')) {
          puts.push({ path: u.pathname, body: JSON.parse(raw) });
          // Con la automatización: responde bien, pero deja el precio y avisa.
          if (id === 'MLA1001') {
            return send(200, {
              id,
              price: 1000,
              warnings: [{ department: 'items', cause_id: 502, code: 'item.price.not_modifiable', message: 'Cannot modify price on items with dynamic pricing', references: ['item.price'] }],
            });
          }
          if (id === 'MLA1002') return send(400, { message: 'Cannot modify price on items with dynamic pricing', error: 'item.price.not_modifiable', status: 400, cause: [] });
          if (id === 'MLA1003') return send(502, { message: 'bad gateway' });
          return send(200, { id, price: 2000 });
        }
        if (req.method === 'POST' && u.pathname === '/answers') {
          answers++;
          return send(500, { message: 'internal error' });
        }
        send(404, {});
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.MERCADOLIBRE_API_URL;
  });

  it('si Mercado Libre responde bien pero avisa que no cambió el precio, es un rechazo', async () => {
    await expect(mercadolibrePublisher.updatePrice('llave', 'MLA1001', 2000)).rejects.toThrow(PRICE_AUTOMATED);
  });

  it('si Mercado Libre rechaza el precio por la automatización, lo explica', async () => {
    await expect(mercadolibrePublisher.updatePrice('llave', 'MLA1002', 2000)).rejects.toThrow(PRICE_AUTOMATED);
  });

  it('un precio aceptado sigue andando', async () => {
    await expect(mercadolibrePublisher.updatePrice('llave', 'MLA1004', 2000)).resolves.toBeUndefined();
    expect(puts.at(-1)).toEqual({ path: '/items/MLA1004', body: { price: 2000 } });
  });

  it('si falla del lado de Mercado Libre, se manda una sola vez y avisa que no se sabe si cambió', async () => {
    const before = puts.length;
    await expect(mercadolibrePublisher.updatePrice('llave', 'MLA1003', 2000)).rejects.toThrow('no se sabe si hizo el cambio');
    expect(puts.length - before).toBe(1);
  });

  it('una respuesta a un comprador que falla del lado de Mercado Libre no se repite', async () => {
    await expect(mercadolibreQuestions.answer('llave', '123456789', 'Hola, sí tenemos.')).rejects.toThrow('no se sabe si publicó la respuesta');
    expect(answers).toBe(1);
  });
});
