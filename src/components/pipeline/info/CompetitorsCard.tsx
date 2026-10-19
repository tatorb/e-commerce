'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { CompetitorsForm, type CompetitorRow } from './CompetitorsForm';

// Competencia comprimida: una línea por publicación, con su link. Se abre para
// cargar o editar. Sin ninguna cargada, arranca abierta.
export function CompetitorsCard({
  accountSlug,
  publicationId,
  initial,
}: {
  accountSlug: string;
  publicationId: string;
  initial: CompetitorRow[];
}) {
  const [open, setOpen] = useState(initial.length === 0);
  return (
    <SectionCard
      title="Competencia"
      count={initial.length}
      description="Las publicaciones de otros vendedores que más venden este producto. Conviene cargar al menos 3. Sus títulos suman palabras al paso Título."
      action={
        initial.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? 'Cerrar' : 'Editar'}
          </Button>
        ) : null
      }
    >
      {open ? (
        <SectionBody>
          <CompetitorsForm accountSlug={accountSlug} publicationId={publicationId} initial={initial} />
        </SectionBody>
      ) : (
        <ul className="divide-y">
          {initial.map((c, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate" title={c.title}>
                {c.title}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {c.soldQuantity ? `${c.soldQuantity} vendidos` : 'Vendidos sin dato'}
              </span>
              {c.url ? <OpenLinkButton url={c.url} label={`Abrir ${c.title} en una pestaña nueva`} className="h-7 w-7" /> : <span className="w-7" />}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
