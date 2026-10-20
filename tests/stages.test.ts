import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { createPublication } from '@/domain/publications';
import { moveToStage } from '@/domain/stages';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('etapas de una publicación', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = '';
  let productId = '';

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE stage_movements, publications, products, stores, channels, accounts, users CASCADE',
    );
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const store = await db.store.create({
      data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' },
    });
    const product = await db.product.create({ data: { accountId: account.id, name: 'Producto de prueba' } });
    storeId = store.id;
    productId = product.id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  const emptyData = {
    externalId: null,
    url: null,
    title: null,
    description: null,
    attributes: [],
    price: null,
    channelStatus: 'ACTIVE' as const,
  };

  async function openMovements(publicationId: string) {
    return db.stageMovement.findMany({ where: { publicationId, exitedAt: null } });
  }

  it('una publicación nueva entra en Importado con su registro abierto', async () => {
    const { id } = await createPublication(db, { productId, storeId, data: emptyData, userId: null });
    const pub = await db.publication.findUniqueOrThrow({ where: { id } });
    const open = await openMovements(id);
    expect(pub.stage).toBe('IMPORTED');
    expect(open).toHaveLength(1);
    expect(open[0].stage).toBe('IMPORTED');
  });

  it('mover de etapa cierra la anterior y abre la nueva', async () => {
    const { id } = await createPublication(db, { productId, storeId, data: emptyData, userId: null });
    // Un minuto después de crearla: con una fecha fija, la prueba falla cuando esa fecha queda en el pasado.
    const at = new Date(Date.now() + 60_000);
    await db.$transaction((tx) => moveToStage(tx, { publicationId: id, stage: 'IN_REVIEW', userId: null, at }));

    const all = await db.stageMovement.findMany({ where: { publicationId: id }, orderBy: { enteredAt: 'asc' } });
    expect(all.map((m) => m.stage)).toEqual(['IMPORTED', 'IN_REVIEW']);
    expect(all[0].exitedAt?.toISOString()).toBe(at.toISOString());
    expect(all[1].enteredAt.toISOString()).toBe(at.toISOString());
    expect(all[1].exitedAt).toBeNull();
    const pub = await db.publication.findUniqueOrThrow({ where: { id } });
    expect(pub.stage).toBe('IN_REVIEW');
  });

  it('mover a la misma etapa no hace nada', async () => {
    const { id } = await createPublication(db, { productId, storeId, data: emptyData, userId: null });
    const result = await db.$transaction((tx) =>
      moveToStage(tx, { publicationId: id, stage: 'IMPORTED', userId: null }),
    );
    expect(result.changed).toBe(false);
    expect(await db.stageMovement.count({ where: { publicationId: id } })).toBe(1);
  });

  it('dos movimientos al mismo tiempo nunca dejan dos etapas abiertas', async () => {
    const { id } = await createPublication(db, { productId, storeId, data: emptyData, userId: null });
    await Promise.all(
      (['PROPOSAL_GENERATED', 'IN_REVIEW', 'APPROVED', 'APPLIED'] as const).map((stage) =>
        db.$transaction((tx) => moveToStage(tx, { publicationId: id, stage, userId: null })),
      ),
    );
    const open = await openMovements(id);
    const pub = await db.publication.findUniqueOrThrow({ where: { id } });
    expect(open).toHaveLength(1);
    expect(open[0].stage).toBe(pub.stage);
    expect(await db.stageMovement.count({ where: { publicationId: id } })).toBe(5);
  });

  it('no permite dos publicaciones con el mismo ID en la misma tienda', async () => {
    const data = { ...emptyData, externalId: 'MLA1' };
    await createPublication(db, { productId, storeId, data, userId: null });
    await expect(createPublication(db, { productId, storeId, data, userId: null })).rejects.toThrow(
      'Ya hay una publicación con ese ID en esta tienda.',
    );
  });
});
