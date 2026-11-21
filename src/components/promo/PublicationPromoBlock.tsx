import Link from 'next/link';
import { BadgePercent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { formatPrice } from '@/domain/money';
import { LAYER_LABEL } from '@/domain/promo/plan';
import { OBJECTIVE_LABEL, tagsText } from '@/domain/promo/tags';
import type { PromoPanelData } from '@/lib/promo/panel';
import { cn } from '@/lib/utils/cn';
import { dateTime, pct, shortDate, stateClass } from './format';

// El bloque Promociones de la página de una publicación: las etiquetas de su
// producto, las ofertas en las que está esta forma de cobro y su almanaque:
// en cada franja, si entra, a qué precio y con qué rentabilidad, o por qué
// queda afuera. Solo muestra: se trabaja en Promociones.

export function PublicationPromoBlock({ accountSlug, timeZone, publicationId, data }: { accountSlug: string; timeZone: string; publicationId: string; data: PromoPanelData }) {
  const { grid } = data;
  const option = grid.measures.flatMap((m) => m.options.map((o) => ({ ...o, measure: m.measure }))).find((o) => o.publicationId === publicationId);
  if (!option) return null;
  const rows = grid.columns.flatMap((c) => {
    const cell = c.cells.find((x) => x.publicationId === publicationId);
    return cell ? [{ column: c, cell }] : [];
  });
  const tags = tagsText(grid.tags);
  const log = data.log.filter((l) => l.code === option.externalId).slice(0, 8);
  return (
    <SectionCard
      title="Promociones"
      icon={<BadgePercent />}
      count={rows.length}
      description={`Las etiquetas son del producto. Las franjas, de esta forma de cobro: ${option.planLabel.toLowerCase()}${option.measure ? `, medida ${option.measure}` : ''}. Saludable ${pct(grid.thresholds.healthyMarginPct)}, piso ${pct(grid.thresholds.floorMarginPct)}.`}
      action={
        <Link href={`/a/${accountSlug}/promociones/${grid.productId}`} className="text-sm font-medium underline-offset-4 hover:underline">
          Abrir en Promociones
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-3 text-sm">
        {tags.length > 0 ? (
          tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">Sin etiquetas</Badge>
        )}
        <span className="text-muted-foreground">
          {grid.objective ? `Objetivo: ${OBJECTIVE_LABEL[grid.objective]}.` : 'Sin ciclo de vida todavía no tiene almanaque.'} Hoy deja {pct(option.marginNow)}
          {option.discountNow ? ` con ${pct(option.discountNow)} de descuento propio` : ''}.
        </span>
        {option.excluded ? <Badge variant="alert">Prohibida en todas las ofertas{option.excludedWhy ? `: ${option.excludedWhy}` : ''}</Badge> : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">No tiene franjas ni invitaciones del canal. Las publicaciones nuevas o recreadas no reciben invitaciones a los eventos.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map(({ column: c, cell }) => (
            <li key={c.slotId ?? c.group} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5', c.cancelled && 'opacity-60')}>
              <Badge variant={c.layer === 'BASE' ? 'secondary' : c.layer === 'PEAK' ? 'outline' : 'default'}>{LAYER_LABEL[c.layer]}</Badge>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {shortDate(c.start, timeZone)} a {shortDate(c.finish, timeZone)}
                  {c.source === 'CHANNEL' ? ' · del canal, sin franja' : c.source === 'MANUAL' ? ' · a mano' : ''}
                  {c.cancelled ? ' · no va' : ''}
                </span>
                {cell.text ? <span className="block text-xs text-muted-foreground">{cell.text}</span> : null}
              </span>
              <span className={cn('rounded-md border px-2 py-1 text-xs', stateClass(cell.state, cell.capped))}>
                <span className="font-semibold">{cell.label}</span>
                {cell.price !== null && cell.state !== 'OUT' ? ` · ${formatPrice(cell.price)}` : ''}
                {cell.marginPct !== null ? ` · deja ${pct(cell.marginPct)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {log.length > 0 ? (
        <ul className="divide-y border-t text-xs text-muted-foreground">
          {log.map((l) => (
            <li key={l.id} className="flex gap-3 px-4 py-1.5">
              <span className="w-28 shrink-0">{dateTime(l.at, timeZone)}</span>
              <span className="min-w-0 flex-1 text-foreground">{l.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
