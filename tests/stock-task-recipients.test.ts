import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { groupStockAlarms, type AlarmRow } from '@/lib/stock-alarms';
import { saveStockTaskRecipients, StockRecipientsError, stockTaskRecipients, stockTaskSettings } from '@/lib/stock-task-recipients';

// A quién le llegan las tareas de stock, y las alarmas agrupadas por producto
// y medida. Datos inventados.

const row = (over: Partial<AlarmRow>): AlarmRow => ({
  publicationId: 'pub',
  title: 'Subconjunto',
  externalId: 'MLA1',
  url: null,
  storeName: 'TIENDA',
  channelName: 'Mercado Libre',
  channelKind: 'MERCADOLIBRE',
  channelStatus: 'ACTIVE',
  productId: 'p1',
  productName: 'Subconjunto SP-1',
  measure: 'STD',
  stockKey: 'std',
  sku: 'SP-1-00',
  real: 0,
  shown: 6,
  inChannel: 6,
  level: 'out',
  outSince: null,
  remindedAt: null,
  remindAt: null,
  taskId: null,
  ...over,
});

describe('las alarmas agrupadas', () => {
  it('juntan cada medida una sola vez, con sus publicaciones, dentro de su producto', () => {
    const groups = groupStockAlarms([
      row({ publicationId: 'a' }),
      row({ publicationId: 'b' }),
      row({ publicationId: 'c', productId: 'p2', productName: 'Subconjunto SP-2', stockKey: 'x', sku: 'SP-2-50', measure: '0.50' }),
      row({ publicationId: 'd', stockKey: '050', sku: 'SP-1-50', measure: '0.50', real: 1 }),
    ]);
    expect(groups.map((g) => g.productName)).toEqual(['Subconjunto SP-1', 'Subconjunto SP-2']);
    expect(groups[0].measures.map((m) => [m.sku, m.listings.map((l) => l.publicationId)])).toEqual([
      ['SP-1-00', ['a', 'b']],
      ['SP-1-50', ['d']],
    ]);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('a quién le llegan las tareas de stock', () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let accountId = '';

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe('TRUNCATE tasks, user_accounts, accounts, users CASCADE');
    accountId = (await db.account.create({ data: { slug: 'prueba', name: 'Cuenta de prueba' } })).id;
    await db.user.createMany({
      data: [
        { id: 'ana', name: 'Ana', email: 'ana@prueba.com', isAdmin: true },
        { id: 'beto', name: 'Beto', email: 'beto@prueba.com', isAdmin: true },
        { id: 'caro', name: 'Caro', email: 'caro@prueba.com' },
        { id: 'dani', name: 'Dani', email: 'dani@prueba.com' },
      ],
    });
    // Caro entra a la cuenta; Dani no.
    await db.userAccount.create({ data: { userId: 'caro', accountId } });
  });

  const openTask = (autoKey: string, assignees: string[]) =>
    db.task.create({ data: { accountId, title: 'Reponer', autoKey, assignees: { create: assignees.map((userId) => ({ userId })) } } });

  it('sin elegir, a todos los administradores; con elegidas, solo a ellas, y las tareas abiertas se actualizan', async () => {
    expect((await stockTaskRecipients(db, accountId)).sort()).toEqual(['ana', 'beto']);
    const settings = await stockTaskSettings(db, accountId);
    expect(settings.everyAdmin).toBe(true);
    expect(settings.candidates.map((c) => [c.id, c.chosen])).toEqual([
      ['ana', true],
      ['beto', true],
      ['caro', false],
    ]);

    const stock = await openTask('stock:p1:', ['ana', 'beto']);
    const reactivate = await openTask('reactivar:pub', ['ana', 'beto']);
    // Una tarea a la que alguien sumó a Caro a mano, y una que no es de stock.
    await db.taskAssignee.create({ data: { taskId: stock.id, userId: 'caro' } });
    const other = await openTask('venta:1', ['ana', 'beto']);

    const r = await saveStockTaskRecipients(db, accountId, ['caro', 'ana']);
    expect(r.removed).toBe(2);
    expect((await stockTaskRecipients(db, accountId)).sort()).toEqual(['ana', 'caro']);
    const who = async (id: string) => (await db.taskAssignee.findMany({ where: { taskId: id } })).map((a) => a.userId).sort();
    expect(await who(stock.id)).toEqual(['ana', 'caro']);
    expect(await who(reactivate.id)).toEqual(['ana', 'caro']);
    expect(await who(other.id)).toEqual(['ana', 'beto']);
  });

  it('no deja elegir a quien no entra a la cuenta ni dejar a nadie, y si las elegidas se dan de baja vuelve a los administradores', async () => {
    await expect(saveStockTaskRecipients(db, accountId, ['dani'])).rejects.toBeInstanceOf(StockRecipientsError);
    await expect(saveStockTaskRecipients(db, accountId, [])).rejects.toThrow('al menos una');
    await saveStockTaskRecipients(db, accountId, ['caro']);
    expect(await stockTaskRecipients(db, accountId)).toEqual(['caro']);
    await db.user.update({ where: { id: 'caro' }, data: { disabledAt: new Date() } });
    expect((await stockTaskRecipients(db, accountId)).sort()).toEqual(['ana', 'beto']);
  });
});
