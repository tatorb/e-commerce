import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isBlobConfigured, readBlob, signedDownloadUrl } from '@/lib/files';

// Los links firmados del depósito de Vercel, con el permiso automático de
// Vercel (sin clave) y un depósito simulado. Sirven para leer lo que quedó ahí
// hasta pasarlo al Drive. Datos inventados.

describe('links firmados del depósito', () => {
  let server: http.Server;
  let base = '';
  const asked: { pathname?: string; operations?: string[]; allowedContentTypes?: string[] }[] = [];
  const saved = { ...process.env };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      if (req.method === 'POST' && u.pathname === '/signed-token') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          asked.push(JSON.parse(body));
          const payload = Buffer.from(JSON.stringify({ storeId: 'store_prueba', ...JSON.parse(body) })).toString('base64url');
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ delegationToken: `${payload}.firma`, clientSigningToken: 'clave-de-firma', validUntil: Date.now() + 60_000 }));
        });
        return;
      }
      if (req.method === 'GET' && u.pathname.startsWith('/files/')) {
        const signed = u.searchParams.has('vercel-blob-signature');
        res.writeHead(signed ? 200 : 403, { 'content-type': 'image/jpeg' });
        res.end(signed ? 'jpg' : '');
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    asked.length = 0;
    process.env.VERCEL_BLOB_API_URL = base;
    process.env.BLOB_TEST_URL_PREFIX = `${base}/files/`;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    // Como en Vercel con el depósito conectado por OIDC: un id de depósito y un permiso que vence en el año 2286.
    process.env.BLOB_STORE_ID = 'store_prueba';
    const jwt = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    process.env.VERCEL_OIDC_TOKEN = `${jwt({ alg: 'none' })}.${jwt({ exp: 9999999999 })}.firma`;
  });

  afterAll(() => {
    server.close();
    process.env = saved;
  });

  it('con el permiso automático de Vercel el depósito cuenta como conectado', () => {
    expect(isBlobConfigured()).toBe(true);
    delete process.env.BLOB_STORE_ID;
    expect(isBlobConfigured()).toBe(false);
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_prueba_secretoinventado';
    expect(isBlobConfigured()).toBe(true);
  });

  it('los archivos se leen con un link firmado que vence solo', async () => {
    const file = `${base}/files/imagenes/p1/f1/c1/vista.jpg`;
    const link = await signedDownloadUrl(file, 60_000, true);
    expect(asked[0]).toMatchObject({ pathname: 'imagenes/p1/f1/c1/vista.jpg', operations: ['get'] });
    expect(link.startsWith(`${base}/files/imagenes/p1/f1/c1/vista.jpg?`)).toBe(true);
    expect(new URL(link).searchParams.get('download')).toBe('1');
    const res = await readBlob(file);
    expect(await res!.text()).toBe('jpg');
    await expect(signedDownloadUrl('https://otro-sitio.com/x.jpg', 60_000)).rejects.toThrow('depósito');
  });
});
