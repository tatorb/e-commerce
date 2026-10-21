import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { listSyncLog } from '@/lib/queries/sync-log';
import { buildLogSheet, logSheetFileName, parseLogSearch, type LogSearch } from '@/domain/sync-log';

// Descarga del Registro, con los mismos filtros que la pantalla y todas las
// páginas juntas.

export const dynamic = 'force-dynamic';

function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(new Date());
}

export async function GET(request: Request, { params }: { params: Promise<{ cuenta: string }> }) {
  await requireUser();
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account) return new Response('La cuenta no existe.', { status: 404 });

  const search = Object.fromEntries(new URL(request.url).searchParams) as LogSearch;
  const entries = await listSyncLog(account.id, account.timezone, parseLogSearch(search));
  const csv = buildLogSheet(entries, account.timezone);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${logSheetFileName(account.slug, todayIn(account.timezone))}"`,
      'Cache-Control': 'no-store',
    },
  });
}
