'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { daysSince, offerPrices } from '@/domain/competitors';
import { formatPercent, formatPrice, parsePercent, parsePrice } from '@/domain/money';
import { cn } from '@/lib/utils/cn';
import { CompetitorsForm, installmentsLabel, type CompetitorRow } from './CompetitorsForm';

// Competencia comprimida: una fila por publicación, con su vendedor, su marca,
// su precio final, cuotas, envío y de cuándo es el precio. Se abre para cargar o editar.
// Sin ninguna cargada, arranca abierta.

const COLUMNS = 'sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem_7rem_8.5rem_6.5rem_8rem_1.75rem] sm:items-center sm:gap-3';

function surveyed(day: string, today: string): string {
  const days = daysSince(day, today);
  const [y, m, d] = day.split('-');
  const date = `${d}/${m}/${y.slice(2)}`;
  return days <= 0 ? `${date}, hoy` : days === 1 ? `${date}, ayer` : `${date}, hace ${days} días`;
}

export function CompetitorsCard({
  accountSlug,
  publicationId,
  initial,
  today,
  shippingCost,
}: {
  accountSlug: string;
  publicationId: string;
  initial: CompetitorRow[];
  today: string;
  shippingCost: number;
}) {
  const [open, setOpen] = useState(initial.length === 0);
  return (
    <SectionCard
      title="Competencia"
      count={initial.length}
      description={`Las publicaciones de otros vendedores que más venden este producto, con su precio. Conviene cargar al menos 3. Sus títulos suman palabras al paso Título y sus precios se comparan en el paso Precio. El precio efectivo suma un envío de ${formatPrice(shippingCost)} si no es gratis.`}
      action={
        initial.length > 0 ? (
          <Button access="view" type="button" size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? 'Cerrar' : 'Editar'}
          </Button>
        ) : null
      }
    >
      {open ? (
        <SectionBody>
          <CompetitorsForm accountSlug={accountSlug} publicationId={publicationId} initial={initial} today={today} shippingCost={shippingCost} />
        </SectionBody>
      ) : (
        <div className="divide-y">
          <div className={cn('hidden px-4 py-1.5 text-xs uppercase tracking-wide text-muted-foreground', COLUMNS)}>
            <span>Publicación</span>
            <span>Marca</span>
            <span className="text-right">Vendidos</span>
            <span className="text-right">Precio final</span>
            <span>Cuotas</span>
            <span>Envío</span>
            <span>Relevado</span>
            <span />
          </div>
          {initial.map((c, i) => {
            const listPrice = parsePrice(c.listPrice);
            const discount = parsePercent(c.discountPct);
            const installments = Number(c.installments);
            const prices =
              typeof listPrice === 'number'
                ? offerPrices({ listPrice, discountPct: typeof discount === 'number' ? discount : 0, installments, freeShipping: c.freeShipping }, shippingCost)
                : null;
            const title = (
              <div className="min-w-0 flex-1">
                <p className="truncate" title={c.title}>
                  {c.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.sellerName || 'Vendedor sin dato'}</p>
              </div>
            );
            const link = c.url ? <OpenLinkButton url={c.url} label={`Abrir ${c.title} en una pestaña nueva`} className="h-7 w-7" /> : <span />;
            const price = prices ? formatPrice(Math.round(prices.finalPrice)) : 'Sin precio';
            const off = prices && typeof discount === 'number' && discount > 0 ? `${formatPercent(discount)} off` : null;
            const cuotas = prices ? (prices.installmentValue === null ? 'Sin cuotas' : `${installmentsLabel(installments)} de ${formatPrice(Math.round(prices.installmentValue))}`) : '—';
            const envio = prices ? (c.freeShipping ? 'Envío gratis' : 'Envío con costo') : '—';
            const fecha = c.surveyedAt ? surveyed(c.surveyedAt, today) : 'Sin fecha';
            return (
              <div key={i} className="px-4 py-2 text-sm">
                {/* En la computadora, una fila con sus columnas. */}
                <div className={cn('hidden', COLUMNS)}>
                  {title}
                  <span className={cn('truncate', c.brand ? 'font-medium' : 'text-xs text-muted-foreground')} title={c.brand || undefined}>
                    {c.brand || 'Sin marca'}
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{c.soldQuantity || '—'}</span>
                  <span className="text-right">
                    <span className={cn('tabular-nums', prices ? 'font-medium' : 'text-muted-foreground')}>{price}</span>
                    {off ? <span className="block text-xs text-muted-foreground">{off}</span> : null}
                  </span>
                  <span className="text-xs">{cuotas}</span>
                  <span className="text-xs">{envio}</span>
                  <span className="text-xs text-muted-foreground">{fecha}</span>
                  {link}
                </div>
                {/* En el celular, el título y abajo lo demás. */}
                <div className="space-y-1 sm:hidden">
                  <div className="flex items-start gap-2">
                    {title}
                    {link}
                  </div>
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className={cn(c.brand && 'font-medium text-foreground')}>{c.brand ? `Marca ${c.brand}` : 'Sin marca'}</span>
                    <span className={cn('tabular-nums', prices && 'font-medium text-foreground')}>
                      {price}
                      {off ? ` (${off})` : ''}
                    </span>
                    <span>{cuotas}</span>
                    <span>{envio}</span>
                    <span>{fecha}</span>
                    <span>{c.soldQuantity ? `${c.soldQuantity} vendidos` : 'Vendidos sin dato'}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
