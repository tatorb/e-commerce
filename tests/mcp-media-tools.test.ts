import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { McpContext } from '@/lib/mcp/tool';

// Las fotos y los videos desde Claude. Datos inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

const { handleRpc, toolList } = await import('@/lib/mcp/server');

describe('herramientas de fotos y videos en la lista', () => {
  it('ver solo lee; elegir pisa lo elegido', () => {
    const tools = new Map(toolList().map((t) => [t.name, t.annotations]));
    expect(tools.get('get_publication_media')).toMatchObject({ readOnlyHint: true });
    expect(tools.get('set_publication_media')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(tools.get('add_channel_photos')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(tools.get('set_photo_as_is')).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });
});

describe.skipIf(!url)('fotos y videos desde Claude', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const ctx: McpContext = { db, userId: 'u1', access: { isAdmin: true, permissions: {}, accountIds: [] }, baseUrl: 'https://app.ejemplo.com' };
  let kitId = '';
  let otherId = '';
  let videoId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE publication_clips, product_videos, channel_copies, assets, photo_edits, competitor_listings, pipeline_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    const store = await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } });
    const product = await db.product.create({
      data: {
        accountId,
        name: 'Aros de prueba',
        variants: { create: [{ sku: 'AR-1-00', measure: 'STD', position: 0 }, { sku: 'AR-1-50', measure: '0.50', position: 1 }] },
        assets: { create: [{ kind: 'PHOTO', url: 'https://fotos.ejemplo.com/aro.jpg', position: 0 }] },
      },
    });
    const pub = (externalId: string, photoIds: string[]) =>
      db.publication.create({
        data: {
          productId: product.id,
          storeId: store.id,
          externalId,
          title: `Aros ${externalId}`,
          channelCopy: {
            create: {
              readAt: new Date(),
              status: 'ACTIVE',
              photos: photoIds.map((p) => `https://ml.ejemplo.com/${p}.jpg`),
              photoIds,
              variations: [
                { sku: 'AR-1-00', measure: 'STD', photoIds },
                { sku: 'AR-1-50', measure: '0.50', photoIds },
              ],
            },
          },
        },
      });
    kitId = (await pub('MLA1110001', ['F1', 'F2'])).id;
    otherId = (await pub('MLA1110002', ['G1'])).id;
    videoId = (await db.productVideo.create({ data: { productId: product.id, driveFileId: 'drive-1', name: 'clip.mp4', mimeType: 'video/mp4', origin: 'APP', durationMs: 30_000 } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const r = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx)) as {
      result: { content: { text: string }[]; isError?: boolean };
    };
    const text = r.result.content[0].text;
    return { text, isError: r.result.isError === true, data: r.result.isError ? null : JSON.parse(text) };
  }

  it('muestra lo que hay para elegir, con claves que sirven para elegir', async () => {
    const r = await call('get_publication_media', { publicacion: 'MLA1110001' });
    expect(r.data.sigue_a_las_del_canal).toBe(true);
    expect(r.data.medidas.map((m: { nombre: string }) => m.nombre)).toEqual(['STD', '0.50']);
    expect(r.data.elegidas.map((f: { foto: string }) => f.foto)).toEqual(['canal:F1', 'canal:F2']);
    expect(r.data.para_elegir.del_producto).toEqual([expect.objectContaining({ foto: 'link:https://fotos.ejemplo.com/aro.jpg', elegida: false })]);
    expect(r.data.videos).toEqual([expect.objectContaining({ video: videoId, nombre: 'clip.mp4', duracion_seg: 30, es_clip: false })]);
  });

  it('elige, ordena y marca medidas; los clips y las medidas de los videos; y vuelve a las del canal', async () => {
    const r = await call('set_publication_media', {
      publicacion: 'MLA1110001',
      fotos: [{ foto: 'link:https://fotos.ejemplo.com/aro.jpg' }, { foto: 'canal:F2', medidas: ['0.50'] }],
      clips: [videoId],
      medidas_de_los_videos: [{ video: videoId, medidas: ['STD'] }],
    });
    expect(r.data.listo).toBe(true);
    expect(r.data.elegidas).toEqual([
      expect.objectContaining({ orden: 1, foto: 'link:https://fotos.ejemplo.com/aro.jpg', medidas: 'todas' }),
      expect.objectContaining({ orden: 2, foto: 'canal:F2', medidas: ['0.50'] }),
    ]);
    expect(r.data.clips).toEqual(['clip.mp4']);
    const after = await call('get_publication_media', { publicacion: 'MLA1110001' });
    expect(after.data.videos[0]).toMatchObject({ es_clip: true, orden_como_clip: 1, medidas: ['STD'] });

    // Lo que no se puede: una foto que no es de esta publicación, una medida que no existe, un video ajeno.
    expect((await call('set_publication_media', { publicacion: 'MLA1110001', fotos: [{ foto: 'canal:G1' }] })).text).toContain('No hay una foto');
    expect((await call('set_publication_media', { publicacion: 'MLA1110001', fotos: [{ foto: 'canal:F1', medidas: ['1.00'] }] })).text).toContain('STD, 0.50');
    expect((await call('set_publication_media', { publicacion: 'MLA1110001', clips: ['otro'] })).text).toContain('No hay un video');
    expect((await call('set_publication_media', { publicacion: 'MLA1110001' })).text).toContain('No mandaste nada');

    await call('set_publication_media', { publicacion: 'MLA1110001', usar_las_del_canal: true });
    expect((await db.publication.findUniqueOrThrow({ where: { id: kitId } })).media).toBeNull();
  });

  it('copia las fotos y los clips de otra publicación del mismo producto, salvo las del canal que esta no tiene', async () => {
    await call('set_publication_media', {
      publicacion: 'MLA1110001',
      fotos: [{ foto: 'canal:F1', medidas: ['STD'] }, { foto: 'link:https://fotos.ejemplo.com/aro.jpg' }],
      clips: [videoId],
    });
    const r = await call('copy_publication_data', { publicacion: 'MLA1110002', desde: 'MLA1110001', copiar: ['fotos', 'clips'] });
    expect(r.data.copiado).toEqual({ fotos: 1, fotos_del_canal_de_la_otra_que_esta_no_tiene: 1, clips: 1 });
    const copied = await call('get_publication_media', { publicacion: 'MLA1110002' });
    expect(copied.data.elegidas.map((f: { foto: string }) => f.foto)).toEqual(['link:https://fotos.ejemplo.com/aro.jpg']);
    expect(await db.publicationClip.count({ where: { publicationId: otherId } })).toBe(1);
  });

  it('usar tal cual: solo fotos de la línea del producto', async () => {
    expect((await call('set_photo_as_is', { publicacion: 'MLA1110001', foto: 'no-existe', tal_cual: true })).text).toContain('No hay una foto');
  });
});
