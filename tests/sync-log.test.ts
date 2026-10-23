import Papa from 'papaparse';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import {
  buildLogSheet,
  changeSides,
  dayRange,
  dayStartIn,
  logKinds,
  logReads,
  parseLogSearch,
  personOf,
  type LogChange,
  type LogRead,
} from '@/domain/sync-log';

// El Registro: los filtros, cómo se cuenta cada cambio y la planilla. Los
// datos son de prueba.

const TZ = 'America/Argentina/Buenos_Aires';

describe('los filtros del Registro', () => {
  it('lee la dirección y descarta lo que no vale', () => {
    expect(parseLogSearch({ tipo: 'subidas,raro,fallidas', persona: 'auto,u1', desde: '2026-10-01', hasta: '2026-13-40', page: '3' })).toEqual({
      q: '',
      publicationId: null,
      types: ['subidas', 'fallidas'],
      people: ['auto', 'u1'],
      from: '2026-10-01',
      to: null,
      page: 3,
    });
    expect(parseLogSearch({ page: '-2', publicacion: 'x;drop' })).toMatchObject({ page: 1, publicationId: null });
  });

  it('sin tipo, muestra todos los cambios y solo las lecturas con problemas', () => {
    const none = parseLogSearch({});
    expect(logKinds(none)).toBeNull();
    expect(logReads(none)).toBe('problems');
    const reads = parseLogSearch({ tipo: 'lecturas' });
    expect(logKinds(reads)).toEqual([]);
    expect(logReads(reads)).toBe('all');
    expect(logKinds(parseLogSearch({ tipo: 'fallidas,elecciones' }))).toEqual(['REJECTED', 'CREATE_FAILED', 'ANSWER_FAILED', 'STATUS_FAILED', 'CHOSE_CHANNEL', 'CHOSE_APP']);
    expect(logKinds(parseLogSearch({ tipo: 'estados' }))).toEqual(['STATUS_CHANGED', 'RELISTED']);
    expect(logReads(parseLogSearch({ tipo: 'subidas' }))).toBe('none');
    // Las lecturas son de la tienda: al buscar una publicación no aparecen.
    expect(logReads(parseLogSearch({ q: 'kit' }))).toBe('none');
  });

  it('los días van de medianoche a medianoche en la zona horaria de la cuenta', () => {
    expect(dayStartIn('2026-10-21', TZ)?.toISOString()).toBe('2026-10-21T03:00:00.000Z');
    expect(dayStartIn('2026-02-30', TZ)).toBeNull();
    // Un día con cambio de hora.
    expect(dayStartIn('2026-03-29', 'Europe/Madrid')?.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(dayRange({ from: '2026-10-01', to: '2026-10-31' }, TZ)).toEqual({
      gte: new Date('2026-10-01T03:00:00.000Z'),
      lt: new Date('2026-11-01T03:00:00.000Z'),
    });
  });
});

describe('el antes y el después', () => {
  it('de los datos de catálogo muestra solo lo que no coincide', () => {
    const before = [
      { name: 'Marca', value: 'Sachs' },
      { name: 'Color', value: 'Gris' },
      { name: 'Material', value: 'Acero' },
    ];
    const after = [
      { name: 'Marca', value: 'Sachs' },
      { name: 'Color', value: 'Negro' },
      { name: 'Largo', value: '20 cm' },
    ];
    expect(changeSides('attributes', before, after)).toEqual({ before: 'Color: Gris\nMaterial: Acero', after: 'Color: Negro\nLargo: 20 cm' });
  });

  it('de las fotos dice cuántas y de dónde salen', () => {
    const channel = [
      { kind: 'channel', id: 'a', url: '' },
      { kind: 'channel', id: 'b', url: '' },
    ];
    expect(changeSides('photos', channel, [...channel, { kind: 'edit', editId: 'e1' }])).toEqual({
      before: '2 fotos del canal',
      after: '3 fotos: 2 del canal y 1 corregida',
    });
    expect(changeSides('photos', channel, null).after).toBe('Las del canal');
    expect(changeSides('publication', null, { externalId: 'MLA9' })).toEqual({ before: '', after: 'MLA9' });
    // Republicar: el código anterior y el nuevo. El estado, con su nombre.
    expect(changeSides('publication', { externalId: 'MLA1' }, { externalId: 'MLA9' })).toEqual({ before: 'MLA1', after: 'MLA9' });
    expect(changeSides('status', 'ACTIVE', 'PAUSED')).toEqual({ before: 'Activa', after: 'Pausada' });
  });

  it('la planilla trae una fila por movimiento, con la hora de la cuenta', () => {
    const change: LogChange = {
      type: 'change',
      key: 'c1',
      at: new Date('2026-10-21T15:04:00.000Z'),
      kind: 'REJECTED',
      field: 'title',
      before: 'Título viejo',
      after: 'Título, "nuevo"',
      message: 'Mercado Libre no deja cambiar el título de una publicación con ventas.',
      user: 'Ana',
      publication: { id: 'p1', title: 'Título viejo', externalId: 'MLA1', storeName: 'TIENDA' },
    };
    const read: LogRead = {
      type: 'read',
      key: 'r1',
      at: new Date('2026-10-21T13:17:00.000Z'),
      finishedAt: null,
      status: 'FAILED',
      trigger: 'SCHEDULE',
      user: null,
      storeName: 'TIENDA',
      read: 20,
      total: 40,
      updated: 1,
      missing: 0,
      errors: [{ at: '', message: 'Mercado Libre no respondió.' }],
    };
    const csv = buildLogSheet([change, read], TZ);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = Papa.parse<string[]>(csv.slice(1).trim()).data;
    expect(rows[0]).toEqual(['Fecha', 'Qué pasó', 'Publicación', 'Código', 'Tienda', 'Dato', 'Persona', 'Motivo', 'Antes', 'Después']);
    expect(rows[1]).toEqual([
      '2026-10-21 12:04',
      'No se pudo subir',
      'Título viejo',
      'MLA1',
      'TIENDA',
      'Título',
      'Ana',
      'Mercado Libre no deja cambiar el título de una publicación con ventas.',
      'Título viejo',
      'Título, "nuevo"',
    ]);
    expect(rows[2]).toEqual(['2026-10-21 10:17', 'Lectura que no terminó', '', '', 'TIENDA', 'Leyó 20 de 40, con cambios en 1.', 'Automático', 'Mercado Libre no respondió.', '', '']);
    expect(personOf({ ...change, user: null, kind: 'TAKEN' })).toBe('Automático');
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('el Registro en la base', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let query: typeof import('@/lib/queries/sync-log');
  let accountId = '';
  let ana = '';
  let kit = '';

  beforeAll(async () => {
    // La consulta usa el cliente de la app: que apunte a la base de prueba.
    process.env.DATABASE_URL = url;
    query = await import('@/lib/queries/sync-log');
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE channel_syncs, channel_sync_changes, publications, products, stores, channels, accounts, users CASCADE');
    const channel = await db.channel.create({ data: { kind: 'MERCADOLIBRE', name: 'Mercado Libre' } });
    const account = await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } });
    const other = await db.account.create({ data: { slug: 'otra', name: 'Otra cuenta' } });
    const store = await db.store.create({ data: { accountId: account.id, channelId: channel.id, name: 'TIENDA' } });
    const otherStore = await db.store.create({ data: { accountId: other.id, channelId: channel.id, name: 'OTRA' } });
    const product = await db.product.create({ data: { accountId: account.id, name: 'Kit PD-1' } });
    const otherProduct = await db.product.create({ data: { accountId: other.id, name: 'Otro' } });
    const user = await db.user.create({ data: { id: 'u-ana', email: 'ana@prueba.com', name: 'Ana' } });
    accountId = account.id;
    ana = user.id;
    const p1 = await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA1', title: 'Kit Embrague Ford' } });
    const p2 = await db.publication.create({ data: { productId: product.id, storeId: store.id, externalId: 'MLA2', title: 'Bomba de Agua' } });
    const p3 = await db.publication.create({ data: { productId: otherProduct.id, storeId: otherStore.id, externalId: 'MLA3', title: 'De otra cuenta' } });
    kit = p1.id;
    const at = (s: string) => new Date(s);
    await db.channelSyncChange.createMany({
      data: [
        { publicationId: p1.id, field: 'title', kind: 'TAKEN', before: 'Kit', after: 'Kit Embrague Ford', createdAt: at('2026-10-01T12:00:00Z') },
        { publicationId: p1.id, field: 'description', kind: 'SENT', before: 'a', after: 'b', userId: ana, createdAt: at('2026-10-10T12:00:00Z') },
        { publicationId: p2.id, field: 'title', kind: 'REJECTED', message: 'No.', userId: ana, createdAt: at('2026-10-20T12:00:00Z') },
        { publicationId: p3.id, field: 'title', kind: 'SENT', createdAt: at('2026-10-15T12:00:00Z') },
      ],
    });
    await db.channelSync.createMany({
      data: [
        { storeId: store.id, trigger: 'SCHEDULE', status: 'DONE', startedAt: at('2026-10-05T12:00:00Z') },
        { storeId: store.id, trigger: 'SCHEDULE', status: 'FAILED', startedAt: at('2026-10-06T12:00:00Z'), errors: [{ at: '', message: 'Sin respuesta.' }] },
        { storeId: store.id, trigger: 'MANUAL', userId: ana, status: 'DONE', startedAt: at('2026-10-07T12:00:00Z'), errors: [{ at: '', message: 'Un aviso.' }] },
        { storeId: otherStore.id, trigger: 'SCHEDULE', status: 'FAILED', startedAt: at('2026-10-08T12:00:00Z') },
      ],
    });
  });

  const keys = async (search: Parameters<typeof parseLogSearch>[0]) =>
    (await query.loadSyncLog(accountId, TZ, parseLogSearch(search))).entries.map((e) =>
      e.type === 'change' ? `${e.publication.externalId} ${e.kind}` : `lectura ${e.status} ${e.trigger}`,
    );

  it('trae todo lo de la cuenta, lo más nuevo primero, y solo las lecturas con problemas', async () => {
    expect(await keys({})).toEqual(['MLA2 REJECTED', 'MLA1 SENT', 'lectura DONE MANUAL', 'lectura FAILED SCHEDULE', 'MLA1 TAKEN']);
    const log = await query.loadSyncLog(accountId, TZ, parseLogSearch({}));
    expect(log.total).toBe(5);
    expect(log.people).toEqual([{ id: ana, name: 'Ana' }]);
  });

  it('filtra por tipo, persona, fecha y publicación', async () => {
    expect(await keys({ tipo: 'lecturas' })).toEqual(['lectura DONE MANUAL', 'lectura FAILED SCHEDULE', 'lectura DONE SCHEDULE']);
    expect(await keys({ tipo: 'fallidas' })).toEqual(['MLA2 REJECTED', 'lectura DONE MANUAL', 'lectura FAILED SCHEDULE']);
    expect(await keys({ persona: 'auto' })).toEqual(['lectura FAILED SCHEDULE', 'MLA1 TAKEN']);
    expect(await keys({ persona: ana, tipo: 'subidas' })).toEqual(['MLA1 SENT']);
    expect(await keys({ desde: '2026-10-06', hasta: '2026-10-10' })).toEqual(['MLA1 SENT', 'lectura DONE MANUAL', 'lectura FAILED SCHEDULE']);
    expect(await keys({ q: 'bomba' })).toEqual(['MLA2 REJECTED']);
    expect(await keys({ q: 'mla1' })).toEqual(['MLA1 SENT', 'MLA1 TAKEN']);
    expect(await keys({ publicacion: kit })).toEqual(['MLA1 SENT', 'MLA1 TAKEN']);
  });

  it('la planilla trae lo mismo que la pantalla, en todas las páginas', async () => {
    const entries = await query.listSyncLog(accountId, TZ, parseLogSearch({ tipo: 'subidas,fallidas' }));
    expect(entries.map((e) => e.key.charAt(0))).toEqual(['c', 'c', 'r', 'r']);
  });
});
