'use client';

import { useState, type ComponentProps } from 'react';
import { OptionTableCard } from './OptionTableCard';
import { PriceStep } from './PriceStep';

// El paso Precio con la tabla por modo de compra arriba: la fila que se elige
// en la tabla es la publicación que muestran el simulador, el resultado, las
// promociones, la ganancia, el precio final y los costos de abajo. Cada fila
// es una publicación del canal (una medida en una forma de cobro); las formas
// de cobro que la medida no tiene también se pueden elegir, para simular.

/** Lo que se ve abajo: una publicación, o una forma de cobro que la medida todavía no tiene. */
export type PriceSelection = { id: string } | { missing: { mainId: string; plan: number } };

export const selectionKey = (s: PriceSelection | null) => (!s ? '' : 'id' in s ? s.id : `${s.missing.mainId}:${s.missing.plan}`);

export function PriceWorkspace(props: ComponentProps<typeof PriceStep>) {
  // Arranca en la principal de la primera pestaña: la sin cuotas, la que se trabaja en el pipeline.
  const [selected, setSelected] = useState<PriceSelection | null>({ id: props.data.groups[0].anchorId });
  return (
    <>
      <OptionTableCard accountSlug={props.accountSlug} publicationId={props.data.publicationId} selected={selected} onSelect={setSelected} />
      <PriceStep {...props} selected={selected} onSelect={setSelected} />
    </>
  );
}
