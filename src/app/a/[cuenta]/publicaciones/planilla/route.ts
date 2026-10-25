import { requireUser } from '@/lib/auth/session';
import { can, canSeeAccount } from '@/domain/access';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { listScoredPublications } from '@/lib/queries/scoring';
import {
  filterPublications,
  listContentSheetRows,
  parsePublicationSearch,
  type PublicationSearch,
} from '@/lib/queries/publication-list';
import { buildContentSheet, contentSheetFileName } from '@/importers/content-sheet';

// Descarga de la planilla de contenido, con los mismos filtros y el mismo
// orden que la lista de publicaciones.

export const dynamic = 'force-dynamic';

function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(new Date());
}

export async function GET(request: Request, { params }: { params: Promise<{ cuenta: string }> }) {
  const user = await requireUser();
  const { cuenta } = await params;
  const account = await getAccountBySlug(cuenta);
  if (!account || !canSeeAccount(user.access, account.id) || !can(user.access, 'publicaciones', 'read')) {
    return new Response('La cuenta no existe.', { status: 404 });
  }

  const search = Object.fromEntries(new URL(request.url).searchParams) as PublicationSearch;
  const items = filterPublications(await listScoredPublications(account.id), parsePublicationSearch(search));
  const csv = buildContentSheet(await listContentSheetRows(items.map((p) => p.id)));
  const fileName = contentSheetFileName(account.slug, todayIn(account.timezone));

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
