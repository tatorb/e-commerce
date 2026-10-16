'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RowList } from '@/components/products/RowList';
import { saveSeedsAction } from '@/app/a/[cuenta]/pipeline/step-actions';
import { useStepAction } from '../useStepAction';
import { StatusText } from '../StatusText';

// Las semillas: lo que se escribe en el buscador del canal para ver qué sugiere.
export function SeedsPanel({
  accountSlug,
  publicationId,
  seeds,
  fromFicha,
  saved,
}: {
  accountSlug: string;
  publicationId: string;
  seeds: string[];
  // Las que arma la app con la ficha.
  fromFicha: string[];
  // Si ya se guardaron alguna vez; si no, son las de la ficha.
  saved: boolean;
}) {
  const [rows, setRows] = useState(seeds.map((text) => ({ text })));
  const action = useStepAction();
  const current = rows.map((r) => r.text);
  const dirty = useMemo(() => JSON.stringify(current) !== JSON.stringify(seeds) || !saved, [current, seeds, saved]);

  return (
    <div className="space-y-3">
      {!saved ? (
        <p className="text-sm text-muted-foreground">
          Las armó la app con la ficha. Agregá, cambiá o borrá las que quieras y guardalas.
        </p>
      ) : null}
      <RowList
        idPrefix="seed"
        rows={rows}
        onChange={(next) => {
          setRows(next);
          action.clear();
        }}
        template={{ text: '' }}
        columns={[{ key: 'text', label: 'Semilla', placeholder: 'subconjunto 405…' }]}
        gridClassName="sm:grid-cols-1"
        addLabel="Agregar semilla"
        emptyLabel="Sin semillas. Completá el tipo de producto y las compatibilidades en Información, o agregalas a mano."
        disabled={action.pending}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => action.run(() => saveSeedsAction(accountSlug, publicationId, current))} disabled={action.pending || !dirty}>
          {action.pending ? 'Guardando…' : 'Guardar semillas'}
        </Button>
        {fromFicha.length > 0 ? (
          <Button
            variant="ghost"
            onClick={() => {
              setRows(fromFicha.map((text) => ({ text })));
              action.clear();
            }}
            disabled={action.pending}
          >
            Volver a armarlas con la ficha
          </Button>
        ) : null}
        <StatusText status={action.status} />
      </div>
    </div>
  );
}
