'use client';

import { useTransition, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusText } from '@/components/pipeline/StatusText';
import { ChannelStatusBadge } from '@/components/stages/StageBadge';
import { formatPrice } from '@/domain/money';
import type { SaleOptions } from '@/lib/sale-options';
import { setMainOptionAction } from '@/app/a/[cuenta]/publicaciones/sale-option-actions';
import { cn } from '@/lib/utils/cn';

// Las opciones de venta de una medida: la misma medida en varias publicaciones
// del canal, cada una con su forma de cobro y su precio. La principal es la
// que se trabaja en el pipeline; las demás se pueden elegir como principal.

export function SaleOptionsCard({
  accountSlug,
  publicationId,
  channelName,
  data,
}: {
  accountSlug: string;
  publicationId: string;
  channelName: string;
  data: SaleOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function makeMain(mainId: string) {
    setStatus(null);
    startTransition(async () => {
      const r = await setMainOptionAction(accountSlug, publicationId, mainId).catch(() => null);
      if (!r) return setStatus({ kind: 'error', text: 'Se cortó la conexión con la app.' });
      setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-0.5">
        <p className="font-medium">Opciones de venta de esta medida</p>
        <p className="text-xs text-muted-foreground">
          La misma medida en {data.options.length} publicaciones de {channelName}, cada una con su forma de cobro y su precio. La principal es la que se
          trabaja en el pipeline.
        </p>
      </div>
      {data.samePlan.length > 0 ? (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {data.samePlan.map((d) => `${d.codes.join(' y ')} tienen la misma forma de cobro (${d.label}).`).join(' ')} {channelName} apaga una de las dos.
        </p>
      ) : null}
      <ul className="divide-y rounded-md border">
        {data.options.map((o) => (
          <li key={o.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-sm', o.main && 'bg-primary/5')}>
            <span className="inline-flex items-center gap-1.5">
              {o.main ? <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Principal" /> : null}
              {o.id === publicationId ? (
                <span className="font-medium tabular-nums">{o.externalId ?? 'Sin publicar'}</span>
              ) : (
                <Link href={`/a/${accountSlug}/publicaciones/${o.id}`} className="font-medium tabular-nums underline-offset-4 hover:underline">
                  {o.externalId ?? 'Sin publicar'}
                </Link>
              )}
              {o.url ? (
                <a href={o.url} target="_blank" rel="noreferrer" aria-label={`Ver ${o.externalId ?? ''} en ${channelName}`} className="text-primary">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </span>
            <span>{o.planLabel}</span>
            <span className="tabular-nums">
              {o.price === null ? 'Sin precio leído' : formatPrice(o.price)}
              {o.discount ? <span className="text-muted-foreground"> · {o.discount} % de descuento</span> : null}
            </span>
            {o.status !== 'ACTIVE' ? <ChannelStatusBadge status={o.status} /> : null}
            {o.main ? <span className="text-xs font-medium text-primary">Principal</span> : null}
            {!o.main ? (
              <Button size="sm" variant="outline" className="ml-auto" pending={pending} disabled={pending} onClick={() => makeMain(o.id)}>
                Hacer principal
              </Button>
            ) : null}
            {o.statusReason ? <p className="basis-full text-xs text-muted-foreground">{o.statusReason}</p> : null}
          </li>
        ))}
      </ul>
      <StatusText status={status} />
    </Card>
  );
}
