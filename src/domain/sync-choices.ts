import type { ChannelStatus, PipelineStatus } from '@/generated/prisma/enums';

// Qué publicaciones quedan fuera de "datos para elegir" en Sincronización. Las
// que el equipo ya está trabajando en el pipeline (o terminó) ya se sabe que
// tienen diferencias, y las finalizadas en el canal ya no se venden.

type Worked = { pipelineStatus: PipelineStatus };
type WithFamily = Worked & { family: { lead: Worked | null } | null };

export type ChoiceCandidate = WithFamily & {
  channelStatus: ChannelStatus;
  // La principal, si es una opción de venta (3, 6, 9, 12 cuotas o cuota promocionada).
  mainOption: WithFamily | null;
};

const inPipeline = (p: Worked | null | undefined) => p?.pipelineStatus === 'IN_PIPELINE' || p?.pipelineStatus === 'CORRECTED';
const familyInPipeline = (p: WithFamily | null) => inPipeline(p) || inPipeline(p?.family?.lead);

/** Por qué no va en los datos para elegir, o null si va. */
export function choiceExclusion(p: ChoiceCandidate): 'pipeline' | 'option' | 'family' | 'closed' | null {
  if (p.channelStatus === 'CLOSED') return 'closed';
  if (inPipeline(p)) return 'pipeline';
  if (familyInPipeline(p.mainOption)) return 'option';
  if (inPipeline(p.family?.lead)) return 'family';
  return null;
}
