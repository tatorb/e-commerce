import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Settings2, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ReadQuestionsButton } from '@/components/questions/ReadQuestionsButton';
import { AnswerBox, type DraftView } from '@/components/questions/AnswerBox';
import { DraftMissing } from '@/components/questions/DraftMissing';
import { PublicationFactsRow } from '@/components/publication/PublicationFactsRow';
import { loadPublicationFacts, type PublicationFacts } from '@/lib/publication-facts';
import { isAiConfigured } from '@/ai/claude';
import type { PracticeCounts } from '@/domain/answers';
import { titleOrUntitled } from '@/domain/publication-title';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime, formatDuration, formatUsd, plural } from '@/lib/format';
import {
  loadAnswerSettings,
  loadPractice,
  loadQuestions,
  parseQuestionSearch,
  PRACTICE_DAYS,
  type QuestionList,
  type QuestionRow,
  type QuestionSearch,
} from '@/lib/queries/questions';
import { cn } from '@/lib/utils/cn';
import { prisma } from '@/lib/db';

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
// Las que Claude propone solo al abrir la pantalla: las de estos días.
const AUTO_DRAFT_DAYS = 30;

const OUTCOME_LABEL = {
  SENT_AS_IS: 'se mandó tal cual',
  SENT_EDITED: 'se corrigió antes de mandarla',
  DISCARDED: 'se descartó',
  ANSWERED_IN_CHANNEL: 'no se usó: respondieron en el canal',
  SENT_AUTO: 'Claude la mandó solo',
} as const;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function draftView(q: QuestionRow): DraftView | null {
  if (!q.draft || q.draft.outcome) return null;
  return {
    text: q.draft.text,
    kind: q.draft.kind,
    usedData: strings(q.draft.usedData),
    missing: strings(q.draft.missing),
    needsPerson: q.draft.needsPerson,
    reason: q.draft.reason,
  };
}

function Practice({ p, channels }: { p: PracticeCounts; channels: string }) {
  const parts = [
    `${p.SENT_AS_IS} mandadas tal cual`,
    `${p.SENT_EDITED} corregidas`,
    ...(p.SENT_AUTO > 0 ? [`${p.SENT_AUTO} mandadas por Claude solo`] : []),
    `${p.DISCARDED} descartadas`,
    `${p.ANSWERED_IN_CHANNEL} respondidas en ${channels} sin usarla`,
    ...(p.PENDING > 0 ? [`${p.PENDING} esperando`] : []),
  ];
  return (
    <Card className="space-y-1 p-4 text-sm">
      <p className="font-medium">
        Cómo le va a Claude en los últimos {PRACTICE_DAYS} días: {plural(p.total, 'propuesta', 'propuestas')}
      </p>
      <p className="text-muted-foreground">
        {parts.join(' · ')}. Costaron {formatUsd(p.costUsd)}.
      </p>
    </Card>
  );
}

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

/** La primera foto que tiene en el canal. */
function firstPhoto(photos: unknown): string | null {
  return Array.isArray(photos) && typeof photos[0] === 'string' && photos[0] ? photos[0] : null;
}

/** La publicación donde se hizo la pregunta: su foto, su título, su código y cómo está. */
function QuestionListing({
  q,
  accountSlug,
  showStore,
  facts,
}: {
  q: QuestionRow;
  accountSlug: string;
  showStore: boolean;
  facts: PublicationFacts | null;
}) {
  const pub = q.publication;
  const photo = pub ? firstPhoto(pub.channelCopy?.photos) : null;
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-2">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded border bg-white object-contain" loading="lazy" />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded border bg-muted" aria-hidden />
      )}
      <div className="min-w-0 space-y-1">
        {pub ? (
          <Link href={`/a/${accountSlug}/publicaciones/${pub.id}`} className="block font-medium leading-snug underline-offset-4 hover:underline">
            {titleOrUntitled(pub.title)}
          </Link>
        ) : (
          <p className="text-muted-foreground">Publicación que no está en la app</p>
        )}
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{pub?.externalId ?? q.listingId}</span>
          {showStore ? <span>· {q.store.name}</span> : null}
          {pub?.url ? (
            <>
              <span aria-hidden>·</span>
              <a href={pub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline-offset-4 hover:underline">
                Ver en {q.store.channel.name}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </>
          ) : null}
        </p>
        {facts ? <PublicationFactsRow facts={facts} /> : null}
      </div>
    </div>
  );
}

