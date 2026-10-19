import type { AddOutcome } from '@/app/a/[cuenta]/publicaciones/pipeline-actions';
import type { Duplicate } from '@/domain/pipeline';

const MAX_RELATED = 3;

const named = (p: { title: string | null; externalId: string | null }) => p.externalId ?? `«${p.title || 'Sin título'}»`;

function relatedText(d: Duplicate): string {
  const where = d.other.inPipeline ? 'que ya está en el pipeline' : 'que también se agregó';
  return d.reason === 'product'
    ? `${named(d)} es del mismo producto que ${named(d.other)}, ${where}.`
    : `${named(d)} tiene el mismo título que ${named(d.other)}, ${where}.`;
}

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
  if (r.related.length > 0) {
    parts.push('Aviso:', ...r.related.slice(0, MAX_RELATED).map(relatedText));
    const rest = r.related.length - MAX_RELATED;
    if (rest > 0) parts.push(rest === 1 ? 'Y 1 más.' : `Y ${rest} más.`);
  }
  if (r.notFound.length > 0) parts.push(`No están en el Catálogo: ${r.notFound.join(', ')}.`);
  if (r.invalid.length > 0) parts.push(`No se entiende: ${r.invalid.join(', ')}.`);
  return parts.join(' ') || 'No se agregó ninguna.';
}
