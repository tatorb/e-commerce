import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { completeDriveAuthorization, ensureFolder, photoFolder, saveDriveCredentials, startDriveAuthorization, withDriveToken } from '@/lib/drive';
import { addUploadedProductFile } from '@/lib/files';
import { deleteVercelBatch, moveBatch, vercelLeft } from '@/lib/move-to-drive';
import { outputTransfers, photoOwner, runOutputs, syncCorrected } from '@/lib/photo-files';
import { addDriveOriginal, addUploadedOriginals, syncOriginals } from '@/lib/photos';
import { approveStep, archivePhoto, claimNext, redoStep } from '@/lib/photo-queue';
import { createWorkerKey, verifyWorkerRequest } from '@/lib/image-worker';
import { readStored, removeStored } from '@/lib/stored-files';
import { startFakeGoogle, type FakeGoogle } from './fake-google';

// Las fotos y los archivos del fabricante en el Drive del estudio, contra un
// Google simulado, y el pase desde el depósito de Vercel simulado. Datos de
// prueba.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('fotos y archivos en el Drive', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let google: FakeGoogle;
  let vercel: http.Server;
  let vercelBase = '';
  // El depósito de Vercel simulado: dirección → contenido.
  const blobs = new Map<string, Buffer>();
  let accountId = '';
  let productId = '';
  const userId = 'u1';

  beforeAll(async () => {
    process.env.CHANNEL_TOKEN_KEY = 'clave-de-prueba-para-cifrar';
    process.env.BETTER_AUTH_URL = 'http://app.prueba';
    google = await startFakeGoogle();
    process.env.GOOGLE_AUTH_URL = `${google.url}/auth`;
    process.env.GOOGLE_TOKEN_URL = `${google.url}/token`;
    process.env.GOOGLE_REVOKE_URL = `${google.url}/revoke`;
    process.env.GOOGLE_API_URL = google.url;
    vercel = http.createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      if (req.method === 'GET' && u.pathname.startsWith('/files/')) {
        const b = blobs.get(`${vercelBase}${u.pathname}`);
        res.writeHead(b ? 200 : 404);
        return res.end(b ?? '');
      }
      // La lista del depósito.
      if (req.method === 'GET' && u.searchParams.has('limit')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        const all = [...blobs.keys()].map((k) => ({ url: k, downloadUrl: k, pathname: k.split('/files/')[1], size: blobs.get(k)!.length, uploadedAt: new Date().toISOString() }));
        return res.end(JSON.stringify({ blobs: all.slice(0, Number(u.searchParams.get('limit'))), hasMore: all.length > Number(u.searchParams.get('limit')) }));
      }
      if (req.method === 'POST' && u.pathname === '/delete') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          for (const k of JSON.parse(body).urls) blobs.delete(k);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{}');
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => vercel.listen(0, '127.0.0.1', r));
    vercelBase = `http://127.0.0.1:${(vercel.address() as AddressInfo).port}`;
    process.env.VERCEL_BLOB_API_URL = vercelBase;
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_prueba_secretoinventado';
    process.env.BLOB_TEST_URL_PREFIX = `${vercelBase}/files/`;
  });

  afterAll(async () => {
    await google.close();
    vercel.close();
    for (const k of ['GOOGLE_AUTH_URL', 'GOOGLE_TOKEN_URL', 'GOOGLE_REVOKE_URL', 'GOOGLE_API_URL', 'BETTER_AUTH_URL', 'VERCEL_BLOB_API_URL', 'BLOB_READ_WRITE_TOKEN', 'BLOB_TEST_URL_PREFIX']) {
      delete process.env[k];
    }
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE drive_connections, drive_folders, photo_step_runs, photo_edits, product_files, image_workers, products, accounts, users CASCADE',
    );
    google.files.clear();
    blobs.clear();
    await db.user.create({ data: { id: userId, name: 'Juani', email: 'juani@prueba.com' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Kit de pistones', productType: 'Pistón' } })).id;
    await saveDriveCredentials(db, { clientId: '123-prueba.apps.googleusercontent.com', clientSecret: 'secreto-del-cliente-123' });
    const res = await fetch(await startDriveAuthorization(db, { userId }), { redirect: 'manual' });
    const back = new URL(res.headers.get('location')!);
    await completeDriveAuthorization(db, { state: back.searchParams.get('state')!, code: back.searchParams.get('code')! });
  });

  const folder = (which: 'originales' | 'corregidas' | 'trabajo') =>
    withDriveToken(db, async (token, email) => {
      const owner = await photoOwner(db, productId);
      return ensureFolder(db, token, email, photoFolder(owner.account, owner.product, which));
    });
  const namesIn = (folderId: string) => [...google.files.values()].filter((f) => f.parents.includes(folderId) && !f.trashed).map((f) => f.name).sort();

  /** Lo que haría el trabajador: toma el paso, sube cada archivo de una vez y devuelve lo que encontró la app. */
  async function workerUploads(runId: string, editName = 'IMG_1.HEIC') {
    const subidas = await withDriveToken(db, async (token, email) =>
      outputTransfers(db, token, email, { owner: await photoOwner(db, productId), runId, originalName: editName, kinds: ['vista', 'png', 'jpg'] }),
    );
    for (const t of Object.values(subidas)) {
      const r = await fetch(t!.url, { method: t!.metodo, headers: t!.encabezados, body: Buffer.from('pixeles') });
      expect(r.status).toBe(200);
    }
    return withDriveToken(db, (token) => runOutputs(token, runId));
  }

  it('el trabajador sube al Drive sin la llave, y la app encuentra cada archivo de su intento', async () => {
    const edit = await addDriveOriginal(db, { productId, file: { id: 'orig1', name: 'IMG_1.HEIC', size: 10 }, userId });
    const run = await db.photoStepRun.findFirstOrThrow({ where: { editId: edit.id } });
    const found = await workerUploads(run.id);
    expect(Object.keys(found).sort()).toEqual(['jpg', 'png', 'vista']);
    const vista = google.files.get(found.vista!.replace('drive:', ''))!;
    expect(vista.name).toBe(`IMG_1 · vista · ${run.id.slice(-6)}.jpg`);
    expect(vista.parents).toEqual([await folder('trabajo')]);
    // Si el intento se repitió, vale el último y el anterior va a la papelera.
    const again = await workerUploads(run.id);
    expect(again.vista).not.toBe(found.vista);
    expect(google.files.get(found.vista!.replace('drive:', ''))!.trashed).toBe(true);
  });

  it('las finales aprobadas quedan en Corregidas con el nombre del original, y salen si se rehace o se saca la foto', async () => {
    const key = await createWorkerKey(db, userId);
    const workerId = (await verifyWorkerRequest(db, `Bearer ${key}`))!.workerId;
    const edit = await addDriveOriginal(db, { productId, file: { id: 'orig1', name: 'IMG_1.HEIC', size: 10 }, userId });
    const claimed = await claimNext(db, workerId);
    const found = await workerUploads(claimed!.runId);
    await db.photoStepRun.update({ where: { id: claimed!.runId }, data: { status: 'REVIEW', previewUrl: found.vista, pngUrl: found.png, jpgUrl: found.jpg } });
    // Algo copiado a Corregidas desde la Mac no se toca.
    const corrected = await folder('corregidas');
    google.addFile({ name: 'retocada a mano.jpg', mimeType: 'image/jpeg', parents: [corrected] });

    await approveStep(db, { runId: claimed!.runId, userId });
    await syncCorrected(db, productId);
    expect(namesIn(corrected)).toEqual(['IMG_1.jpg', 'IMG_1.png', 'retocada a mano.jpg']);

    await redoStep(db, { runId: claimed!.runId, userId, request: null });
    await syncCorrected(db, productId);
    expect(namesIn(corrected)).toEqual(['retocada a mano.jpg']);
    expect(namesIn(await folder('trabajo'))).toContain('IMG_1.jpg');

    await archivePhoto(db, edit.id);
    await syncCorrected(db, productId);
    expect(namesIn(corrected)).toEqual(['retocada a mano.jpg']);
  });

  it('los originales subidos se anotan solo si están en la carpeta del producto', async () => {
    const originals = await folder('originales');
    const ok = google.addFile({ name: 'IMG_2.jpg', mimeType: 'image/jpeg', parents: [originals], data: Buffer.alloc(100) });
    const elsewhere = google.addFile({ name: 'IMG_3.jpg', mimeType: 'image/jpeg', parents: ['root'], data: Buffer.alloc(100) });
    const r = await addUploadedOriginals(db, { accountId, productId, fileIds: [ok.id, elsewhere.id], userId });
    expect(r).toEqual({ added: 1, problems: ['Una foto no quedó en la carpeta del producto. Probá de nuevo.'] });
    const edit = await db.photoEdit.findFirstOrThrow({ include: { runs: true } });
    expect(edit).toMatchObject({ originalUrl: `drive:${ok.id}`, originalName: 'IMG_2.jpg', originalType: 'image/jpeg', originalSize: 100, createdById: userId });
    expect(edit.runs.map((x) => x.status)).toEqual(['QUEUED']);
  });

  it('las fotos copiadas a Originales desde la Mac entran a la línea, una sola vez', async () => {
    const originals = await folder('originales');
    google.addFile({ name: 'desde la mac.HEIC', mimeType: 'image/heif', parents: [originals], data: Buffer.alloc(50) });
    google.addFile({ name: 'notas.txt', mimeType: 'text/plain', parents: [originals] });
    const first = await syncOriginals(db, { accountId, productId });
    expect(first).toMatchObject({ added: 1, skipped: ['notas.txt: solo fotos JPG, PNG, HEIC o TIFF.'] });
    expect(first.folderUrl).toMatch(/^https:\/\/drive\.google\.com\/drive\/folders\//);
    const edit = await db.photoEdit.findFirstOrThrow();
    expect(edit).toMatchObject({ originalName: 'desde la mac.HEIC', originalType: 'image/heic', createdById: null });
    // Sacada de la lista, no vuelve a entrar.
    await archivePhoto(db, edit.id);
    expect((await syncOriginals(db, { accountId, productId })).added).toBe(0);
    await expect(syncOriginals(db, { accountId: 'otra', productId })).rejects.toThrow('no es de esta cuenta');
  });

  it('lee y manda a la papelera lo que está en el Drive', async () => {
    const f = google.addFile({ name: 'x.jpg', mimeType: 'image/jpeg', parents: ['root'], data: Buffer.from('hola') });
    expect(await (await readStored(db, `drive:${f.id}`))!.text()).toBe('hola');
    await removeStored(db, `drive:${f.id}`);
    expect(f.trashed).toBe(true);
    expect(await readStored(db, 'drive:no-esta')).toBeNull();
  });

  it('los archivos del fabricante se anotan solo si están en su carpeta', async () => {
    const elsewhere = google.addFile({ name: 'catalogo.pdf', mimeType: 'application/pdf', parents: ['root'], data: Buffer.alloc(10) });
    await expect(addUploadedProductFile(db, { productId, fileId: elsewhere.id, userId })).rejects.toThrow('carpeta del producto');
    const fabricante = [...google.files.values()].find((x) => x.name === 'Fabricante')!;
    const ok = google.addFile({ name: 'catalogo.pdf', mimeType: 'application/pdf', parents: [fabricante.id], data: Buffer.alloc(10) });
    expect(await addUploadedProductFile(db, { productId, fileId: ok.id, userId })).toMatchObject({ kind: 'PDF', url: `drive:${ok.id}`, size: 10 });
  });

  it('pasa al Drive lo que quedó en Vercel, sin borrar nada, y después se borra de Vercel', async () => {
    const blob = (name: string, content = 'contenido') => {
      const u = `${vercelBase}/files/viejo/${name}`;
      blobs.set(u, Buffer.from(content));
      return u;
    };
    const edit = await db.photoEdit.create({
      data: { productId, source: 'UPLOAD', originalUrl: blob('original.heic'), originalName: 'IMG_9.HEIC', originalType: 'image/heic', originalSize: 9, previewUrl: blob('antes.jpg') },
    });
    const run = await db.photoStepRun.create({
      data: { editId: edit.id, step: 0, status: 'APPROVED', settings: {}, previewUrl: blob('vista.jpg'), jpgUrl: blob('final.jpg', 'final'), pngUrl: blob('final.png') },
    });
    await db.productFile.create({ data: { productId, kind: 'PDF', name: 'catalogo.pdf', contentType: 'application/pdf', size: 3, url: blob('catalogo.pdf') } });
    blob('huerfano.jpg');
    expect(await vercelLeft(db)).toBe(6);
    await expect(deleteVercelBatch(db, { budgetMs: 10_000 })).rejects.toThrow('primero pasalos');

    // Una tanda que se queda sin tiempo después del primero.
    let t = 0;
    const r1 = await moveBatch(db, { budgetMs: 5, now: () => (t += 4) });
    expect(r1).toMatchObject({ moved: 1, left: 5, problems: [] });
    const r2 = await moveBatch(db, { budgetMs: 60_000 });
    expect(r2).toMatchObject({ moved: 5, left: 0, problems: [] });
    expect(blobs.size).toBe(7);

    const e = await db.photoEdit.findUniqueOrThrow({ where: { id: edit.id } });
    const r = await db.photoStepRun.findUniqueOrThrow({ where: { id: run.id } });
    const file = (ref: string | null) => google.files.get(ref!.replace('drive:', ''))!;
    expect(file(e.originalUrl)).toMatchObject({ name: 'IMG_9.HEIC', parents: [await folder('originales')] });
    expect(file(e.previewUrl).parents).toEqual([await folder('trabajo')]);
    expect(file(r.jpgUrl).data.toString()).toBe('final');
    // La final aprobada quedó en Corregidas.
    expect(namesIn(await folder('corregidas'))).toEqual(['IMG_9.jpg', 'IMG_9.png']);
    expect(file((await db.productFile.findFirstOrThrow()).url).parents[0]).toBe([...google.files.values()].find((x) => x.name === 'Fabricante')!.id);

    // Con todo en el Drive, se borra de Vercel, también lo que no estaba anotado.
    expect(await deleteVercelBatch(db, { budgetMs: 10_000 })).toEqual({ deleted: 7, more: false });
    expect(blobs.size).toBe(0);
  });

  it('lo que ya no estaba en Vercel queda anotado y no corta la tanda', async () => {
    await db.productFile.create({ data: { productId, kind: 'PDF', name: 'perdido.pdf', contentType: 'application/pdf', size: 3, url: `${vercelBase}/files/no-esta.pdf` } });
    const u = `${vercelBase}/files/ok.pdf`;
    blobs.set(u, Buffer.from('ok'));
    await db.productFile.create({ data: { productId, kind: 'PDF', name: 'ok.pdf', contentType: 'application/pdf', size: 2, url: u } });
    const r = await moveBatch(db, { budgetMs: 60_000 });
    expect(r).toEqual({ moved: 1, left: 1, problems: ['perdido.pdf: ya no estaba en Vercel.'] });
  });
});
