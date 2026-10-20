import { PIPELINE_EXIT_LABEL, PIPELINE_REMOVAL_LABEL, PIPELINE_STEP_LABEL } from '@/domain/pipeline';
import type { PipelineExit, PipelineRemoval, PipelineStep } from '@/generated/prisma/enums';
import { formatDateTime, formatDuration } from '@/lib/format';

// Cuánto estuvo una publicación en cada paso, quién la movió y por qué salió.

type Movement = {
  id: string;
  step: PipelineStep;
  enteredAt: Date;
  exitedAt: Date | null;
  exitKind: PipelineExit | null;
  removal: PipelineRemoval | null;
  exitedBy: { name: string } | null;
};

function exitText(m: Movement): string {
  if (!m.exitedAt || !m.exitKind) return 'Paso actual';
  const base = PIPELINE_EXIT_LABEL[m.exitKind];
  const reason = m.exitKind === 'REMOVED' && m.removal ? `, ${PIPELINE_REMOVAL_LABEL[m.removal].toLowerCase()}` : '';
  return `${base}${reason}${m.exitedBy ? ` · ${m.exitedBy.name}` : ''}`;
}

export function PipelineHistory({ movements, timeZone }: { movements: Movement[]; timeZone: string }) {
  const now = new Date();
  return (
    <ul className="divide-y">
      {movements.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="w-44 shrink-0 font-medium">{PIPELINE_STEP_LABEL[m.step]}</span>
          <span className="tabular-nums text-muted-foreground">
            {formatDateTime(m.enteredAt, timeZone)}
            {' → '}
            {m.exitedAt ? formatDateTime(m.exitedAt, timeZone) : 'ahora'}
          </span>
          <span className="tabular-nums text-muted-foreground">{formatDuration(m.enteredAt, m.exitedAt ?? now)}</span>
          <span className="text-muted-foreground sm:ml-auto">{exitText(m)}</span>
        </li>
      ))}
    </ul>
  );
}
