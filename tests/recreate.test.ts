import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';

// Recrear un producto en otra categoría: el canal está simulado. Datos inventados.

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sin-base@localhost/sin-base';
});

// Lo que pasa, en orden: crear la principal, crear cada opción, leer, finalizar.
const steps: string[] = [];
let failPlan: number | null = null;
let nextCode = 500;

vi.mock('@/lib/channel-create', async (orig) => {
  const real = await orig<typeof import('@/lib/channel-create')>();
  return {
    ...real,
    createChecks: async (_db: unknown, args: { recreate?: boolean }) => ({
      channelName: 'Mercado Libre',
      blocked: null,
      checks: [{ label: 'Categoría en Mercado Libre', ok: false, detail: 'Las otras están en otra categoría.', blocking: !args.recreate }],
      ready: true,
      listingTypes: [{ value: 'clasica', label: 'Clásica' }],
      categoryId: null,
      price: 72631,
      measures: [],
      published: [],
      stock: { quantity: 2, quantities: {} },
    }),
    createInChannel: async (db: PrismaClient, args: { publicationId: string; price: number; recreate?: boolean }) => {
      const code = `MLA${nextCode++}`;
      steps.push(`crear principal ${code} a ${args.price}${args.recreate ? ' recreando' : ''}`);
      await db.publication.update({ where: { id: args.publicationId }, data: { externalId: code, channelStatus: 'ACTIVE' } });
      await db.channelCopy.create({ data: { publicationId: args.publicationId, readAt: new Date(), status: 'ACTIVE', channelProductId: 'UP-NUEVO', categoryId: 'MLA458878' } });
      return { externalId: code, url: null, warnings: [], confirmed: true, created: [] };
    },
  };
});
vi.mock('@/lib/sale-option-copy', async (orig) => {
  const real = await orig<typeof import('@/lib/sale-option-copy')>();
  return {
    ...real,
    createSaleOption: async (db: PrismaClient, args: { publicationId: string; plan: number; price?: number; recreate?: boolean }) => {
      if (args.plan === failPlan) throw new real.SaleOptionCopyError('Mercado Libre no la creó: inventado.');
      const main = await db.publication.findUniqueOrThrow({ where: { id: args.publicationId } });
      const code = `MLA${nextCode++}`;
      steps.push(`crear opción ${args.plan} a ${args.price}${args.recreate ? ' recreando' : ''}`);
      const p = await db.publication.create({ data: { productId: main.productId, storeId: main.storeId, externalId: code, mainOptionId: main.id, installments: args.plan, channelStatus: 'ACTIVE' } });
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'ACTIVE', installments: args.plan } });
      return { id: p.id, externalId: code, url: null, plan: String(args.plan), price: args.price ?? 0, joined: true, warnings: [] };
    },
  };
});
vi.mock('@/lib/channel-sync', () => ({
  readOne: async (_db: unknown, args: { publicationId: string }) => {
    steps.push(`leer ${args.publicationId}`);
    return [];
  },
}));
// Mercado Libre no deja finalizar una en revisión, hasta que sale de revisión.
const stillUnderReview = new Set<string>();
// Una falla de red al finalizar esa: corta la vuelta a mitad, una sola vez.
let gatewayAt: string | null = null;
vi.mock('@/lib/channel-status', () => ({
  changeStatus: async (db: PrismaClient, args: { publicationIds: string[] }) => {
    const done: { id: string; title: null }[] = [];
    const failed: { id: string; title: null; message: string }[] = [];
    for (const id of args.publicationIds) {
      const p = await db.publication.findUniqueOrThrow({ where: { id } });
      if (p.externalId === gatewayAt) {
        gatewayAt = null;
        throw new Error('Bad Gateway');
      }
      steps.push(`finalizar ${p.externalId}`);
      if (stillUnderReview.has(id)) failed.push({ id, title: null, message: 'Está en revisión.' });
      else {
        await db.publication.update({ where: { id }, data: { channelStatus: 'CLOSED' } });
        await db.channelCopy.updateMany({ where: { publicationId: id }, data: { status: 'CLOSED' } });
        done.push({ id, title: null });
      }
    }
    return { done, failed };
  },
}));

const { planRecreate, applyRecreate, closePendingPass, listPendingClose, RecreateError, attributesForCategory } = await import('@/lib/recreate');
const { categoryAlerts } = await import('@/lib/channel-category');

