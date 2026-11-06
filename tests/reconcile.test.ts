import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import type { ChannelListing } from '@/channels/listings';
import { reconcileMeasure, type ReconcileOption } from '@/domain/reconcile';

// La reconciliación de las opciones de venta con el canal, con Mercado Libre
// simulado. Datos inventados.

const opt = (externalId: string, extra: Partial<ReconcileOption> = {}): ReconcileOption => ({
  id: `id-${externalId}`,
  externalId,
  status: 'ACTIVE',
  statusReason: null,
  plan: 3,
  price: 1000,
  main: false,
  ...extra,
});

describe('qué encuentra en una medida', () => {
  it('todo bien: nada', () => {
    expect(reconcileMeasure([opt('A', { main: true }), opt('B', { plan: 1 })])).toEqual([]);
  });

  it('la principal finalizada con otra viva: pasa a la viva, primero la de la misma forma de cobro', () => {
    const f = reconcileMeasure([opt('A', { main: true, status: 'CLOSED', statusReason: 'Categoría incorrecta.' }), opt('B', { plan: 1 }), opt('C', { status: 'PAUSED' })]);
    expect(f).toEqual([expect.objectContaining({ kind: 'switch_main', codes: ['A'], to: 'C' })]);
    expect(f[0].text).toContain('Motivo del canal: Categoría incorrecta.');
  });

  it('la principal en revisión con otra viva también pasa; sin otra, se espera', () => {
    expect(reconcileMeasure([opt('A', { main: true, status: 'UNDER_REVIEW' }), opt('B', { plan: 0 })])[0]).toMatchObject({ kind: 'switch_main', to: 'B' });
    expect(reconcileMeasure([opt('A', { main: true, status: 'UNDER_REVIEW' })])).toEqual([expect.objectContaining({ kind: 'under_review' })]);
  });

  it('la principal finalizada sin otra viva: tarea para volver a publicar', () => {
    expect(reconcileMeasure([opt('A', { main: true, status: 'CLOSED' }), opt('B', { status: 'CLOSED', plan: 1 })])).toEqual([expect.objectContaining({ kind: 'no_replacement', codes: ['A'] })]);
  });

  it('la principal apagada por repetida: pasa a la gemela y se propone finalizarla', () => {
    const f = reconcileMeasure([opt('A', { main: true, status: 'INACTIVE' }), opt('B'), opt('C', { plan: 0 })]);
    expect(f.map((x) => [x.kind, x.codes, x.to])).toEqual([
      ['switch_main', ['A'], 'B'],
      ['duplicate_off', ['A'], undefined],
    ]);
  });

  it('la principal inactiva sin gemela: se corrige, tarea y vuelve a Información', () => {
    expect(reconcileMeasure([opt('A', { main: true, status: 'INACTIVE' }), opt('B', { plan: 0 })])).toEqual([expect.objectContaining({ kind: 'needs_fix', codes: ['A'] })]);
  });

  it('otra opción apagada por repetida, dos vivas iguales y una que faltaba en la app', () => {
    const f = reconcileMeasure([opt('A', { main: true }), opt('B', { status: 'INACTIVE' }), opt('C', { plan: 1 }), opt('D', { plan: 1, status: 'PAUSED', id: null })]);
    expect(f.map((x) => [x.kind, x.codes])).toEqual([
      ['new_option', ['D']],
      ['duplicate_off', ['B']],
      ['same_plan_live', ['C', 'D']],
    ]);
  });
});

// Mercado Libre simulado: las opciones de cada medida y lo que se lee de cada publicación.
const channel = { options: new Map<string, string[]>(), items: new Map<string, ChannelListing>() };
const listing = (externalId: string, extra: Partial<ChannelListing> = {}): ChannelListing =>
  ({ externalId, url: `https://ml/${externalId}`, title: 'Subconjunto', description: null, price: 2000, installments: 1, discount: 0, status: 'ACTIVE', statusReason: null, ...extra }) as ChannelListing;

