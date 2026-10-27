import { titleLockText } from '@/domain/title-lock';
import type { BoardItem } from '@/lib/queries/pipeline';
import { BoardColumns, type BoardCardData } from './BoardColumns';

// Tablero del pipeline: una columna por paso. En el celular se desliza de
// costado. Las tarjetas se mueven a cualquier paso desde BoardColumns.

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
          },
        ]
      : [],
  );
  return <BoardColumns accountSlug={accountSlug} cards={cards} now={new Date().toISOString()} showStore={showStore} openTasks={openTasks} />;
}
