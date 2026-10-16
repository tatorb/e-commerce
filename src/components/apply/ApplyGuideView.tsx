'use client';

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ApplySection } from '@/channels';
import { cn } from '@/lib/utils/cn';
import { markAppliedAction } from '@/app/a/[cuenta]/publicaciones/apply-actions';
import { CopyButton } from './CopyButton';

// La guía para pasar a mano lo aprobado al canal: los datos en el orden del
// canal, con botones de copiar, tildes para lo que se elige de listas y, al
// final, "Marcar como aplicada".

// Las tildes quedan en este navegador: son una ayuda mientras se carga. Si
// el navegador no deja guardar, duran lo que la página abierta.
const memory = new Map<string, string>();
const CHANGE_EVENT = 'aplicar:tildes';

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? '{}';
  } catch {
    return memory.get(key) ?? '{}';
  }
}

function writeStored(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Queda solo en memoria.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function useStoredChecks(key: string) {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);
  const raw = useSyncExternalStore(subscribe, () => readStored(key), () => '{}');
  return useMemo((): Record<string, boolean> => {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [raw]);
}

function ChangedBadge() {
  return (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      Cambió
    </span>
  );
}

export function ApplyGuideView({
  accountSlug,
  publicationId,
  productUrl,
  sections,
  canMark,
  today,
  minDay,
}: {
  accountSlug: string;
  publicationId: string;
  productUrl: string;
  sections: ApplySection[];
  // Si se puede marcar como aplicada: la publicación está aprobada.
  canMark: boolean;
  today: string;
  minDay: string;
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(!canMark);
  const [day, setDay] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const storageKey = `aplicar:${publicationId}`;
  const checked = useStoredChecks(storageKey);

  function toggle(key: string, value: boolean) {
    writeStored(storageKey, JSON.stringify({ ...checked, [key]: value }));
  }

  function mark() {
    setError(null);
    startTransition(async () => {
      const r = await markAppliedAction(accountSlug, publicationId, day);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      writeStored(storageKey, null);
      router.push(productUrl);
    });
  }

  const visible = sections
    .map((s) => ({ ...s, items: showAll ? s.items : s.items.filter((i) => i.changed) }))
    .filter((s) => s.items.length > 0);
  const changedCount = sections.reduce((n, s) => n + s.items.filter((i) => i.changed).length, 0);

  return (
    <div className="space-y-4">
      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
        Mostrar también lo que no cambió
      </label>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {changedCount === 0
            ? 'La revisión aprobada no cambió nada que haya que pasar al canal. Igual podés marcarla como aplicada.'
            : 'No hay datos para mostrar.'}
        </p>
      ) : null}

      {visible.map((section) => (
        <section key={section.key} className="rounded-md border bg-background">
          <div className="space-y-0.5 border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">{section.title}</h2>
            {section.hint ? <p className="text-xs text-muted-foreground">{section.hint}</p> : null}
          </div>
          <ul className="divide-y">
            {section.items.map((item, i) => {
              const key = `${section.key}:${i}`;
              if (item.kind === 'check') {
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                        checked={Boolean(checked[key])}
                        onChange={(e) => toggle(key, e.target.checked)}
                      />
                      <span className={cn(checked[key] && 'text-muted-foreground line-through')}>{item.label}</span>
                    </label>
                    {item.changed ? <ChangedBadge /> : null}
                  </li>
                );
              }
              return (
                <li key={key} className="space-y-1.5 px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</span>
                    {item.changed ? <ChangedBadge /> : null}
                    <div className="ml-auto">
                      {item.kind === 'copy' ? <CopyButton value={item.value} label={item.label} /> : null}
                    </div>
                  </div>
                  {item.value ? (
                    <p className={cn('break-words', item.multiline && 'whitespace-pre-wrap')}>{item.value}</p>
                  ) : (
                    <p className="text-muted-foreground">Sin dato en la ficha.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {canMark ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="applied-day">Quedó aplicada el</Label>
              <Input
                id="applied-day"
                type="date"
                value={day}
                min={minDay}
                max={today}
                onChange={(e) => setDay(e.target.value)}
                className="w-44"
                disabled={pending}
              />
            </div>
            <Button type="button" onClick={mark} disabled={pending || !day}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Marcar como aplicada
            </Button>
            {error ? <span className="text-sm text-destructive">{error}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