vi.mock('@/lib/connections', () => ({ withAccessToken: async (_db: unknown, _store: string, run: (t: string, u: string) => unknown) => run('llave', '7') }));
vi.mock('@/channels/listings', async (orig) => {
  const real = await orig<typeof import('@/channels/listings')>();
  return {
    ...real,
    getChannelListings: () => ({
      listOptions: async (_t: string, _u: string, ids: string[]) => new Map(ids.flatMap((id) => (channel.options.has(id) ? [[id, channel.options.get(id)!]] : []))),
      readListings: async (_t: string, _u: string, ids: string[]) => ({ listings: ids.flatMap((id) => channel.items.get(id) ?? []), missing: [] }),
    }),
  };
});
// Leer una publicación nueva del canal: deja su copia como la leería la sincronización.
vi.mock('@/lib/channel-sync', () => ({
  readOne: async (db: PrismaClient, args: { publicationId: string }) => {
    const p = await db.publication.findUniqueOrThrow({ where: { id: args.publicationId } });
    const l = channel.items.get(p.externalId!)!;
    await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: l.status, installments: l.installments, price: l.price, channelProductId: 'UP-050' } });
    return [];
  },
}));

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('reconciliar contra la base', async () => {
  const { reconcile } = await import('@/lib/reconcile');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';
  let storeId = '';
  let productId = '';
  const userId = 'u-juani';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE tasks, listing_families, channel_copies, channel_sync_changes, pipeline_movements, publications, products, channel_connections, stores, channels, accounts, users CASCADE',
    );
    channel.options.clear();
    channel.items.clear();
    const ch = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    await db.user.create({ data: { id: userId, name: 'Juani', email: 'juani@prueba.com' } });
    storeId = (await db.store.create({ data: { accountId, channelId: ch.id, name: 'TIENDA' } })).id;
    await db.channelConnection.create({ data: { storeId, appId: '1', appSecret: 'x', appSecretHint: 'x', status: 'ACTIVE', externalUserId: '7' } });
    productId = (await db.product.create({ data: { accountId, name: 'Subconjunto SP-1' } })).id;
  });

  const app = async (externalId: string, status: 'ACTIVE' | 'CLOSED' | 'INACTIVE', extra: { inPipeline?: boolean; plan?: number } = {}) => {
    const p = await db.publication.create({
      data: { productId, storeId, externalId, title: 'Subconjunto', ...(extra.inPipeline ? { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE' } : {}) },
    });
    await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status, installments: extra.plan ?? 3, price: 1000, channelProductId: 'UP-050' } });
    return p;
  };

  it('solo mostrar: dice qué encontró y no cambia nada', async () => {
    const old = await app('MLA1', 'CLOSED', { inPipeline: true });
    channel.options.set('UP-050', ['MLA2']);
    channel.items.set('MLA2', listing('MLA2', { installments: 3 }));
    const r = await reconcile(db, { accountId, apply: false, userId });
    expect(r.checked).toBe(1);
    expect(r.measures[0].findings.map((f) => [f.kind, f.codes, f.to])).toEqual([
      ['new_option', ['MLA2'], undefined],
      ['switch_main', ['MLA1'], 'MLA2'],
    ]);
    expect(r.measures[0].options.map((o) => [o.externalId, o.inApp, o.main])).toEqual([
      ['MLA1', true, true],
      ['MLA2', false, false],
    ]);
    expect(await db.publication.count()).toBe(1);
    expect((await db.publication.findUniqueOrThrow({ where: { id: old.id } })).pipelineStep).toBe('PRICE');
  });

  it('aplicar: suma la opción que faltaba, le pasa la principal con su trabajo y queda en el registro', async () => {
    const old = await app('MLA1', 'CLOSED', { inPipeline: true });
    channel.options.set('UP-050', ['MLA2']);
    channel.items.set('MLA2', listing('MLA2', { installments: 3 }));
    const r = await reconcile(db, { accountId, apply: true, userId });
    expect(r.measures[0].findings.map((f) => f.done ?? f.failed)).toEqual([
      'Se sumó MLA2 a la app como opción de venta.',
      'La principal pasó de MLA1 a MLA2. Lo que tenía la app queda en Por subir para MLA2.',
    ]);
    const fresh = await db.publication.findFirstOrThrow({ where: { externalId: 'MLA2' } });
    expect(fresh).toMatchObject({ mainOptionId: null, pipelineStatus: 'IN_PIPELINE', pipelineStep: 'PRICE', productId });
    expect((await db.publication.findUniqueOrThrow({ where: { id: old.id } })).mainOptionId).toBe(fresh.id);
    expect(await db.channelSyncChange.count({ where: { kind: 'MAIN_OPTION_CHANGED' } })).toBe(2);
    // La segunda vez ya no encuentra nada.
    expect((await reconcile(db, { accountId, apply: false, userId })).measures).toEqual([]);
  });

  it('aplicar: finalizada sin reemplazo e inactiva para corregir crean su tarea; la inactiva vuelve a Información', async () => {
    await app('MLA1', 'CLOSED');
    channel.options.set('UP-050', []);
    await db.product.update({ where: { id: productId }, data: { name: 'Otro' } });
    const other = await db.product.create({ data: { accountId, name: 'Subconjunto SP-2' } });
    const p = await db.publication.create({ data: { productId: other.id, storeId, externalId: 'MLA5', title: 'Otro', pipelineStatus: 'IN_PIPELINE', pipelineStep: 'QA' } });
    await db.channelCopy.create({ data: { publicationId: p.id, readAt: new Date(), status: 'INACTIVE', statusReason: 'Mercado Libre pide corregir datos.', installments: 3, channelProductId: 'UP-STD' } });
    await db.pipelineMovement.create({ data: { publicationId: p.id, step: 'QA' } });
    channel.options.set('UP-STD', []);
    const r = await reconcile(db, { accountId, apply: true, userId });
    expect(r.measures.flatMap((m) => m.findings.map((f) => [f.kind, f.done]))).toEqual([
      ['no_replacement', 'Se creó la tarea «¿Volver a publicar MLA1?».'],
      ['needs_fix', 'Se creó la tarea «Revisar MLA5 en Mercado Libre». Volvió al paso Información.'],
    ]);
    expect((await db.publication.findUniqueOrThrow({ where: { id: p.id } })).pipelineStep).toBe('INFO');
    expect(await db.task.count()).toBe(2);
  });

  it('solo las medidas pedidas, y las que el canal no devolvió quedan aparte', async () => {
    const a = await app('MLA1', 'ACTIVE');
    const other = await db.product.create({ data: { accountId, name: 'Subconjunto SP-2' } });
    const b = await db.publication.create({ data: { productId: other.id, storeId, externalId: 'MLA9', title: 'Otro' } });
    await db.channelCopy.create({ data: { publicationId: b.id, readAt: new Date(), status: 'ACTIVE', installments: 3, channelProductId: 'UP-X' } });
    const r = await reconcile(db, { accountId, publicationIds: [a.id], apply: false, userId });
    expect(r).toMatchObject({ checked: 1, unread: ['UP-050'], measures: [] });
  });
});
