'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { QuantityLine } from '@/domain/quantities';
import { saveQuantitiesAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { cn } from '@/lib/utils/cn';

// Cambiar la cantidad disponible de una publicación, o la de cada medida. Queda
// como borrador: se sube desde Por subir, igual que el precio.

export function QuantityEditor({
  accountSlug,
  publicationId,
  lines,
  channelLines,
  channelName,
  onSaved,
}: {
  accountSlug: string;
  publicationId: string;
  // Lo que tiene la app, o lo del canal si no se cambió.
  lines: QuantityLine[];
  // Lo que se leyó del canal, para mostrarlo al lado.
  channelLines: QuantityLine[] | null;
  channelName: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const start = Object.fromEntries(lines.map((l) => [l.key, String(l.quantity)]));
  const [values, setValues] = useState<Record<string, string>>(start);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const changed = lines.some((l) => values[l.key]?.trim() !== String(l.quantity));
  const single = lines.length === 1 && lines[0].key === '';
  const inChannel = new Map((channelLines ?? []).map((l) => [l.key, l.quantity]));

  async function save() {
    const byKey: Record<string, number> = {};
    for (const l of lines) {
      const raw = values[l.key]?.trim() ?? '';
      if (!/^\d+$/.test(raw)) return setMessage({ kind: 'error', text: 'La cantidad tiene que ser un número entero, 0 o más.' });
      byKey[l.key] = Number(raw);
    }
    setPending(true);
    setMessage(null);
    const r = await saveQuantitiesAction(accountSlug, [publicationId], { byKey }).catch(() => null);
    setPending(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    if (r.skipped.length > 0) return setMessage({ kind: 'error', text: r.skipped[0].reason });
    setMessage({ kind: 'ok', text: `Guardado. Queda en Por subir para mandarlo a ${channelName}.` });
    onSaved?.();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className={cn('grid gap-3', single ? 'max-w-48' : 'grid-cols-2 sm:grid-cols-3')}>
        {lines.map((l, i) => {
          const id = `quantity-${publicationId}-${i}`;
          const now = inChannel.get(l.key);
          return (
            <div key={l.key} className="space-y-1">
              <Label htmlFor={id}>{single ? 'Cantidad disponible' : l.label || 'Sin medida'}</Label>
              <Input
                id={id}
                inputMode="numeric"
                value={values[l.key] ?? ''}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [l.key]: e.target.value }));
                  setMessage(null);
                }}
                className="tabular-nums"
              />
              {now !== undefined && String(now) !== values[l.key]?.trim() ? (
                <p className="text-xs text-muted-foreground">
                  En {channelName}: {now}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={save} pending={pending} disabled={pending || !changed}>
          Guardar cantidad
        </Button>
        {message ? (
          <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
