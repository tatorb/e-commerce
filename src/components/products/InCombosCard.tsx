import Link from 'next/link';
import { SectionCard } from '@/components/ui/section-card';

// Los combos de los que forma parte un producto individual.
export function InCombosCard({ accountSlug, combos }: { accountSlug: string; combos: { id: string; name: string; quantity: number }[] }) {
  if (combos.length === 0) return null;
  return (
    <SectionCard
      title="Forma parte de estos combos"
      count={combos.length}
      description="Los combos que llevan este producto. Mientras esté en alguno, no se puede borrar."
    >
      <ul className="divide-y">
        {combos.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <Link href={`/a/${accountSlug}/productos/${c.id}`} className="min-w-0 truncate font-medium hover:underline">
              {c.name}
            </Link>
            <span className="shrink-0 tabular-nums text-muted-foreground">{c.quantity === 1 ? '1 unidad' : `${c.quantity} unidades`}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
