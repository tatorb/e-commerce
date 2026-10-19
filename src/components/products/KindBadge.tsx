import type { ProductKind } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';

/** La etiqueta "Combo". Los individuales no llevan etiqueta. */
export function KindBadge({ kind, className }: { kind: ProductKind; className?: string }) {
  if (kind !== 'COMBO') return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium leading-none text-primary',
        className,
      )}
    >
      Combo
    </span>
  );
}
