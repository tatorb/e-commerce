'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RowList } from '@/components/products/RowList';
import { saveCompetitorsAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// Las publicaciones de la competencia que más venden, cargadas a mano. Conviene
// cargar al menos 3.

export type CompetitorRow = { url: string; title: string; soldQuantity: string };

const MIN = 3;

export function CompetitorsForm({
  accountSlug,
  publicationId,
  initial,
}: {
  accountSlug: string;
  publicationId: string;
  initial: CompetitorRow[];
}) {
  const [rows, setRows] = useState<CompetitorRow[]>(initial.length > 0 ? initial : [{ url: '', title: '', soldQuantity: '' }]);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const action = useStepAction();
  const filled = rows.filter((r) => r.title.trim() || r.url.trim());
  const dirty = useMemo(() => JSON.stringify(filled) !== saved, [filled, saved]);

  return (
    <div className="space-y-3">
      <RowList
        idPrefix="competitor"
        rows={rows}
        onChange={(next) => {
          setRows(next);
          action.clear();
        }}
        template={{ url: '', title: '', soldQuantity: '' }}
        columns={[
          { key: 'url', label: 'Link', placeholder: 'https://articulo.mercadolibre.com.ar/…', inputMode: 'url', openLink: true },
          { key: 'title', label: 'Título', placeholder: 'Como aparece en la publicación' },
          { key: 'soldQuantity', label: 'Vendidos', placeholder: '150', inputMode: 'numeric' },
        ]}
        gridClassName="sm:grid-cols-[1fr_1.4fr_6rem]"
        addLabel="Agregar publicación"
        emptyLabel="Sin publicaciones de la competencia."
        disabled={action.pending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          pending={action.pending}
          onClick={() => action.run(() => saveCompetitorsAction(accountSlug, publicationId, filled), () => setSaved(JSON.stringify(filled)))}
          disabled={action.pending || !dirty}
        >
          {action.pending ? 'Guardando…' : 'Guardar competencia'}
        </Button>
        {filled.length < MIN ? (
          <span className="text-sm text-muted-foreground">
            Conviene cargar al menos {MIN}: {filled.length === 0 ? 'todavía no hay ninguna' : `hay ${filled.length}`}.
          </span>
        ) : null}
        <StatusText status={action.status} />
      </div>
    </div>
  );
}
