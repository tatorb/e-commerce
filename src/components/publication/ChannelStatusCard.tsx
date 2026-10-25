'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { CHANNEL_STATUS_LABEL, STATUS_ACTIONS, statusActions, statusConfirm, statusHelp, type StatusAction } from '@/domain/channel-status';
import type { ChannelStatus } from '@/generated/prisma/enums';
import type { RelistInfo } from '@/lib/channel-status';
import { cn } from '@/lib/utils/cn';
import { changeStatusAction, relistAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

const ICON: Record<StatusAction, typeof Pause> = { pause: Pause, activate: Play, close: Square, delete: Archive, relist: RotateCcw };

// El estado de la publicación en el canal y lo que se puede hacer con él:
// pausar, reactivar, finalizar, eliminar o republicar.
export function ChannelStatusCard({
  accountSlug,
  publicationId,
  status,
  channelName,
  relist,
}: {
  accountSlug: string;
  publicationId: string;
  status: ChannelStatus;
  channelName: string;
  // Lo que hace falta para republicar, si se puede.
  relist: RelistInfo | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<StatusAction | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [relisting, setRelisting] = useState(false);
  const [price, setPrice] = useState(relist?.price !== null && relist?.price !== undefined ? String(relist.price) : '');
  const [quantity, setQuantity] = useState('1');
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries((relist?.measures ?? []).map((m) => [m.key, '1'])));
  const [listingType, setListingType] = useState(relist?.listingTypes[0]?.value ?? '');
  const actions = statusActions(status);

  // Lo que pide republicar llega cuando la publicación queda finalizada: se completa al abrir.
  function toggleRelist() {
    if (!relisting && relist) {
      if (!price.trim() && relist.price !== null) setPrice(String(relist.price));
      if (!relist.listingTypes.some((t) => t.value === listingType)) setListingType(relist.listingTypes[0]?.value ?? '');
      setQuantities((q) => Object.fromEntries(relist.measures.map((m) => [m.key, q[m.key] ?? '1'])));
    }
    setRelisting((v) => !v);
  }

  async function change(action: Exclude<StatusAction, 'relist'>) {
    const confirm = statusConfirm(action, channelName);
    if (confirm && !window.confirm(confirm)) return;
    setBusy(action);
    setMessage(null);
    const r = await changeStatusAction(accountSlug, [publicationId], action).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: `Se cortó la conexión con la app. Fijate en ${channelName} si cambió.` });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    if (r.failed.length > 0) return setMessage({ kind: 'error', text: r.failed[0].message });
    setMessage({ kind: 'ok', text: `Listo, quedó ${STATUS_ACTIONS[action].done} en ${channelName}.` });
    router.refresh();
  }

  async function republish() {
    setBusy('relist');
    setMessage(null);
    const measures = relist?.measures ?? [];
    const amounts = measures.length > 0 ? { quantities: Object.fromEntries(measures.map((m) => [m.key, quantities[m.key] ?? ''])) } : { quantity };
    const r = await relistAction(accountSlug, publicationId, { price: price.replace(',', '.'), ...amounts, listingType }).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: `Se cortó la conexión con la app. Antes de probar de nuevo, fijate en ${channelName} si se republicó.` });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setRelisting(false);
    setMessage({ kind: 'ok', text: `Listo, se republicó con el código ${r.externalId}.${r.warnings.length > 0 ? ` ${r.warnings.join(' ')}` : ''}` });
    router.refresh();
  }

  const measures = relist?.measures ?? [];
  const missingQuantity = measures.length > 0 ? measures.some((m) => !quantities[m.key]?.trim()) : !quantity.trim();

  return (
    <SectionCard title={`Estado en ${channelName}`} description={`${CHANNEL_STATUS_LABEL[status]}. ${statusHelp(status, channelName)}`}>
      <SectionBody className="space-y-3">
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const Icon = ICON[a];
              return (
                <Button access="subir"
                  key={a}
                  size="sm"
                  variant={a === 'delete' ? 'destructive' : 'outline'}
                  pending={busy === a}
                  disabled={busy !== null || (a === 'relist' && (!relist || relist.blocked !== null))}
                  onClick={() => (a === 'relist' ? toggleRelist() : change(a))}
                >
                  <Icon />
                  {STATUS_ACTIONS[a].label}
                </Button>
              );
            })}
          </div>
        ) : null}

        {relisting && relist ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              {channelName} crea una publicación nueva con los mismos datos y otro código. En la app sigue siendo esta, con el código nuevo.
            </p>
            <div className={cn('grid gap-3', measures.length > 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              <div className="space-y-1.5">
                <Label htmlFor="relist-price">Precio</Label>
                <Input id="relist-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              {measures.length === 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="relist-quantity">Cantidad disponible</Label>
                  <Input id="relist-quantity" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="relist-type">Tipo de publicación</Label>
                <select id="relist-type" className={SELECT_CLASS} value={listingType} onChange={(e) => setListingType(e.target.value)}>
                  {relist.listingTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {measures.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Cantidad disponible de cada medida</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {measures.map((m, i) => (
                    <div key={m.key} className="space-y-1.5">
                      <Label htmlFor={`relist-quantity-${i}`}>{m.label}</Label>
                      <Input
                        id={`relist-quantity-${i}`}
                        inputMode="numeric"
                        value={quantities[m.key] ?? ''}
                        onChange={(e) => setQuantities((q) => ({ ...q, [m.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <Button access="subir" size="sm" onClick={republish} pending={busy === 'relist'} disabled={busy !== null || !price.trim() || missingQuantity}>
              <RotateCcw />
              Republicar en {channelName}
            </Button>
          </div>
        ) : null}

        {relist?.blocked && actions.includes('relist') ? <p className="text-xs text-muted-foreground">{relist.blocked}</p> : null}
        {message ? (
          <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
            {message.text}
          </p>
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
