import { Bot, Ruler } from 'lucide-react';
import { ChannelStatusBadge } from '@/components/stages/StageBadge';
import { measuresText, type PublicationFacts } from '@/lib/publication-facts';
import { cn } from '@/lib/utils/cn';

// El código del producto, su estado en el canal, sus medidas y la respuesta
// automática, en una fila: va arriba de la publicación, en su tarjeta del
// producto y en el Pipeline. Sin las medidas, cuando van aparte en una franja.
export function PublicationFactsRow({
  facts,
  hideMeasures,
  hideStatus,
  measuresLabel,
  className,
}: {
  facts: PublicationFacts;
  hideMeasures?: boolean;
  hideStatus?: boolean;
  // Otras palabras para las medidas, por ejemplo las de toda la familia en el Pipeline.
  measuresLabel?: string;
  className?: string;
}) {
  const chip = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5';
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}>
      {facts.code ? (
        <span title="Código del producto" className={cn(chip, 'bg-background font-semibold tracking-wide text-foreground')}>
          {facts.code}
        </span>
      ) : null}
      {hideStatus ? null : <ChannelStatusBadge status={facts.status} />}
      {hideMeasures ? null : (
        <span className={cn(chip, 'text-muted-foreground')}>
          <Ruler className="h-3 w-3" aria-hidden />
          {measuresLabel ?? measuresText(facts.measures)}
        </span>
      )}
      <span
        className={cn(chip, facts.autoAnswer ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground')}
        title="Si Claude manda solo las respuestas de las que está seguro. Se cambia en el paso Preguntas y respuestas."
      >
        <Bot className="h-3 w-3" aria-hidden />
        Respuesta automática {facts.autoAnswer ? 'prendida' : 'apagada'}
      </span>
    </div>
  );
}
