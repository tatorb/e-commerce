import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ReadQuestionsButton } from '@/components/questions/ReadQuestionsButton';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime, formatDuration, plural } from '@/lib/format';
import { loadQuestions, parseQuestionSearch, type QuestionList, type QuestionRow, type QuestionSearch } from '@/lib/queries/questions';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';
// "Leer ahora" hace varios pedidos al canal.
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Preguntas · ${account.name}` : 'Preguntas' };
}

// Desde cuántas horas sin respuesta se marca la espera.
const LONG_WAIT_H = 12;

function chipClass(active: boolean): string {
  return cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground/70 border-border hover:bg-muted hover:text-foreground',
  );
}

function StoreStatus({ store, accountSlug, timeZone }: { store: QuestionList['stores'][number]; accountSlug: string; timeZone: string }) {
  const r = store.reader;
  const lines: { text: React.ReactNode; alert?: boolean }[] = [];
  if (!store.connected) {
    lines.push({
      alert: true,
      text: (
        <>
          No se pueden leer: hay que volver a conectar la tienda en{' '}
          <Link href={`/a/${accountSlug}/conexion`} className="font-medium underline-offset-4 hover:underline">
            Conexión
          </Link>
          .
        </>
      ),
    });
  }
  if (r?.lastError) lines.push({ alert: true, text: r.lastError });
  lines.push({ text: r?.readAt ? `Última lectura el ${formatDateTime(r.readAt, timeZone)}.` : 'Todavía no se leyeron. Tocá Leer ahora para traerlas.' });
  if (r && r.readAt && r.historyOffset !== null) {
    lines.push({
      text: `Trayendo las preguntas anteriores: van ${r.historyOffset}${r.historyTotal ? ` de ${r.historyTotal}` : ''}. Sigue sola en la lectura de cada hora.`,
    });
  } else if (r?.historyLimited) {
    lines.push({ text: `${store.channelName} no deja traer preguntas más viejas que las que ya están.` });
  }
  lines.push({
    text: r?.noticeAt
      ? `Último aviso de ${store.channelName} el ${formatDateTime(r.noticeAt, timeZone)}: las preguntas llegan al instante.`
      : `Todavía no llegó ningún aviso de ${store.channelName}. Sin el aviso, las preguntas llegan con la lectura de cada hora.`,
  });
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">
        {store.channelName} · {store.name}
      </p>
      {lines.map((l, i) => (
        <p key={i} className={l.alert ? 'text-destructive' : 'text-muted-foreground'}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

function QuestionItem({ q, accountSlug, timeZone, now, showStore }: { q: QuestionRow; accountSlug: string; timeZone: string; now: Date; showStore: boolean }) {
  const waitingH = (now.getTime() - q.askedAt.getTime()) / 3_600_000;
  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(q.askedAt, timeZone)}</span>
        {q.status === 'UNANSWERED' ? (
          <span className={cn('text-xs', waitingH >= LONG_WAIT_H ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            Espera hace {formatDuration(q.askedAt, now)}
          </span>
        ) : null}
      </div>
      <p className="whitespace-pre-line break-words font-medium">{q.text || 'El canal ocultó el texto de esta pregunta.'}</p>
      <p className="min-w-0 text-xs text-muted-foreground">
        {q.publication ? (
          <Link href={`/a/${accountSlug}/publicaciones/${q.publication.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
            {titleOrUntitled(q.publication.title)}
          </Link>
        ) : (
          <span>Publicación que no está en la app</span>
        )}
        {` · ${q.publication?.externalId ?? q.listingId}`}
        {showStore ? ` · ${q.store.name}` : ''}
      </p>
      {q.answer ? (
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Respondida en {q.store.channel.name}
            {q.answeredAt ? ` el ${formatDateTime(q.answeredAt, timeZone)}` : ''}
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words">{q.answer}</p>
        </div>
      ) : null}
    </li>
  );
}

