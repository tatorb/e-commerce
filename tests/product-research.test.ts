import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  addInsight,
  cleanInsight,
  cleanRichText,
  deleteInsight,
  manufacturerSchema,
  markdownToRichText,
  replaceInsights,
  richTextToMarkdown,
  withoutPrices,
  moveInsight,
  ResearchError,
  updateInsight,
  updateResearch,
} from '@/domain/research';
import { deleteProductFile, FileError, isOwnBlobUrl, readBlob, registerProductFile, safeFileName } from '@/lib/files';

// Datos inventados.

describe('texto con formato', () => {
  it('deja solo párrafos, negrita, cursiva y listas', () => {
    expect(cleanRichText('<p>Hola <strong>uno</strong> <em>dos</em></p><ul><li>a</li></ul><ol><li>b</li></ol>')).toBe(
      '<p>Hola <strong>uno</strong> <em>dos</em></p><ul><li>a</li></ul><ol><li>b</li></ol>',
    );
    expect(cleanRichText('<p onclick="x()" style="color:red">Hola <b>uno</b> <i>dos</i></p>')).toBe(
      '<p>Hola <strong>uno</strong> <em>dos</em></p>',
    );
    expect(cleanRichText('<script>alert(1)</script><p>Texto <a href="javascript:x">link</a> <img src=x onerror=y></p>')).toBe(
      '<p>Texto link </p>',
    );
    expect(cleanRichText('<h1>Título</h1>')).toBe('<p>Título</p>');
  });

  it('vacío da null, y no acepta textos enormes', () => {
    expect(cleanRichText('<p></p>')).toBeNull();
    expect(cleanRichText('  ')).toBeNull();
    expect(() => cleanRichText(`<p>${'a'.repeat(60_000)}</p>`)).toThrow(ResearchError);
  });
});

describe('texto con formato para Claude', () => {
  it('ida y vuelta entre HTML y Markdown simple', () => {
    const html = '<p>Sirve para <strong>Gol 1.6</strong> y <em>Saveiro</em>.</p><ul><li><p>No confundir con 1.4</p></li></ul><ol><li><p>Uno</p></li><li><p>Dos</p></li></ol>';
    const md = richTextToMarkdown(html);
    expect(md).toBe('Sirve para **Gol 1.6** y _Saveiro_.\n- No confundir con 1.4\n1. Uno\n2. Dos');
    expect(markdownToRichText(md)).toBe(html);
  });

  it('escapa lo que no es formato y vacío da null', () => {
    expect(markdownToRichText('<b>x</b> & *y*')).toBe('<p>&lt;b&gt;x&lt;/b&gt; &amp; <em>y</em></p>');
    expect(markdownToRichText('  \n ')).toBeNull();
    expect(richTextToMarkdown(null)).toBe('');
  });

  it('oculta las líneas que parecen precios', () => {
    expect(withoutPrices('Diámetro 200 mm\nPrecio de lista: 1000\nCosto $ 500\n24 estrías')).toEqual({ text: 'Diámetro 200 mm\n24 estrías', hidden: 2 });
    expect(withoutPrices(null)).toEqual({ text: null, hidden: 0 });
  });
});

describe('datos del fabricante', () => {
  it('links con http o https, y vacío es sin dato', () => {
    expect(manufacturerSchema.parse({ site: ' https://fabricante.com ', productUrl: '', text: '  ' })).toEqual({
      site: 'https://fabricante.com',
      productUrl: null,
      text: null,
    });
    expect(manufacturerSchema.safeParse({ site: 'fabricante.com', productUrl: '', text: '' }).success).toBe(false);
    expect(manufacturerSchema.safeParse({ site: 'javascript:alert(1)', productUrl: '', text: '' }).success).toBe(false);
  });

  it('dolores sin espacios de más, ni vacíos', () => {
    expect(cleanInsight('  no sabe   si le sirve ')).toBe('no sabe si le sirve');
    expect(() => cleanInsight('   ')).toThrow('Escribí algo.');
  });
});