describe.skipIf(!url)('recrear un producto en otra categoría', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  let productId = '';
  let oldMain = '';
  let three = '';
  let nine = '';
  let fresh = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    steps.length = 0;
    failPlan = null;
    stillUnderReview.clear();
    gatewayAt = null;
    await db.$executeRawUnsafe('TRUNCATE text_images, tasks, channel_copies, channel_sync_changes, publication_notes, pipeline_movements, publications, products, stores, channels, accounts, users CASCADE');
    await db.user.create({ data: { id: 'u1', name: 'Persona', email: 'persona@example.com' } });
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    storeId = (await db.store.create({ data: { accountId, channelId: channel.id, name: 'TIENDA' } })).id;
    productId = (await db.product.create({ data: { accountId, name: 'Combo juntas y bulones', productType: 'Otros' } })).id;
    const old = async (code: string, plan: number, price: number, status: 'ACTIVE' | 'UNDER_REVIEW', extra: Record<string, unknown> = {}) => {
      const p = await db.publication.create({ data: { productId, storeId, externalId: code, title: 'Combo viejo', installments: plan, price, channelStatus: status, ...extra } });
      await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status, installments: plan, price, categoryId: 'MLA458790' } });
      return p.id;
    };
    oldMain = await old('MLA100', 0, 72631, 'ACTIVE', { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE' });
    three = await old('MLA103', 3, 83868, 'ACTIVE', { mainOptionId: oldMain });
    nine = await old('MLA109', 9, 99861, 'UNDER_REVIEW', { mainOptionId: oldMain });
    // Una finalizada no cuenta.
    await old('MLA112', 12, 108057, 'ACTIVE', { mainOptionId: oldMain, channelStatus: 'CLOSED' }).then((id) => db.channelCopy.update({ where: { publicationId: id }, data: { status: 'CLOSED' } }));
    fresh = (await db.publication.create({ data: { productId, storeId, title: 'Combo nuevo', channelStatus: 'UNPUBLISHED', channelCategory: 'MLA458878', pipelineStatus: 'UNTOUCHED' } })).id;
    await db.publicationNote.create({ data: { accountId, publicationId: oldMain, text: 'Falta confirmar stock.', authorId: 'u1' } });
  });

  it('el plan muestra las vivas con su forma de cobro, precio y estado, y qué se crea, sin cambiar nada', async () => {
    const plan = await planRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true });
    expect(plan.category).toMatchObject({ id: 'MLA458878', name: 'Kits de Juntas' });
    expect(plan.newMain).toMatchObject({ id: fresh, created: false });
    expect(plan.old.map((o) => [o.externalId, o.planLabel, o.price, o.statusLabel, o.main, Boolean(o.closeBlocked)])).toEqual([
      ['MLA100', 'Sin cuotas', 72631, 'Activa', true, false],
      ['MLA103', '3 cuotas', 83868, 'Activa', false, false],
      ['MLA109', '9 cuotas', 99861, 'En revisión', false, true],
    ]);
    expect(plan.toCreate).toEqual([
      { plan: 0, label: 'Sin cuotas', price: 72631, main: true },
      { plan: 3, label: '3 cuotas', price: 83868, main: false },
      { plan: 9, label: '9 cuotas', price: 99861, main: false },
    ]);
    expect(plan.missing).toEqual([]);
    expect(steps).toEqual([]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: fresh } })).externalId).toBeNull();
    // Sin las formas de cobro, solo la principal.
    expect((await planRecreate(db, { accountId, publicationId: oldMain, categoryId: 'MLA458878', allPlans: false })).toCreate).toHaveLength(1);
  });

  it('crea la nueva y sus opciones, pasa el trabajo, y recién al final finaliza las viejas; la que está en revisión queda pendiente', async () => {
    stillUnderReview.add(nine);
    const r = await applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' });
    const order = steps.filter((s) => !s.startsWith('leer'));
    expect(order).toEqual(['crear principal MLA500 a 72631 recreando', 'crear opción 3 a 83868 recreando', 'crear opción 9 a 99861 recreando', 'finalizar MLA100', 'finalizar MLA103']);
    expect(steps.filter((s) => s.startsWith('leer'))).toHaveLength(3);
    expect(r.closed).toEqual(['MLA100', 'MLA103']);
    expect(r.pending).toEqual([{ externalId: 'MLA109', why: expect.stringContaining('en revisión') }]);
    // El trabajo del pipeline está en la nueva, con las notas.
    expect(await db.publication.findUniqueOrThrow({ where: { id: fresh } })).toMatchObject({ pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE', externalId: 'MLA500' });
    expect(await db.publicationNote.count({ where: { publicationId: fresh } })).toBe(1);
    // La pendiente, con su tarea y en Por finalizar.
    const pending = await listPendingClose(db, accountId);
    expect(pending.map((p) => p.externalId)).toEqual(['MLA109']);
    const task = await db.task.findFirstOrThrow({ include: { publications: true } });
    expect(task.title).toBe('Finalizar MLA109 en el canal');
    expect(task.publications.map((t) => t.publicationId)).toEqual([nine]);

    // Cada hora se reintenta: mientras siga en revisión, queda; cuando se puede, se finaliza y la tarea se cierra.
    expect(await closePendingPass(db)).toEqual({ closed: 0, still: 1 });
    stillUnderReview.clear();
    expect(await closePendingPass(db)).toEqual({ closed: 1, still: 0 });
    expect(await listPendingClose(db, accountId)).toEqual([]);
    expect((await db.task.findFirstOrThrow()).status).toBe('DONE');
  });

  it('la nueva sin fotos toma las de la vieja en el mismo orden: 3 del canal tal cual y 3 imágenes con texto', async () => {
    // En el canal: 3 fotos reales y 3 imágenes con texto, alternadas. Dos son de la app, una del Drive.
    await db.channelCopy.update({
      where: { publicationId: oldMain },
      data: { photos: ['https://ml/F1.jpg', 'https://ml/T1.jpg', 'https://ml/F2.jpg', 'https://ml/T2.jpg', 'https://ml/F3.jpg', 'https://ml/T3.jpg'], photoIds: ['F1', 'T1', 'F2', 'T2', 'F3', 'T3'] },
    });
    const piece = (slot: number, extra: Record<string, unknown> = {}) =>
      db.textImage.create({ data: { accountId, content: { titulo: `Imagen ${slot}` }, slot, mediaPlace: slot + 1, pngRef: `drive:png-${slot}`, pngAt: new Date('2026-11-19'), ...extra } });
    const t1 = await piece(1);
    const t2 = await piece(2);
    const drive = await piece(9, { fromDrive: true, fileName: 'medidas.png', fileType: 'image/png', mediaPlace: null });
    for (const [t, photo] of [[t1, 'T1'], [t2, 'T2'], [drive, 'T3']] as const) {
      await db.publicationTextImage.create({ data: { publicationId: oldMain, textImageId: t.id, channelPhotoId: photo } });
    }

    const plan = await planRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true });
    expect(plan.notes.some((n) => n.includes('se le copian las de MLA100'))).toBe(true);
    await applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' });

    const media = (await db.publication.findUniqueOrThrow({ where: { id: fresh } })).media as { kind: string; id: string }[];
    expect(media.map((m) => m.kind)).toEqual(['channel', 'text', 'channel', 'text', 'channel', 'text']);
    expect(media.filter((m) => m.kind === 'channel').map((m) => m.id)).toEqual(['F1', 'F2', 'F3']);
    // Las de la app se copian a la nueva, con su contenido, su lugar fijo y su PNG; la del Drive es la misma.
    const [c1, c2, c3] = media.filter((m) => m.kind === 'text').map((m) => m.id);
    expect([c1, c2]).not.toContain(t1.id);
    expect(c3).toBe(drive.id);
    expect(await db.textImage.findUniqueOrThrow({ where: { id: c1 } })).toMatchObject({ slot: 1, mediaPlace: 2, pngRef: 'drive:png-1', content: { titulo: 'Imagen 1' } });
    expect((await db.publicationTextImage.findMany({ where: { publicationId: fresh } })).map((l) => l.textImageId).sort()).toEqual([c1, c2, c3].sort());
    // La vieja sigue con las suyas.
    expect((await db.publicationTextImage.findMany({ where: { publicationId: oldMain } })).map((l) => l.textImageId).sort()).toEqual([t1.id, t2.id, drive.id].sort());
  });

  it('no hereda el Tipo de vehículo ni lo que no es del formulario de la categoría destino', () => {
    expect(
      attributesForCategory(
        [
          { name: 'Tipo de vehículo', value: 'Línea Pesada' },
          { name: 'Tornillos de tapa incluidos', value: 'Sí' },
          { name: 'Título de catálogo', value: 'Combo viejo' },
        ],
        ['Tornillos de tapa incluidos', 'Tipo de vehículo', 'IVA'],
      ),
    ).toEqual([{ name: 'Tornillos de tapa incluidos', value: 'Sí' }]);
  });

  it('si se corta a mitad de finalizar, al volver a llamarla retoma: no crea la nueva de nuevo y finaliza las que quedan', async () => {
    await db.publication.update({ where: { id: nine }, data: { channelStatus: 'ACTIVE' } });
    await db.channelCopy.update({ where: { publicationId: nine }, data: { status: 'ACTIVE' } });
    gatewayAt = 'MLA103';
    await expect(applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' })).rejects.toThrow('Bad Gateway');
    expect(steps.filter((x) => x.startsWith('crear'))).toHaveLength(3);
    expect(steps).toContain('finalizar MLA100');

    steps.length = 0;
    const plan = await planRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true });
    expect(plan.resume?.newMainId).toBe(fresh);
    expect(plan.resume?.existing.map((e) => e.plan).sort()).toEqual([0, 3, 9]);
    expect(plan.old.map((o) => o.externalId)).toEqual(['MLA103', 'MLA109']);
    expect(plan.toCreate).toEqual([]);
    const r = await applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' });
    expect(steps.filter((x) => x.startsWith('crear'))).toEqual([]);
    expect(r.closed.sort()).toEqual(['MLA103', 'MLA109']);
    // El trabajo del pipeline pasó una sola vez: la nueva sigue en Precio.
    expect((await db.publication.findUniqueOrThrow({ where: { id: fresh } })).pipelineStep).toBe('PRICE');
    expect(await db.publication.count({ where: { productId, externalId: { not: null }, channelStatus: 'ACTIVE' } })).toBe(3);
  });

  it('si se corta al crear una opción, al volver a llamarla crea solo la que falta', async () => {
    failPlan = 9;
    await expect(applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' })).rejects.toThrow('retoma');
    failPlan = null;
    steps.length = 0;
    await applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' });
    expect(steps.filter((x) => x.startsWith('crear'))).toEqual(['crear opción 9 a 99861 recreando']);
  });

  it('si una opción nueva no se crea, no finaliza ninguna vieja', async () => {
    failPlan = 3;
    await expect(applyRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true, userId: 'u1' })).rejects.toThrow('no se finalizaron');
    expect(steps.some((s) => s.startsWith('finalizar'))).toBe(false);
    expect((await db.publication.findUniqueOrThrow({ where: { id: oldMain } })).channelStatus).toBe('ACTIVE');
  });

  it('no recrea sin publicaciones vivas, ni en una categoría que no existe', async () => {
    await expect(planRecreate(db, { accountId, publicationId: fresh, categoryId: 'Cualquiera', allPlans: true })).rejects.toThrow(RecreateError);
    await db.publication.updateMany({ where: { externalId: { not: null } }, data: { channelStatus: 'CLOSED' } });
    await db.channelCopy.updateMany({ data: { status: 'CLOSED' } });
    await expect(planRecreate(db, { accountId, publicationId: fresh, categoryId: 'MLA458878', allPlans: true })).rejects.toThrow('no tiene publicaciones vivas');
  });

  it('avisa cuando el canal cambió la categoría por su cuenta y cuando el producto quedó en dos categorías', async () => {
    expect((await categoryAlerts(db, [oldMain])).size).toBe(0);
    await db.channelCopy.update({ where: { publicationId: oldMain }, data: { categoryId: 'MLA9999' } });
    await db.channelSyncChange.create({ data: { publicationId: oldMain, field: 'category', kind: 'TAKEN', before: 'Kits de Reconstrucción', after: 'Bulones', message: 'Mercado Libre cambió la categoría a Bulones (MLA9999).' } });
    const alert = (await categoryAlerts(db, [three])).get(three)!;
    expect(alert.split).toBe(true);
    expect(alert.text).toContain('cambió por su cuenta la categoría de MLA100');
    expect(alert.text).toContain('2 categorías');
  });
});
