import { Package, Tag } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Lo que se está mirando, siempre con la misma seña: el producto con la caja,
// en gris; la publicación con la etiqueta, en el color de su canal.

type Accent = { background: string; foreground: string } | null;

export function EntityLabel({
  kind,
  channelName,
  accent,
  className,
}: {
  kind: 'product' | 'publication';
  channelName?: string;
  accent?: Accent;
  className?: string;
}) {
  const base = 'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-wide';
  if (kind === 'product') {
    return (
      <span className={cn(base, 'bg-muted text-muted-foreground', className)}>
        <Package className="h-3.5 w-3.5" aria-hidden />
        Producto
      </span>
    );
  }
  return (
    <span
      className={cn(base, !accent && 'bg-primary/10 text-primary', className)}
      style={accent ? { backgroundColor: accent.background, color: accent.foreground } : undefined}
    >
      <Tag className="h-3.5 w-3.5" aria-hidden />
      Publicación{channelName ? ` · ${channelName}` : ''}
    </span>
  );
}
