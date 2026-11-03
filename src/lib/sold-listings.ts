import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { ConnectError } from '@/channels/connect';
import { getChannelListings, LISTINGS_BATCH } from '@/channels/listings';
import { applyRows } from '@/importers/apply';
import { listingToRow } from '@/importers/channel-listings';
import { withAccessToken } from '@/lib/connections';
import { relinkSaleLines } from '@/lib/sales/read';
import { variantListingOwners } from '@/lib/variant-listings';

// Las publicaciones que se vendieron en el canal y no están en la app, por
// ejemplo una medida de una familia que no se importó. Se traen del canal con
// el importador de siempre, como "Traer por código", y sus ventas quedan
// unidas a ellas. Solo lee del canal: no sube nada. La sincronización de cada
// hora las suma después a su familia. Recibe la base por parámetro para poder
// probarlo con una base de prueba y un canal simulado.

type Db = PrismaClient;

const DAY = 24 * 60 * 60 * 1000;
// Una que el canal no devolvió se vuelve a pedir a la semana.
const RETRY_MS = 7 * DAY;
// Hasta cuántas por lectura.
const MAX_PER_RUN = 60;

/** Los códigos vendidos de una tienda que no están en la app ni se pidieron hace poco. */
export async function soldListingsMissing(db: Db, storeId: string, now: Date): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT l->>'listingId' AS id
    FROM sales s, jsonb_array_elements(s.lines) l
    WHERE s."storeId" = ${storeId} AND l->>'listingId' IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM publications p WHERE p."storeId" = s."storeId" AND p."externalId" = l->>'listingId')
      AND NOT EXISTS (
        SELECT 1 FROM channel_listing_misses m
        WHERE m."storeId" = s."storeId" AND m."externalId" = l->>'listingId' AND m."checkedAt" > ${new Date(now.getTime() - RETRY_MS)}::timestamp
      )`;
  // Las medidas que ya están dentro de una publicación con varios códigos tampoco faltan.
  const owners = await variantListingOwners(db, storeId);
  return rows.map((r) => r.id).filter((id) => !owners.has(id)).sort();
}

export type SoldListingsResult = { imported: string[]; notFound: string[]; pending: boolean };

/** Trae las publicaciones vendidas que faltan, de todas las tiendas conectadas, con lo que queda de tiempo. */
export async function importSoldListings(db: Db, opts: { budgetMs: number; now?: () => Date; accountId?: string }): Promise<SoldListingsResult> {
  const clock = opts.now ?? (() => new Date());
  const started = clock().getTime();
  const left = () => opts.budgetMs - (clock().getTime() - started);
  const out: SoldListingsResult = { imported: [], notFound: [], pending: false };
  const stores = await db.store.findMany({
    where: { connection: { status: 'ACTIVE' }, ...(opts.accountId ? { accountId: opts.accountId } : {}) },
    select: { id: true, name: true, accountId: true, channel: { select: { kind: true, name: true } }, account: { select: { timezone: true } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const store of stores) {
    const listings = getChannelListings(store.channel.kind);
    if (!listings) continue;
    if (left() <= 0) {
      out.pending = true;
      break;
    }
    const all = await soldListingsMissing(db, store.id, clock());
    if (all.length === 0) continue;
    const wanted = all.slice(0, MAX_PER_RUN);
    if (all.length > wanted.length) out.pending = true;
    const adapter = getChannelAdapter(store.channel.kind, store.channel.name);
    const day = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: store.account.timezone, dateStyle: 'short' }).format(clock())}T00:00:00Z`);
    const run = await db.importRun.create({
      data: {
        accountId: store.accountId,
        storeId: store.id,
        userId: null,
        origin: 'CHANNEL_API',
        fileName: `${store.channel.name} · ${store.name} · publicaciones vendidas que faltaban`,
        sheetName: store.channel.name,
        dataDate: day,
        rowsTotal: wanted.length,
        updateMode: 'FILL_EMPTY',
      },
      select: { id: true },
    });
    const imported: string[] = [];
    try {
      await withAccessToken(db, store.id, async (token, userId) => {
        for (let i = 0; i < wanted.length; i += LISTINGS_BATCH) {
          if (left() <= 0) {
            out.pending = true;
            return;
          }
          const batch = wanted.slice(i, i + LISTINGS_BATCH);
          const { listings: read, missing } = await listings.readListings(token, userId, batch);
          const rows = read.map((l, n) => listingToRow(l, i + n + 1, adapter));
          const result = await applyRows(
            db,
            { accountId: store.accountId, storeId: store.id, adapter, runId: run.id, userId: null, dataDate: day, mode: 'FILL_EMPTY', fromChannel: true },
            rows,
          );
          await db.importRun.update({
            where: { id: run.id },
            data: {
              rowsProcessed: { increment: result.processed },
              productsCreated: { increment: result.productsCreated },
              publicationsCreated: { increment: result.publicationsCreated },
              publicationsLinked: { increment: result.publicationsLinked },
              publicationsExisting: { increment: result.publicationsExisting },
              publicationsUpdated: { increment: result.publicationsUpdated },
              fieldsChanged: { increment: result.fieldsChanged },
              measurementsSaved: { increment: result.measurementsSaved },
              rowsWithErrors: { increment: result.errors.length },
              ...(result.errors.length > 0 ? { errors: result.errors.slice(0, 200) } : {}),
            },
          });
          // Las que el canal no devolvió, o que no se pudieron guardar, no se vuelven a pedir enseguida.
          const saved = new Set(
            (await db.publication.findMany({ where: { storeId: store.id, externalId: { in: batch } }, select: { externalId: true } })).map((p) => p.externalId),
          );
          const failed = batch.filter((id) => !saved.has(id));
          for (const id of failed) {
            await db.channelListingMiss.upsert({
              where: { storeId_externalId: { storeId: store.id, externalId: id } },
              create: { storeId: store.id, externalId: id, checkedAt: clock() },
              update: { checkedAt: clock() },
            });
          }
          imported.push(...batch.filter((id) => saved.has(id)));
          out.notFound.push(...failed.filter((id) => missing.includes(id) || !read.some((l) => l.externalId === id)));
        }
      });
    } catch (e) {
      if (!(e instanceof ConnectError)) throw e;
      out.pending = true;
    } finally {
      await db.importRun.update({ where: { id: run.id }, data: { status: 'DONE', finishedAt: clock() } });
    }
    // Sus ventas, unidas a la publicación que se trajo.
    await relinkSaleLines(db, store.id, imported);
    out.imported.push(...imported);
  }
  return out;
}