function QuestionItem({
  q,
  accountSlug,
  timeZone,
  now,
  showStore,
  canDraft,
  facts,
}: {
  q: QuestionRow;
  accountSlug: string;
  timeZone: string;
  now: Date;
  showStore: boolean;
  canDraft: boolean;
  facts: Map<string, PublicationFacts>;
}) {
  const draft = draftView(q);
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
      <QuestionListing q={q} accountSlug={accountSlug} showStore={showStore} facts={q.publication ? (facts.get(q.publication.id) ?? null) : null} />
      {q.answer ? (
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {q.draft?.outcome === 'SENT_AUTO'
              ? 'Claude la respondió solo'
              : q.answeredFrom === 'APP'
                ? `Respondida desde la app${q.answeredBy ? ` por ${q.answeredBy.name}` : ''}`
                : `Respondida en ${q.store.channel.name}`}
            {q.answeredAt ? ` el ${formatDateTime(q.answeredAt, timeZone)}` : ''}
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words">{q.answer}</p>
        </div>
      ) : null}
      {q.status === 'ANSWERED' && q.draft && q.draft.outcome !== 'SENT_AS_IS' && q.draft.outcome !== 'SENT_AUTO' ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Lo que había propuesto Claude{q.draft.outcome ? `: ${OUTCOME_LABEL[q.draft.outcome]}` : ''}
          </summary>
          <p className="mt-1 whitespace-pre-line break-words rounded-md border px-3 py-2 text-sm">{q.draft.text}</p>
        </details>
      ) : null}
      {q.status === 'ANSWERED' && q.draft?.outcome === 'SENT_AS_IS' ? (
        <p className="text-xs text-muted-foreground">Es la propuesta de Claude, mandada tal cual.</p>
      ) : null}
      {q.status === 'UNANSWERED' && q.text ? (
        <AnswerBox
          key={`${q.id}:${draft?.text ?? ''}:${q.draft?.outcome ?? ''}`}
          accountSlug={accountSlug}
          questionId={q.id}
          channelName={q.store.channel.name}
          draft={draft}
          discarded={q.draft?.outcome === 'DISCARDED'}
          canDraft={canDraft}
        />
      ) : null}
    </li>
  );
}

export default async function QuestionsPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<QuestionSearch> }) {
  const [{ cuenta }, search] = await Promise.all([params, searchParams]);
  const { account, canWrite } = await requireAccount(cuenta, 'preguntas');
  const tz = account.timezone;
  const f = parseQuestionSearch(search);
  const [list, practice, settings] = await Promise.all([loadQuestions(account.id, f), loadPractice(account.id), loadAnswerSettings(account.id)]);
  // El código, el estado, las medidas y la respuesta automática de cada publicación con preguntas.
  const facts = await loadPublicationFacts(prisma, [
    ...new Set([...list.forPerson, ...list.questions].flatMap((q) => (q.publication ? [q.publication.id] : []))),
  ]);
  const now = new Date();
  const aiReady = isAiConfigured();
  // Las que Claude todavía no propuso: se proponen al abrir la pantalla.
  const toDraft =
    // Quien solo puede ver no pide propuestas.
    canWrite && aiReady && settings?.autoDraft !== false && f.view === 'sin-responder'
      ? list.questions.filter((q) => !q.draft && q.text && now.getTime() - q.askedAt.getTime() < AUTO_DRAFT_DAYS * 86_400_000).length
      : 0;
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
      <PageHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Preguntas</h1>
            <p className="text-sm text-muted-foreground">
              Las preguntas de los compradores de <strong>{account.name}</strong> en {channels}. Llegan solas, y lo que se responde allá también
              aparece acá.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/a/${account.slug}/respuestas`}>
                <Settings2 className="h-4 w-4" />
                Cómo responde la tienda
              </Link>
            </Button>
            {list.stores.some((s) => s.connected) ? <ReadQuestionsButton accountSlug={account.slug} /> : null}
          </div>
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
      <PageBody>
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

        {practice.total > 0 ? <Practice p={practice} channels={channels} /> : null}
        {!aiReady && f.view === 'sin-responder' ? (
          <p className="text-sm text-muted-foreground">Claude no puede proponer respuestas: falta configurar su clave en Vercel. Igual podés responder a mano.</p>
        ) : null}
        {toDraft > 0 ? <DraftMissing accountSlug={account.slug} count={toDraft} /> : null}

        <Card>
          <form className="flex flex-wrap items-end gap-3 p-4" action="" method="get">
            <Input name="q" defaultValue={f.q} placeholder="texto, título o código…" aria-label="Buscar" className="w-full sm:w-80" />
            {kept
              .filter(([k]) => k !== 'q' && k !== 'page')
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <Button access="view" type="submit">Buscar</Button>
            {f.q ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={hrefWith({ q: null, page: null })}>Limpiar</Link>
              </Button>
            ) : null}
          </form>
        </Card>

        {list.forPerson.length > 0 ? (
          <Card className="overflow-hidden border-alert/60">
            <div className="space-y-0.5 border-b bg-alert/20 px-4 py-2">
              <h2 className="text-sm font-semibold">Para una persona · {list.counts.forPerson}</h2>
              <p className="text-xs text-muted-foreground">Claude no las mandó porque no está seguro, le falta un dato o una regla pide que responda una persona.</p>
            </div>
            <ul className="divide-y">
              {list.forPerson.map((q) => (
                <QuestionItem key={q.id} q={q} accountSlug={account.slug} timeZone={tz} now={now} showStore={list.stores.length > 1} canDraft={aiReady} facts={facts} />
              ))}
            </ul>
          </Card>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {list.forPerson.length > 0 ? plural(list.total, 'otra pregunta', 'otras preguntas') : plural(list.total, 'pregunta', 'preguntas')}
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
                    ? list.counts.forPerson > 0
                      ? 'No hay otras preguntas sin responder.'
                      : 'No hay preguntas sin responder.'
                    : 'Todavía no hay preguntas respondidas.'}
            </p>
          ) : (
            <ul className="divide-y">
              {list.questions.map((q) => (
                <QuestionItem key={q.id} q={q} accountSlug={account.slug} timeZone={tz} now={now} showStore={list.stores.length > 1} canDraft={aiReady} facts={facts} />
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