export default async function QuestionsPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<QuestionSearch> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account } = await requireAccount(cuenta);
  const tz = account.timezone;
  const f = parseQuestionSearch(search);
  const list = await loadQuestions(account.id, f);
  const now = new Date();
  const channels = [...new Set(list.stores.map((s) => s.channelName))].join(' y ') || 'los canales';

  const kept = Object.entries(search).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '');
  const hrefWith = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(kept.filter(([k]) => !(k in changes)));
    for (const [k, v] of Object.entries(changes)) if (v) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `?${qs}` : '?';
  };
  const neverRead = list.stores.every((s) => !s.reader?.readAt);

  return (
    <>
      <PageHeader className="max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Preguntas</h1>
            <p className="text-sm text-muted-foreground">
              Las preguntas de los compradores de <strong>{account.name}</strong> en {channels}. Llegan solas, y lo que se responde allá también
              aparece acá.
            </p>
          </div>
          {list.stores.some((s) => s.connected) ? <ReadQuestionsButton accountSlug={account.slug} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefWith({ vista: null, page: null })} className={chipClass(f.view === 'sin-responder')}>
            Sin responder · {list.counts.unanswered}
          </Link>
          <Link href={hrefWith({ vista: 'respondidas', page: null })} className={chipClass(f.view === 'respondidas')}>
            Respondidas · {list.counts.answered}
          </Link>
          {f.publicationId ? (
            <Link
              href={hrefWith({ publicacion: null, page: null })}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-foreground bg-foreground px-3 py-1 text-xs font-medium text-background"
              title="Quitar este filtro"
            >
              <span className="truncate">Solo {list.publication ? titleOrUntitled(list.publication.title) : 'esa publicación'}</span>
              <X className="h-3 w-3 shrink-0" aria-hidden />
            </Link>
          ) : null}
        </div>
      </PageHeader>
      <PageBody className="max-w-5xl">
        {list.stores.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            Para recibir las preguntas, conectá la tienda en{' '}
            <Link href={`/a/${account.slug}/conexion`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Conexión
            </Link>
            .
          </Card>
        ) : (
          <Card className="space-y-3 p-4">
            {list.stores.map((s) => (
              <StoreStatus key={s.id} store={s} accountSlug={account.slug} timeZone={tz} />
            ))}
          </Card>
        )}

        <Card>
          <form className="flex flex-wrap items-end gap-3 p-4" action="" method="get">
            <Input name="q" defaultValue={f.q} placeholder="texto, título o código…" aria-label="Buscar" className="w-full sm:w-80" />
            {kept
              .filter(([k]) => k !== 'q' && k !== 'page')
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <Button type="submit">Buscar</Button>
            {f.q ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={hrefWith({ q: null, page: null })}>Limpiar</Link>
              </Button>
            ) : null}
          </form>
        </Card>

        <p className="text-sm text-muted-foreground">
          {plural(list.total, 'pregunta', 'preguntas')}
          {list.pages > 1 ? ` · página ${f.page} de ${list.pages}` : ''}
          {f.view === 'sin-responder' && list.total > 0 ? ', la que más espera arriba.' : ''}
        </p>

        <Card className="overflow-hidden">
          {list.questions.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {neverRead
                ? 'Todavía no se leyeron las preguntas.'
                : f.q || f.publicationId
                  ? 'No hay preguntas que coincidan.'
                  : f.view === 'sin-responder'
                    ? 'No hay preguntas sin responder.'
                    : 'Todavía no hay preguntas respondidas.'}
            </p>
          ) : (
            <ul className="divide-y">
              {list.questions.map((q) => (
                <QuestionItem key={q.id} q={q} accountSlug={account.slug} timeZone={tz} now={now} showStore={list.stores.length > 1} />
              ))}
            </ul>
          )}
        </Card>

        {list.pages > 1 ? (
          <nav className="flex items-center justify-between gap-2" aria-label="Páginas">
            {f.page > 1 ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={hrefWith({ page: f.page - 1 > 1 ? String(f.page - 1) : null })}>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {f.page < list.pages ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={hrefWith({ page: String(f.page + 1) })}>
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </PageBody>
    </>
  );
}
