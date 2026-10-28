import { cn } from '@/lib/utils/cn';
import type { ChannelStatus, ImportStatus, PipelineStatus, Stage } from '@/generated/prisma/enums';
import { STAGE_LABEL } from '@/domain/stages';
import { pipelineLabel, type PipelineState } from '@/domain/pipeline';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';

// Badge de estado con punto de color, el mismo de los estados de secuencia
// en app.studiomrb.com. Los colores salen de ahí: gris (borrador),
// ámbar (pausada), verde (activa), zinc (terminada), y el teal primario.

export type Cfg = { cls: string; dot: string };

const NEUTRAL: Cfg = { cls: 'border-border bg-muted text-muted-foreground', dot: 'bg-muted-foreground' };
const AMBER: Cfg = {
  cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  dot: 'bg-amber-500',
};
const EMERALD: Cfg = {
  cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  dot: 'bg-emerald-500',
};
const DONE: Cfg = { cls: 'border-border bg-background text-muted-foreground', dot: 'bg-zinc-400' };
const PRIMARY: Cfg = { cls: 'border-primary/40 bg-primary/10 text-primary', dot: 'bg-primary' };

const STAGE_CONFIG: Record<Stage, Cfg> = {
  IMPORTED: NEUTRAL,
  PROPOSAL_GENERATED: DONE,
  IN_REVIEW: AMBER,
  APPROVED: PRIMARY,
  APPLIED: EMERALD,
  MEASURED: DONE,
};

const CHANNEL_STATUS_CONFIG: Record<ChannelStatus, Cfg> = {
  ACTIVE: EMERALD,
  PAUSED: AMBER,
  CLOSED: DONE,
  UNDER_REVIEW: AMBER,
  INACTIVE: DONE,
  DELETED: NEUTRAL,
  UNPUBLISHED: NEUTRAL,
};

export function DotBadge({ cfg, label, compact }: { cfg: Cfg; label: string; compact?: boolean }) {
  if (compact) {
    return (
      <span
        className={cn('inline-block h-2 w-2 rounded-full', cfg.dot)}
        title={label}
        aria-label={label}
      />
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cfg.cls,
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {label}
    </span>
  );
}

export function StageBadge({ stage, compact }: { stage: Stage; compact?: boolean }) {
  return <DotBadge cfg={STAGE_CONFIG[stage]} label={STAGE_LABEL[stage]} compact={compact} />;
}

const PIPELINE_CONFIG: Record<PipelineStatus, Cfg> = {
  UNTOUCHED: NEUTRAL,
  IN_PIPELINE: PRIMARY,
  CORRECTED: EMERALD,
  DISCARDED: DONE,
};

/** Dónde está la publicación en el pipeline: la etapa que se ve en listas y fichas. */
export function PipelineBadge({ state }: { state: PipelineState }) {
  return <DotBadge cfg={PIPELINE_CONFIG[state.pipelineStatus]} label={pipelineLabel(state)} />;
}

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  return <DotBadge cfg={CHANNEL_STATUS_CONFIG[status]} label={CHANNEL_STATUS_LABEL[status]} />;
}

const IMPORT_STATUS: Record<ImportStatus, { cfg: Cfg; label: string }> = {
  RUNNING: { cfg: AMBER, label: 'En curso' },
  DONE: { cfg: EMERALD, label: 'Terminada' },
  FAILED: { cfg: NEUTRAL, label: 'Cortada' },
  UNDONE: { cfg: DONE, label: 'Deshecha' },
};

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  return <DotBadge cfg={IMPORT_STATUS[status].cfg} label={IMPORT_STATUS[status].label} />;
}