describe('archivos', () => {
  it('nombres prolijos para la dirección', () => {
    expect(safeFileName('Catálogo Embragues 2026 (final).PDF')).toBe('catalogo-embragues-2026-final.pdf');
    expect(safeFileName('???.png')).toBe('archivo.png');
  });

  it('solo direcciones del depósito de Vercel', () => {
    expect(isOwnBlobUrl('https://abc123.public.blob.vercel-storage.com/productos/p/x.pdf')).toBe(true);
    expect(isOwnBlobUrl('http://abc123.public.blob.vercel-storage.com/x.pdf')).toBe(false);
    expect(isOwnBlobUrl('https://blob.vercel-storage.com.otro-sitio.com/x.pdf')).toBe(false);
    expect(isOwnBlobUrl('https://otro-sitio.com/x.pdf')).toBe(false);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('investigación del producto en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let productId = '';
  let otherId = '';

  // Depósito simulado: lo que pregunta la app sobre cada archivo.
  const blobs = new Map<string, { pathname: string; size: number; contentType: string }>();
  const deleted: string[] = [];
  let lastAuth = '';
  let server: http.Server;
  let base = '';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      if (req.method === 'GET' && u.searchParams.has('url')) {
        const b = blobs.get(u.searchParams.get('url')!);
        res.writeHead(b ? 200 : 404, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify(
            b
              ? { url: u.searchParams.get('url'), downloadUrl: '', pathname: b.pathname, size: b.size, contentType: b.contentType, uploadedAt: new Date().toISOString() }
              : { error: { code: 'not_found', message: 'no existe' } },
          ),
        );
        return;
      }
      if (req.method === 'GET' && u.pathname.startsWith('/files/')) {
        lastAuth = req.headers.authorization ?? '';
        const found = blobs.has(`${base}${u.pathname}`);
        res.writeHead(found ? 200 : 404, { 'content-type': 'application/pdf' });
        res.end(found ? '%PDF-1.4' : '');
        return;
      }
      if (req.method === 'POST' && u.pathname === '/delete') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          deleted.push(...JSON.parse(body).urls);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{}');
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.VERCEL_BLOB_API_URL = base;
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_prueba_secretoinventado';
    process.env.BLOB_TEST_URL_PREFIX = `${base}/files/`;
  });

  afterAll(async () => {
    server.close();
    delete process.env.VERCEL_BLOB_API_URL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_TEST_URL_PREFIX;
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE product_files, buyer_insights, product_research, products, accounts, users CASCADE');
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Kit A' } })).id;
    otherId = (await db.product.create({ data: { accountId, name: 'Kit B' } })).id;
    blobs.clear();
    deleted.length = 0;
  });

  it('guarda solo los campos que llegan', async () => {
    await updateResearch(db, { productId, userId: 'u1', data: { manufacturerSite: 'https://f.com', manufacturerText: 'texto' } });
    await updateResearch(db, { productId, userId: 'u1', data: { ownQuestions: '¿sirve para Gol?' } });
    expect(await db.productResearch.findUniqueOrThrow({ where: { productId } })).toMatchObject({
      manufacturerSite: 'https://f.com',
      manufacturerText: 'texto',
      ownQuestions: '¿sirve para Gol?',
      competitorQuestions: null,
      updatedById: 'u1',
    });
  });

  it('dolores y objeciones: agregar, ordenar, editar y borrar, cada lista por su lado', async () => {
    const add = (kind: 'PAIN' | 'OBJECTION', text: string) => db.$transaction((tx) => addInsight(tx, { productId, kind, text }));
    const a = await add('PAIN', 'uno');
    const b = await add('PAIN', 'dos');
    const c = await add('PAIN', 'tres');
    await add('OBJECTION', 'objeción');
    const texts = async (kind: 'PAIN' | 'OBJECTION') =>
      (await db.buyerInsight.findMany({ where: { productId, kind }, orderBy: { position: 'asc' } })).map((i) => i.text);
    expect(await texts('PAIN')).toEqual(['uno', 'dos', 'tres']);

    await db.$transaction((tx) => moveInsight(tx, { productId, id: c.id, direction: 'up' }));
    expect(await texts('PAIN')).toEqual(['uno', 'tres', 'dos']);
    await db.$transaction((tx) => moveInsight(tx, { productId, id: a.id, direction: 'up' }));
    expect(await texts('PAIN')).toEqual(['uno', 'tres', 'dos']);
    await db.$transaction((tx) => moveInsight(tx, { productId, id: a.id, direction: 'down' }));
    expect(await texts('PAIN')).toEqual(['tres', 'uno', 'dos']);

    await updateInsight(db, { productId, id: b.id, text: 'dos, editado' });
    await deleteInsight(db, { productId, id: a.id });
    expect(await texts('PAIN')).toEqual(['tres', 'dos, editado']);
    expect(await texts('OBJECTION')).toEqual(['objeción']);
    // Solo los del producto.
    await expect(updateInsight(db, { productId: otherId, id: b.id, text: 'x' })).rejects.toThrow('ya no existe');
  });

  it('reemplazar una lista deja la otra como estaba', async () => {
    await db.$transaction((tx) => addInsight(tx, { productId, kind: 'OBJECTION', text: 'objeción' }));
    await db.$transaction((tx) => replaceInsights(tx, { productId, kind: 'PAIN', texts: ['a', ' a ', 'b'] }));
    const all = await db.buyerInsight.findMany({ where: { productId }, orderBy: [{ kind: 'asc' }, { position: 'asc' }] });
    expect(all.map((i) => [i.kind, i.text, i.position])).toEqual([
      ['PAIN', 'a', 0],
      ['PAIN', 'b', 1],
      ['OBJECTION', 'objeción', 0],
    ]);
  });

  it('anota un archivo del depósito con su tipo y peso reales', async () => {
    const fileUrl = `${base}/files/productos/${productId}/catalogo-ab12.pdf`;
    blobs.set(fileUrl, { pathname: `productos/${productId}/catalogo-ab12.pdf`, size: 2048, contentType: 'application/pdf' });
    const f = await registerProductFile(db, { productId, url: fileUrl, name: 'Catálogo.pdf', userId: 'u1' });
    expect(f).toMatchObject({ kind: 'PDF', name: 'Catálogo.pdf', size: 2048, contentType: 'application/pdf', uploadedById: 'u1' });

    await deleteProductFile(db, { productId, fileId: f.id });
    expect(deleted).toEqual([fileUrl]);
    expect(await db.productFile.count()).toBe(0);
  });

  it('lee un archivo privado con la clave de la app', async () => {
    const fileUrl = `${base}/files/productos/${productId}/x.pdf`;
    blobs.set(fileUrl, { pathname: `productos/${productId}/x.pdf`, size: 8, contentType: 'application/pdf' });
    const res = await readBlob(fileUrl);
    expect(await res!.text()).toBe('%PDF-1.4');
    expect(lastAuth).toBe('Bearer vercel_blob_rw_prueba_secretoinventado');
    expect(await readBlob(`${base}/files/productos/${productId}/no-esta.pdf`)).toBeNull();
    await expect(readBlob('https://otro-sitio.com/x.pdf')).rejects.toThrow(FileError);
  });

  it('rechaza archivos de otro lado, de otro producto, de otro tipo o muy pesados', async () => {
    const put = (name: string, size: number, contentType: string, owner = productId) => {
      const u = `${base}/files/productos/${owner}/${name}`;
      blobs.set(u, { pathname: `productos/${owner}/${name}`, size, contentType });
      return u;
    };
    const reg = (u: string) => registerProductFile(db, { productId, url: u, name: 'x', userId: null });
    await expect(reg('https://otro-sitio.com/x.pdf')).rejects.toThrow(FileError);
    await expect(reg(put('a.pdf', 10, 'application/pdf', otherId))).rejects.toThrow('otro producto');
    await expect(reg(put('b.pdf', 10, 'text/html'))).rejects.toThrow('tipo');
    await expect(reg(put('c.exe', 10, 'application/octet-stream'))).rejects.toThrow('tipo');
    await expect(reg(put('d.png', 11 * 1024 * 1024, 'image/png'))).rejects.toThrow('pesa');
    expect((await reg(put('e.png', 1000, 'image/png'))).kind).toBe('IMAGE');
  });
});
