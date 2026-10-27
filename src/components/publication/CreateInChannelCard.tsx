'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { CreateInfo } from '@/lib/channel-create';
import { formatPrice } from '@/domain/money';
import { cn } from '@/lib/utils/cn';
import { createInChannelAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

// Crear en el canal una publicación que todavía no está publicada: qué está
// listo, qué falta, y lo que pide el canal al crearla (precio, cantidad y tipo).
// Con varias medidas se crea una por medida, en la misma familia: la cantidad
// se carga en cada una y el precio es el de la familia, salvo la que tiene el suyo.

const names = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`);
export function CreateInChannelCard({ accountSlug, publicationId, info }: { accountSlug: string; publicationId: string; info: CreateInfo }) {
  const router = useRouter();
  const [price, setPrice] = useState(info.price !== null ? String(info.price) : '');
  // Si el producto lleva stock en la app, arranca con ese.
  const [quantity, setQuantity] = useState(info.stock?.quantity != null ? String(info.stock.quantity) : '1');
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(info.measures.map((m) => [m.key, info.stock?.quantities[m.key] != null ? String(info.stock.quantities[m.key]) : '1'])),
  );
  const [listingType, setListingType] = useState(info.listingTypes[0]?.value ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const { channelName } = info;
  const byMeasure = info.measures.length > 0;
  const several = info.measures.length >= 2;
  const missingQuantity = byMeasure ? info.measures.some((m) => !quantities[m.key]?.trim()) : !quantity.trim();

  async function create() {
    const ask = several
      ? `¿Crear las ${info.measures.length} publicaciones en ${channelName}, una por medida? Quedan publicadas y a la venta.`
      : `¿Crear la publicación en ${channelName}? Queda publicada y a la venta.`;
    if (!window.confirm(ask)) return;
    setBusy(true);
    setMessage(null);
    const amounts = byMeasure ? { quantities: Object.fromEntries(info.measures.map((m) => [m.key, quantities[m.key] ?? ''])) } : { quantity };
    const r = await createInChannelAction(accountSlug, publicationId, { price: price.replace(',', '.'), ...amounts, listingType }).catch(() => null);
    setBusy(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Antes de probar de nuevo, fijate en el canal si se creó.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    const done =
      r.created.length > 0
        ? `Listo: se ${r.created.length === 1 ? 'creó' : 'crearon'} en ${channelName} ${names(r.created.map((c) => `${c.label} con el código ${c.externalId}`))}.`
        : `Listo: se creó en ${channelName} con el código ${r.externalId}.`;
    setMessage({ kind: 'ok', text: `${done}${r.warnings.length > 0 ? ` ${r.warnings.join(' ')}` : ''}` });
    router.refresh();
  }

  return (
    <SectionCard
      title={`Crear en ${channelName}`}
      description={
        byMeasure
          ? `La app crea en ${channelName} una publicación por medida, en la misma familia, con el título, la descripción, la categoría y los datos de catálogo de la familia, y las fotos de cada medida. El precio y la cantidad se cargan acá; después se manejan en ${channelName}.`
          : `Todavía no está publicada. La app la crea en ${channelName} con su título, descripción, categoría, datos de catálogo y fotos. El precio y la cantidad se cargan acá; después se manejan en ${channelName}.`
      }
    >
      <SectionBody className="space-y-4">
        {info.blocked ? <p className="text-sm text-muted-foreground">{info.blocked}</p> : null}
        <ul className="space-y-1.5 text-sm">
          {info.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              {c.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Listo" />
              ) : (
                <X className={cn('mt-0.5 h-4 w-4 shrink-0', c.blocking ? 'text-destructive' : 'text-muted-foreground')} aria-label="Falta" />
              )}
              <span>
                <span className="font-medium">{c.label}:</span> <span className={cn(!c.ok && c.blocking && 'text-destructive')}>{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        {!info.blocked ? (
          <div className={cn('grid gap-3', byMeasure ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
            <div className="space-y-1.5">
              <Label htmlFor="create-price">{byMeasure ? 'Precio de la familia' : 'Precio'}</Label>
              <Input id="create-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Por ejemplo 45000" />
            </div>
            {!byMeasure ? (
              <div className="space-y-1.5">
                <Label htmlFor="create-quantity">Cantidad disponible</Label>
                <Input id="create-quantity" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="create-type">Tipo de publicación</Label>
              <select id="create-type" className={SELECT_CLASS} value={listingType} onChange={(e) => setListingType(e.target.value)}>
                {info.listingTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {!info.blocked && byMeasure ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Cantidad disponible de cada medida</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {info.measures.map((m, i) => (
                <div key={m.key} className="space-y-1.5">
                  <Label htmlFor={`create-quantity-${i}`}>{m.label}</Label>
                  <Input
                    id={`create-quantity-${i}`}
                    inputMode="numeric"
                    value={quantities[m.key] ?? ''}
                    onChange={(e) => setQuantities((q) => ({ ...q, [m.key]: e.target.value }))}
                  />
                  {m.price !== null ? <p className="text-xs text-muted-foreground">Con su precio, {formatPrice(m.price)}</p> : null}
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        {!info.blocked && info.published.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Ya {info.published.length === 1 ? 'está publicada' : 'están publicadas'} {names(info.published.map((x) => `${x.label}, ${x.externalId}`))}.
          </p>
        ) : null}

        {!info.blocked && info.stock ? (
          <p className="text-xs text-muted-foreground">La cantidad arranca con el stock del producto. Después de crearla, la app la mantiene con cada venta.</p>
        ) : null}

        {!info.blocked ? (
          <Button access="subir" onClick={create} disabled={!info.ready || busy || !price.trim() || missingQuantity} pending={busy}>
            <Upload />
            {several ? `Crear las ${info.measures.length} en ${channelName}` : `Crear en ${channelName}`}
          </Button>
        ) : null}
        {!info.ready && !info.blocked ? <p className="text-xs text-muted-foreground">Completá lo que falta para poder crearla.</p> : null}
        {message ? (
          <p className={cn('text-sm', message.kind === 'error' ? 'text-destructive' : 'text-foreground')} role="status">
            {message.text}
          </p>
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
