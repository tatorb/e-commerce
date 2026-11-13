// Lo que hace falta leer de cada publicación para saber si va en los datos para
// elegir (choiceExclusion). Lo usan la pantalla, Claude y el globo del menú.
const lead = { select: { lead: { select: { pipelineStatus: true } } } } as const;
export const choiceExclusionSelect = {
  pipelineStatus: true,
  channelStatus: true,
  family: lead,
  mainOption: { select: { pipelineStatus: true, family: lead } },
} as const;
