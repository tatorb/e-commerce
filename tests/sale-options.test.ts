import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { chooseMain, planMainOptions, samePlanOptions, type OptionRow } from '@/domain/sale-options';
import { statusReasonOf } from '@/channels/mercadolibre/listings';
import { assignSaleOptions } from '@/lib/sale-options';

// Opciones de venta: varias publicaciones del canal para la misma medida.
// Datos inventados.

const row = (id: string, extra: Partial<OptionRow> = {}): OptionRow => ({
  id,
  channelProductId: 'UP-1',
  mainOptionId: null,
  status: 'ACTIVE',
  pipelineStatus: 'UNTOUCHED',
  familyLead: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...extra,
});

describe('la opción principal de cada medida', () => {
  it('se queda la que ya era principal, aunque esté finalizada', () => {
    const group = [row('a', { status: 'CLOSED' }), row('b', { mainOptionId: 'a' }), row('c', { mainOptionId: 'a' })];
    expect(chooseMain(group).id).toBe('a');
  });

  it('sin principal, gana la que tiene trabajo de pipeline, después la que se vende y después la más vieja', () => {
    expect(chooseMain([row('a'), row('b', { status: 'PAUSED', pipelineStatus: 'IN_PIPELINE' })]).id).toBe('b');
    expect(chooseMain([row('a', { status: 'PAUSED' }), row('b', { familyLead: true, status: 'CLOSED' })]).id).toBe('b');
    expect(chooseMain([row('a', { status: 'PAUSED' }), row('b')]).id).toBe('b');
    expect(chooseMain([row('b', { createdAt: new Date('2026-02-01') }), row('a', { createdAt: new Date('2026-03-01') })]).id).toBe('b');
  });

  it('cada otra opción apunta a la principal; las que van solas o salieron del grupo no apuntan a nadie', () => {
    const rows = [
      row('a', { pipelineStatus: 'IN_PIPELINE' }),
      row('b'),
      row('c', { channelProductId: 'UP-2', mainOptionId: 'a' }),
      row('d', { channelProductId: null }),
    ];
    expect(planMainOptions(rows)).toEqual(new Map([['b', 'a'], ['c', null]]));
    // Sin cambios, no devuelve nada.
    expect(planMainOptions([row('a'), row('b', { mainOptionId: 'a' })]).size).toBe(0);
  });

  it('avisa cuando dos opciones vivas de la misma medida tienen la misma forma de cobro', () => {
    const options = [
      { id: 'a', status: 'ACTIVE' as const, installments: 3 },
      { id: 'b', status: 'PAUSED' as const, installments: 3 },
      { id: 'c', status: 'CLOSED' as const, installments: 0 },
      { id: 'd', status: 'ACTIVE' as const, installments: 0 },
      { id: 'e', status: 'CLOSED' as const, installments: 3 },
    ];
    expect(samePlanOptions(options)).toEqual([{ plan: 3, label: '3 cuotas', options: [options[0], options[1]] }]);
  });

  it('el motivo del estado, en palabras, sin perder los que no conoce', () => {
    expect(statusReasonOf({ sub_status: [] })).toBeNull();
    expect(statusReasonOf({})).toBeNull();
    expect(statusReasonOf({ sub_status: ['waiting_for_patch'] })).toBe('Mercado Libre pide corregir datos para volver a activarla.');
    expect(statusReasonOf({ sub_status: ['deleted', 'algo_nuevo'] })).toBe('Eliminada. Motivo de Mercado Libre: algo_nuevo.');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('agrupar las opciones de venta en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let storeId = '';
  let productId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE listing_families, channel_copies, publications, products, stores, channels, accounts CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    storeId = (await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } })).id;
    productId = (await db.product.create({ data: { accountId: account.id, name: 'Subconjunto SP-1' } })).id;
  });

  const listing = async (externalId: string, channelProductId: string | null, extra: { status?: 'ACTIVE' | 'PAUSED' | 'CLOSED'; installments?: number; inPipeline?: boolean } = {}) => {
    const p = await db.publication.create({
      data: { productId, storeId, externalId, title: 'Subconjunto', ...(extra.inPipeline ? { pipelineStatus: 'IN_PIPELINE', pipelineStep: 'INFO' } : {}) },
    });
    await db.channelCopy.create({
      data: { publicationId: p.id, readAt: new Date(), status: extra.status ?? 'ACTIVE', installments: extra.installments ?? 3, channelProductId },
    });
    return p;
  };

  it('agrupa por la medida del canal, deja como principal la del pipeline y no cambia nada la segunda vez', async () => {
    const worked = await listing('MLA1', 'UP-050', { status: 'CLOSED', inPipeline: true });
    const live = await listing('MLA2', 'UP-050', { installments: 1 });
    const alone = await listing('MLA3', 'UP-STD');
    const unknown = await listing('MLA4', null);
    expect(await assignSaleOptions(db, storeId)).toBe(1);
    const byId = async (id: string) => (await db.publication.findUniqueOrThrow({ where: { id } })).mainOptionId;
    expect(await byId(worked.id)).toBeNull();
    expect(await byId(live.id)).toBe(worked.id);
    expect(await byId(alone.id)).toBeNull();
    expect(await byId(unknown.id)).toBeNull();
    expect(await assignSaleOptions(db, storeId)).toBe(0);

    // Si la otra opción pasa a otra medida, deja de apuntar.
    await db.channelCopy.update({ where: { publicationId: live.id }, data: { channelProductId: 'UP-OTRA' } });
    expect(await assignSaleOptions(db, storeId)).toBe(1);
    expect(await byId(live.id)).toBeNull();
  });
});
