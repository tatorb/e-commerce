import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MercadoLibreRequestError, mlGet, mlSend, parseBulk, readItems } from '@/channels/mercadolibre/http';

// Pedidos a la API de Mercado Libre, contra un Mercado Libre simulado.

describe('varias publicaciones a la vez', () => {
  it('lee las tres formas conocidas de /items/bulk y descarta las que fallaron', () => {
    expect(parseBulk([{ code: 200, body: { id: 'MLA1' } }, { code: 404, body: { message: 'not found' } }])).toEqual([{ id: 'MLA1' }]);
    expect(parseBulk([{ id: 'MLA1', status_code: 200, body: { id: 'MLA1', title: 'Kit' } }, { id: 'MLA2', status_code: 404, error: 'x' }])).toEqual([
      { id: 'MLA1', title: 'Kit' },
    ]);
    expect(parseBulk([{ body: { id: 'MLA1' } }, {}])).toEqual([{ id: 'MLA1' }]);
    expect(parseBulk({ error: 'x' })).toEqual([]);
  });
});

describe('pedidos con la llave', () => {
  let server: http.Server;
  let calls = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://x');
      calls++;
      if (req.headers.authorization !== 'Bearer llave') {
        res.writeHead(401).end('{}');
        return;
      }
      if (u.pathname === '/lento') {
        // Pide esperar la primera vez.
        if (calls === 1) {
          res.writeHead(429, { 'Retry-After': '0' }).end('{}');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        return;
      }
      if (u.pathname === '/siempre-429') {
        res.writeHead(429, { 'Retry-After': '0' }).end('{}');
        return;
      }
      // Falla de su lado la primera vez.
      if (u.pathname === '/falla-una-vez') {
        if (calls === 1) {
          res.writeHead(500).end('{}');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        return;
      }
      if (u.pathname === '/siempre-falla') {
        res.writeHead(503).end('{"message":"service unavailable"}');
        return;
      }
      // Se corta la conexión sin responder.
      if (u.pathname === '/corte') {
        req.socket.destroy();
        return;
      }
      if (u.pathname === '/items/bulk') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([{ body: { id: 'MLA1', seller_id: 7 } }, {}]));
        return;
      }
      res.writeHead(404).end('{}');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    process.env.MERCADOLIBRE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.MERCADOLIBRE_API_URL;
  });

  it('reintenta cuando Mercado Libre pide esperar', async () => {
    calls = 0;
    expect(await mlGet('/lento', 'llave')).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('después de 3 intentos avisa, y una llave que no sirve pide volver a conectar', async () => {
    calls = 0;
    await expect(mlGet('/siempre-429', 'llave')).rejects.toThrow('demasiados pedidos');
    expect(calls).toBe(3);
    await expect(mlGet('/siempre-429', 'llave')).rejects.toMatchObject({ busy: true, reauth: false });
    await expect(mlGet('/lento', 'otra')).rejects.toMatchObject({ reauth: true });
  });

  it('una lectura que falla del lado de Mercado Libre se reintenta', async () => {
    calls = 0;
    expect(await mlGet('/falla-una-vez', 'llave')).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('un cambio se reintenta solo cuando Mercado Libre pide esperar', async () => {
    calls = 0;
    expect(await mlSend('POST', '/lento', 'llave', { a: 1 })).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('un cambio que falla del lado de Mercado Libre no se repite y avisa que no se sabe si se hizo', async () => {
    calls = 0;
    const e = (await mlSend('POST', '/falla-una-vez', 'llave', { a: 1 }).catch((x: unknown) => x)) as MercadoLibreRequestError;
    expect(calls).toBe(1);
    expect(e).toBeInstanceOf(MercadoLibreRequestError);
    expect(e).toMatchObject({ status: 500, changeUnknown: true, reauth: false });
    expect(e.message).toContain('no se sabe si hizo el cambio');
    calls = 0;
    await expect(mlSend('PUT', '/siempre-falla', 'llave', { a: 1 })).rejects.toMatchObject({ status: 503, changeUnknown: true });
    expect(calls).toBe(1);
  });

  it('si se corta la conexión en un cambio, no se repite y avisa que no se sabe si se hizo', async () => {
    calls = 0;
    await expect(mlSend('POST', '/corte', 'llave', { a: 1 })).rejects.toThrow('no se sabe si hizo el cambio');
    expect(calls).toBe(1);
    // Una lectura sí se reintenta.
    calls = 0;
    await expect(mlGet('/corte', 'llave')).rejects.toThrow('No se pudo conectar');
    expect(calls).toBe(3);
  });

  it('un rechazo común de un cambio no queda como "no se sabe"', async () => {
    await expect(mlSend('PUT', '/no-existe', 'llave', {})).rejects.toMatchObject({ status: 404, changeUnknown: false });
  });

  it('readItems pide hasta 20 y lee la forma nueva', async () => {
    expect(await readItems('llave', ['MLA1', 'MLA2'], ['id', 'seller_id'])).toEqual([{ id: 'MLA1', seller_id: 7 }]);
    expect(await readItems('llave', [], ['id'])).toEqual([]);
  });
});
