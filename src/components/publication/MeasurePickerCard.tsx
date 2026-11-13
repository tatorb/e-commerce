'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { choosePublicationMeasureAction } from '@/app/a/[cuenta]/pipeline/measure-actions';
import type { MeasureChoice } from '@/lib/publication-measure';
import { cn } from '@/lib/utils/cn';

// La medida que vende una publicación publicada sola, cuando su SKU en el
// canal no dice cuál es. Se elige una vez para todas sus opciones de venta.
// Antes de guardar dice qué cantidad va a quedar en el canal, porque si sigue
// al stock se sube al guardar.

const skuOf = (sku: string | null) => (sku ?? '').trim().toUpperCase();

/** Si hay algo para mostrar: sin medida, o con un SKU en el canal que no es el de su medida. */
export function measurePickerNeeded(choice: MeasureChoice | null): boolean {
  if (!choice) return false;
  if (choice.unknown) return true;
  const sku = choice.current?.sku;
  return Boolean(sku && choice.options.some((o) => o.skuToPush || (o.externalId && skuOf(o.channelSku) !== skuOf(sku))));
}

export function MeasurePickerCard({ accountSlug, publicationId, choice }: { accountSlug: string; publicationId: string; choice: MeasureChoice }) {
  const router = useRouter();
  const free = choice.measures.filter((m) => !m.takenBy);
  const [key, setKey] = useState(choice.current?.key ?? (free.length === 1 ? free[0].key : ''));
  const [sendSku, setSendSku] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const picked = choice.measures.find((m) => m.key === key) ?? null;
  const n = choice.options.length;
  const channelSku = choice.options[0]?.channelSku ?? null;
  const pendingSku = choice.options.find((o) => o.skuToPush)?.skuToPush ?? null;
  const wrongSku = picked?.sku ? choice.options.filter((o) => o.externalId && skuOf(o.channelSku) !== skuOf(picked.sku)).length : 0;
  const changes = picked?.quantities.filter((q) => q.from !== q.to) ?? [];

  const save = () =>
    start(async () => {
      setMsg(null);
      if (!picked) return setMsg({ ok: false, text: 'Elegí la medida.' });
      const r = await choosePublicationMeasureAction(accountSlug, publicationId, picked.key, sendSku && wrongSku > 0).catch(() => null);
      if (!r) return setMsg({ ok: false, text: 'Se cortó la conexión con la app.' });
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  const known = !choice.unknown && choice.current;
  return (
    <SectionCard
      id="medida"
      title="Medida"
      icon={<Ruler />}
      description={`La medida de la ficha que vende esta publicación${n > 1 ? ` y sus ${n - 1} otras opciones de venta` : ''}. De ahí sale su cantidad, su costo y su lugar en la familia.`}
    >
      <SectionBody className="space-y-3 text-sm">
        {known ? (
          <p>
            Vende la medida <span className="font-medium">{choice.current!.label}</span>
            {channelSku ? (
              <>
                , y en {choice.channelName} tiene el SKU <span className="font-medium">{channelSku}</span>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="text-amber-700 dark:text-amber-400">
            La app no sabe qué medida vende
            {channelSku ? `: su SKU en ${choice.channelName} es ${channelSku}, sin la medida` : ''}. Elegila de la ficha.
          </p>
        )}
        {pendingSku ? <p className="text-muted-foreground">El SKU {pendingSku} está en Por subir: se manda a {choice.channelName} desde ahí.</p> : null}

        {!known ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Medida">
            {choice.measures.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={key === m.key}
                disabled={Boolean(m.takenBy) || pending}
                onClick={() => setKey(m.key)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50',
                  key === m.key ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className="block font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.takenBy ? `Ya la vende ${m.takenBy}` : (m.sku ?? 'Sin SKU')}</span>
              </button>
            ))}
          </div>
        ) : null}

        {picked && !known ? (
          <p className="text-muted-foreground">
            {changes.length > 0
              ? `Al guardar, la cantidad en ${choice.channelName} pasa a salir del stock de ${picked.label}: ${changes
                  .map((c) => `${c.externalId ?? 'sin código'} de ${c.from ?? '?'} a ${c.to}`)
                  .join(', ')}. Se sube al guardar.`
              : picked.quantityNote
                ? `La cantidad no cambia sola: ${picked.quantityNote}`
                : `La cantidad en ${choice.channelName} ya es la del stock de ${picked.label}: no cambia.`}
          </p>
        ) : null}

        {picked?.sku && wrongSku > 0 ? (
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={sendSku} onChange={(e) => setSendSku(e.target.checked)} disabled={pending} />
            <span>
              Dejar el SKU <span className="font-medium">{picked.sku}</span> en Por subir para {wrongSku === 1 ? 'mandarlo' : `las ${wrongSku} opciones de venta`} a {choice.channelName}. Se manda
              recién cuando lo subas desde ahí.
            </span>
          </label>
        ) : null}

        {!known || (wrongSku > 0 && !pendingSku) ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={save} pending={pending} disabled={pending || !picked || (Boolean(known) && !sendSku)}>
              {known ? 'Dejar el SKU en Por subir' : 'Guardar medida'}
            </Button>
          </div>
        ) : null}
        {msg ? <p className={msg.ok ? 'text-foreground' : 'text-destructive'}>{msg.text}</p> : null}
      </SectionBody>
    </SectionCard>
  );
}
