import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { activitySheetFileName, buildActivitySheet, parseActivitySearch, type ActivitySearch } from '@/domain/activity';
import { DEFAULT_TIMEZONE } from '@/lib/format';
import { activitySheetRows } from '@/lib/queries/activity';

// La planilla de la actividad, con los mismos filtros que la pantalla. Solo para administradores.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user.isAdmin) return new Response('Solo un administrador puede ver la actividad.', { status: 403 });
  const search = Object.fromEntries(new URL(request.url).searchParams) as ActivitySearch;
  const rows = await activitySheetRows(prisma, parseActivitySearch(search), DEFAULT_TIMEZONE);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIMEZONE, dateStyle: 'short' }).format(new Date());
  return new Response(buildActivitySheet(rows, DEFAULT_TIMEZONE), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${activitySheetFileName(today)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
