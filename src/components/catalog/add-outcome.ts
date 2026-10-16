import type { AddOutcome } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';

/** "Se agregaron 3 al pipeline. 1 retomó en el paso donde estaba." */
export function addOutcomeText(r: Extract<AddOutcome, { ok: true }>): string {
  const parts: string[] = [];
  if (r.added > 0) parts.push(r.added === 1 ? 'Se agregó 1 al pipeline.' : `Se agregaron ${r.added} al pipeline.`);
  if (r.resumed > 0) {
    parts.push(
      r.resumed === 1
        ? '1 volvió al pipeline en el paso donde estaba.'
        : `${r.resumed} volvieron al pipeline en el paso donde estaban.`,
    );
  }
  if (r.alreadyIn > 0) parts.push(r.alreadyIn === 1 ? '1 ya estaba en el pipeline.' : `${r.alreadyIn} ya estaban en el pipeline.`);
  if (r.withoutId > 0) {
    parts.push(
      r.withoutId === 1
        ? '1 no tiene código del canal y no puede entrar.'
        : `${r.withoutId} no tienen código del canal y no pueden entrar.`,
    );
  }
  if (r.notFound.length > 0) parts.push(`No están en el Catálogo: ${r.notFound.join(', ')}.`);
  if (r.invalid.length > 0) parts.push(`No se entiende: ${r.invalid.join(', ')}.`);
  return parts.join(' ') || 'No se agregó ninguna.';
}
