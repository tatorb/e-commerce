'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { setTypeShortNameAction } from '@/app/a/[cuenta]/tipos-y-marcas/actions';

// Ajustes, Tipos y marcas: el nombre corto de cada tipo de producto, para el
// nombre de los productos. Por ejemplo "Subconjunto" para "Subconjunto (pistones + aros)".

export function TypeShortNameEditor({ accountSlug, types, canWrite }: { accountSlug: string; types: { name: string; shortName: string }[]; canWrite: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(types.map((t) => [t.name, t.shortName])));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function save(type: string) {
    setBusy(type);
    setMessage(null);
    const r = await setTypeShortNameAction(accountSlug, type, values[type] ?? '').catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    setMessage(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
    router.refresh();
  }

  if (types.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay tipos de producto.</p>;

  return (
    <div className="space-y-3">
      {message ? (
        <p role="status" className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')}>
          {message.text}
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {types.map((t) => {
          const changed = (values[t.name] ?? '').trim() !== t.shortName;
          return (
            <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <p className="min-w-0 text-sm font-medium">{t.name}</p>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Nombre corto de ${t.name}`}
                  value={values[t.name] ?? ''}
                  maxLength={100}
                  disabled={!canWrite || busy !== null}
                  placeholder="Sin nombre corto"
                  onChange={(e) => setValues((v) => ({ ...v, [t.name]: e.target.value }))}
                  className="h-8 w-48"
                />
                <Button access="productos" size="sm" variant="outline" disabled={!canWrite || busy !== null || !changed} pending={busy === t.name} onClick={() => save(t.name)}>
                  Guardar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
