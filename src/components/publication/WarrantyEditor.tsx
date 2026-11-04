'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WARRANTY_TYPE_LABEL, WARRANTY_TYPES, type Warranty, type WarrantyType, type WarrantyUnit } from '@/domain/warranty';
import { saveWarrantyAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { saveAccountWarrantyAction } from '@/app/a/[cuenta]/garantia/actions';
import { cn } from '@/lib/utils/cn';

// Elegir la garantía: el tipo y, si tiene, el tiempo. En una publicación queda
// como borrador para subir; en la cuenta, como la de todas las nuevas.

const UNITS: { value: WarrantyUnit; label: string }[] = [
  { value: 'days', label: 'días' },
  { value: 'months', label: 'meses' },
  { value: 'years', label: 'años' },
];

export function WarrantyEditor({
  accountSlug,
  target,
  initial,
  channelName,
  // Si ya tiene una propia que se puede sacar, para volver a la del canal.
  canClear = false,
  clearLabel,
  onSaved,
}: {
  accountSlug: string;
  target: { kind: 'publication'; publicationId: string } | { kind: 'account' };
  initial: Warranty | null;
  channelName?: string;
  canClear?: boolean;
  // Qué dice el botón de sacarla, si no es el de siempre.
  clearLabel?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<WarrantyType>(initial?.type ?? 'seller');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [unit, setUnit] = useState<WarrantyUnit>(initial?.unit ?? 'days');
  const [pending, setPending] = useState<'save' | 'clear' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const id = target.kind === 'publication' ? `garantia-${target.publicationId}` : 'garantia-cuenta';

  async function run(kind: 'save' | 'clear') {
    const input = kind === 'clear' ? null : { type, amount: type === 'none' ? null : amount.trim() === '' ? null : Number(amount), unit: type === 'none' ? null : unit };
    setPending(kind);
    setMessage(null);
    const r = await (target.kind === 'publication' ? saveWarrantyAction(accountSlug, target.publicationId, input) : saveAccountWarrantyAction(accountSlug, input)).catch(() => null);
    setPending(null);
    if (!r) return setMessage({ ok: false, text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    setMessage({
      ok: true,
      text:
        target.kind === 'account'
          ? 'Guardada. Las publicaciones nuevas se crean con esta garantía. Las que ya están no cambian solas.'
          : kind === 'clear'
            ? `Listo: vuelve a mostrar la garantía que tiene en ${channelName ?? 'el canal'}.`
            : `Guardada. Queda en Por subir para mandarla a ${channelName ?? 'el canal'}.`,
    });
    onSaved?.();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-tipo`}>Tipo</Label>
          <select
            id={`${id}-tipo`}
            value={type}
            onChange={(e) => {
              setType(e.target.value as WarrantyType);
              setMessage(null);
            }}
            className="block h-9 rounded-md border bg-background px-2 text-sm"
          >
            {WARRANTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {WARRANTY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className={cn('flex items-end gap-2', type === 'none' && 'opacity-50')}>
          <div className="space-y-1">
            <Label htmlFor={`${id}-tiempo`}>Tiempo</Label>
            <Input
              id={`${id}-tiempo`}
              inputMode="numeric"
              value={amount}
              disabled={type === 'none'}
              placeholder="15"
              onChange={(e) => {
                setAmount(e.target.value);
                setMessage(null);
              }}
              className="w-20 tabular-nums"
            />
          </div>
          <select
            value={unit}
            disabled={type === 'none'}
            aria-label="Unidad del tiempo"
            onChange={(e) => setUnit(e.target.value as WarrantyUnit)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => run('save')} disabled={pending !== null} pending={pending === 'save'}>
          Guardar la garantía
        </Button>
        {canClear ? (
          <Button size="sm" variant="outline" onClick={() => run('clear')} disabled={pending !== null} pending={pending === 'clear'}>
            {clearLabel ?? (target.kind === 'account' ? 'Sacar la garantía de la cuenta' : `Volver a la de ${channelName ?? 'el canal'}`)}
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className={cn('text-sm', message.ok ? 'text-emerald-700' : 'text-destructive')}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
