import { Bot, Ruler } from 'lucide-react';
import { measuresText, type PublicationFacts } from '@/lib/publication-facts';
import { cn } from '@/lib/utils/cn';

// El código del producto, sus medidas y la respuesta automática, en una fila:
// va arriba de la publicación, en su tarjeta del producto y en el Pipeline.
export function PublicationFactsRow({ facts, className }: { facts: PublicationFacts; className?: string }) {
  const chip = 'inline-flex items-center gap-1 rounded-md border px-2 py-0.5';
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}>
      {facts.code ? (
        <span title="Código del producto" className={cn(chip, 'bg-background font-semibold tracking-wide text-foreground')}>
          {facts.code}
        </span>
      ) : null}
      <span className={cn(chip, 'text-muted-foreground')}>
        <Ruler className="h-3 w-3" aria-hidden />
        {measuresText(facts.measures)}
      </span>
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
