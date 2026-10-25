'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PipelineBadge } from '@/components/stages/StageBadge';
import { FACE_FIELD_LABEL } from '@/domain/channel-sync';
import { titleOrUntitled } from '@/domain/publication-title';
import type { ToPushRow } from '@/lib/queries/sync';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { pushDraftsAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

// Por subir: todas las publicaciones con cambios de la app que todavía no
// están en el canal, vengan del pipeline o de un cambio suelto. Se suben de a
// una o varias juntas; las que tienen datos para elegir se resuelven antes en
// su página.

type Outcome = { kind: 'ok' | 'error'; text: string };

const labels = (fields: ToPushRow['draft']) => fields.map((f) => FACE_FIELD_LABEL[f].toLowerCase()).join(', ');

export function ToPushList({ accountSlug, rows }: { accountSlug: string; rows: ToPushRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const stop = useRef(false);
  const pushable = rows.filter((r) => !r.blocked && r.draft.length > 0);

  async function push(ids: string[]) {
    stop.current = false;
    setProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length && !stop.current; i++) {
      const r = await pushDraftsAction(accountSlug, ids[i]).catch(() => null);
      const outcome: Outcome = !r
        ? { kind: 'error', text: 'Se cortó la conexión con la app.' }
        : !r.ok
          ? { kind: 'error', text: r.error }
          : r.rejected.length > 0
            ? { kind: 'error', text: r.rejected.map((x) => `${FACE_FIELD_LABEL[x.field]}: ${x.message}`).join(' ') }
            : { kind: 'ok', text: `Subido: ${labels(r.sent)}.` };
      setOutcomes((prev) => ({ ...prev, [ids[i]]: outcome }));
      setProgress({ done: i + 1, total: ids.length });
    }
    setProgress(null);
    setSelected(new Set());
    router.refresh();
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const chosen = [...selected];

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/50 px-4 py-3 text-sm">
        <input
          type="checkbox"
          aria-label="Elegir todas las que se pueden subir"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={pushable.length > 0 && chosen.length === pushable.length}
          disabled={pushable.length === 0 || progress !== null}
          onChange={(e) => setSelected(new Set(e.target.checked ? pushable.map((r) => r.id) : []))}
        />
        <span className="text-muted-foreground">
          {chosen.length > 0 ? `${plural(chosen.length, 'elegida', 'elegidas')}` : `${plural(rows.length, 'publicación', 'publicaciones')} con cambios`}
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {progress ? (
            <>
              <span className="tabular-nums text-muted-foreground" aria-live="polite">
                Subiendo {progress.done} de {progress.total}
              </span>
              <Button access="subir" size="sm" variant="ghost" onClick={() => (stop.current = true)}>
                Parar
              </Button>
            </>
          ) : null}
          <Button access="subir" size="sm" disabled={chosen.length === 0 || progress !== null} pending={progress !== null} onClick={() => push(chosen)}>
            <Upload />
            Subir las elegidas{chosen.length > 0 ? ` (${chosen.length})` : ''}
          </Button>
        </div>
      </div>

      <ul className="divide-y">
        {rows.map((row) => {
          const outcome = outcomes[row.id];
          const canPush = !row.blocked && row.draft.length > 0;
          return (
            <li key={row.id} className="flex gap-3 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Elegir ${titleOrUntitled(row.title)}`}
                className="mt-1 h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-30"
                checked={selected.has(row.id)}
                disabled={!canPush || progress !== null}
                onChange={(e) => toggle(row.id, e.target.checked)}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/a/${accountSlug}/publicaciones/${row.id}?cara=borrador`} className="font-medium hover:underline">
                      {titleOrUntitled(row.title)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.externalId ?? 'Sin publicar'} · {row.storeName}
                    </p>
                  </div>
                  <PipelineBadge state={row.pipeline} />
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {row.draft.length > 0 ? <Badge variant="secondary">Sin subir: {labels(row.draft)}</Badge> : null}
                  {row.choose.length > 0 ? <Badge variant="destructive">Para elegir: {labels(row.choose)}</Badge> : null}
                </div>
                {row.rejected.map((r) => (
                  <p key={r.field} className="text-sm text-destructive">
                    {FACE_FIELD_LABEL[r.field]}: {r.message}
                  </p>
                ))}
                {row.blocked ? <p className="text-xs text-muted-foreground">{row.blocked}</p> : null}
                {outcome ? <p className={cn('text-sm', outcome.kind === 'error' ? 'text-destructive' : 'text-foreground')}>{outcome.text}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {canPush ? (
                  <Button access="subir" size="sm" variant="outline" disabled={progress !== null} onClick={() => push([row.id])}>
                    Subir
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/a/${accountSlug}/publicaciones/${row.id}?cara=borrador`}>{row.choose.length > 0 ? 'Elegir' : 'Ver'}</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
