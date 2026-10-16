'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { WordEntry, WordStatus } from '@/domain/titles';
import { cn } from '@/lib/utils/cn';
import { setWordStatusAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// Todas las palabras de las sugerencias y de la competencia, con de dónde
// salen y cuántas veces aparecen. Cada una se tilda para usarla o se descarta.

const SOURCE: Record<WordEntry['source'], string> = {
  suggestions: 'Buscador',
  competitors: 'Competencia',
  both: 'Ambos',
};

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'none', label: 'Sin marcar' },
  { key: 'use', label: 'Tildadas' },
  { key: 'discard', label: 'Descartadas' },
] as const;

export function WordMapPanel({
  accountSlug,
  publicationId,
  words,
}: {
  accountSlug: string;
  publicationId: string;
  words: WordEntry[];
}) {
  const [statuses, setStatuses] = useState<Record<string, WordStatus | null>>(() =>
    Object.fromEntries(words.map((w) => [w.key, w.status])),
  );
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const action = useStepAction();

  if (words.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay palabras. Aparecen cuando hay sugerencias del buscador o títulos de la competencia.
      </p>
    );
  }

  const statusOf = (w: WordEntry) => (w.key in statuses ? statuses[w.key] : w.status);
  function mark(w: WordEntry, next: WordStatus) {
    const value = statusOf(w) === next ? null : next;
    setStatuses((s) => ({ ...s, [w.key]: value }));
    action.run(() => setWordStatusAction(accountSlug, publicationId, w.word, value));
  }

  const count = (s: WordStatus | null) => words.filter((w) => statusOf(w) === s).length;
  const shown = words.filter((w) =>
    filter === 'all' ? true : filter === 'none' ? statusOf(w) === null : statusOf(w) === filter,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f.key ? 'border-foreground bg-foreground text-background' : 'bg-background text-foreground/70 hover:bg-muted',
            )}
          >
            {f.label}
            {f.key === 'use' ? ` · ${count('use')}` : f.key === 'discard' ? ` · ${count('discard')}` : f.key === 'none' ? ` · ${count(null)}` : ` · ${words.length}`}
          </button>
        ))}
        <StatusText status={action.status?.kind === 'error' ? action.status : null} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((w) => {
          const s = statusOf(w);
          return (
            <li
              key={w.key}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm',
                s === 'use' && 'border-primary/50 bg-primary/5',
                s === 'discard' && 'opacity-50',
              )}
            >
              <span className="min-w-0">
                <span className={cn('font-medium', s === 'discard' && 'line-through')}>{w.word}</span>
                <span className="text-xs text-muted-foreground">
                  {' '}
                  · {SOURCE[w.source]} · {w.inSuggestions + w.inCompetitors}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => mark(w, 'use')}
                  className={cn(
                    'rounded-md border p-1',
                    s === 'use' ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                  aria-pressed={s === 'use'}
                  aria-label={`Usar ${w.word}`}
                  title="Usar"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mark(w, 'discard')}
                  className={cn(
                    'rounded-md border p-1',
                    s === 'discard' ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
                  )}
                  aria-pressed={s === 'discard'}
                  aria-label={`Descartar ${w.word}`}
                  title="Descartar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
