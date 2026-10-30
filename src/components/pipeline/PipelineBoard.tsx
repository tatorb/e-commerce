'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { matchesSearch } from '@/domain/board-search';
import { titleLockText } from '@/domain/title-lock';
import type { BoardItem } from '@/lib/queries/pipeline';
import { plural } from '@/lib/format';
import { BoardColumns, type BoardCardData } from './BoardColumns';

// Tablero del pipeline: una columna por paso. En el celular se desliza de
// costado. Las tarjetas se mueven a cualquier paso desde BoardColumns. Arriba,
// el buscador: a medida que se escribe quedan solo las tarjetas que coinciden
// por SKU, código del canal, nombre del producto o título.

export function PipelineBoard({
  accountSlug,
  items,
  showStore = false,
  openTasks = {},
}: {
  accountSlug: string;
  items: BoardItem[];
  // La tienda de cada tarjeta, cuando la cuenta tiene más de una.
  showStore?: boolean;
  // Las tareas abiertas de cada publicación, por su id.
  openTasks?: Record<string, number>;
}) {
  const cards: BoardCardData[] = items.flatMap((i) =>
    i.pipelineStep
      ? [
          {
            id: i.id,
            title: i.title,
            externalId: i.externalId,
            code: i.code,
            storeName: i.storeName,
            kind: i.kind,
            score: i.score,
            sales: i.sales,
            stepSince: i.stepSince?.toISOString() ?? null,
            lock: i.titleLock.locked ? titleLockText(i.titleLock) : null,
            step: i.pipelineStep,
            familySize: i.familySize,
            measures: i.measures,
            productName: i.productName,
            skus: i.skus,
            familyCodes: i.familyCodes,
          },
        ]
      : [],
  );
  const [query, setQuery] = useState('');
  const shown = query.trim() ? cards.filter((c) => matchesSearch(c, query)) : cards;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar en el pipeline"
            placeholder="Buscar por SKU, código, producto o título"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 pr-8"
          />
          {query ? (
            <Button type="button" size="icon" variant="ghost" aria-label="Borrar la búsqueda" onClick={() => setQuery('')} className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {query.trim() ? (
          <p className="text-sm text-muted-foreground" role="status">
            {shown.length === 0 ? 'Ninguna coincide.' : `${shown.length} de ${plural(cards.length, 'tarjeta', 'tarjetas')} coinciden.`}
          </p>
        ) : null}
      </div>
      <BoardColumns accountSlug={accountSlug} cards={shown} now={new Date().toISOString()} showStore={showStore} openTasks={openTasks} />
    </div>
  );
}
