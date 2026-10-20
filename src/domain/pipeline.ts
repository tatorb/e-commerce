import type { Prisma } from '@/generated/prisma/client';
import type { PipelineExit, PipelineRemoval, PipelineStatus, PipelineStep } from '@/generated/prisma/enums';

// Pipeline: el recorrido por pasos para corregir una publicación de punta a
// punta. Es por publicación y no sabe nada de ningún canal.

export const PIPELINE_STEPS: PipelineStep[] = ['INFO', 'TITLE', 'IMAGES', 'VIDEOS', 'MEDIA', 'DESCRIPTION', 'PUBLISH'];

export const PIPELINE_STEP_LABEL: Record<PipelineStep, string> = {
  INFO: 'Información',
  TITLE: 'Título',
  IMAGES: 'Imágenes',
  VIDEOS: 'Videos',
  MEDIA: 'Organización de multimedia',
  DESCRIPTION: 'Descripción',
  PUBLISH: 'Publicación',
};

/** Cómo va cada paso en la dirección de la página, por ejemplo ?paso=informacion. */
export const PIPELINE_STEP_SLUG: Record<PipelineStep, string> = {
  INFO: 'informacion',
  TITLE: 'titulo',
  IMAGES: 'imagenes',
  VIDEOS: 'videos',
  MEDIA: 'multimedia',
  DESCRIPTION: 'descripcion',
  PUBLISH: 'publicacion',
};

/** El paso de una dirección. Null si no es ninguno. */
export function stepFromSlug(slug: string | string[] | null | undefined): PipelineStep | null {
  const value = (Array.isArray(slug) ? slug[0] : slug)?.trim().toLowerCase();
  return PIPELINE_STEPS.find((s) => PIPELINE_STEP_SLUG[s] === value) ?? null;
}

export const PIPELINE_STATUSES: PipelineStatus[] = ['UNTOUCHED', 'IN_PIPELINE', 'CORRECTED', 'DISCARDED'];

export const PIPELINE_STATUS_LABEL: Record<PipelineStatus, string> = {
  UNTOUCHED: 'Sin tocar',
  IN_PIPELINE: 'En pipeline',
  CORRECTED: 'Corregida',
  DISCARDED: 'Descartada',
};

export const PIPELINE_REMOVALS: PipelineRemoval[] = ['NOT_WORTH', 'LATER', 'DUPLICATE', 'PAUSE'];

export const PIPELINE_REMOVAL_LABEL: Record<PipelineRemoval, string> = {
  NOT_WORTH: 'No vale la pena',
  LATER: 'Más adelante',
  DUPLICATE: 'Duplicada',
  PAUSE: 'Pausar',
};

export const PIPELINE_EXIT_LABEL: Record<PipelineExit, string> = {
  ADVANCED: 'Avanzó',
  BACK: 'Volvió',
  REMOVED: 'Se sacó del pipeline',
  COMPLETED: 'Terminó',
};

export type PipelineState = {
  pipelineStatus: PipelineStatus;
  pipelineStep: PipelineStep | null;
  pipelineRemoval: PipelineRemoval | null;
};

/** "En pipeline · Título", "Descartada · Más adelante", "Sin tocar". */
export function pipelineLabel(s: PipelineState): string {
  const base = PIPELINE_STATUS_LABEL[s.pipelineStatus];
  if (s.pipelineStatus === 'IN_PIPELINE' && s.pipelineStep) return `${base} · ${PIPELINE_STEP_LABEL[s.pipelineStep]}`;
  if (s.pipelineStatus === 'DISCARDED' && s.pipelineRemoval) {
    return `${base} · ${PIPELINE_REMOVAL_LABEL[s.pipelineRemoval].toLowerCase()}`;
  }
  return base;
}

export function nextStep(step: PipelineStep): PipelineStep | null {
  return PIPELINE_STEPS[PIPELINE_STEPS.indexOf(step) + 1] ?? null;
}

export function previousStep(step: PipelineStep): PipelineStep | null {
  const i = PIPELINE_STEPS.indexOf(step);
  return i > 0 ? PIPELINE_STEPS[i - 1] : null;
}

/** En qué paso entra al agregarla: una descartada retoma donde estaba, el resto empieza de cero. */
export function entryStep(s: PipelineState): PipelineStep {
  return s.pipelineStatus === 'DISCARDED' && s.pipelineStep ? s.pipelineStep : PIPELINE_STEPS[0];
}

// ───────────────────────────── Duplicadas ─────────────────────────────

/** El título sin mayúsculas, tildes ni signos, para comparar. */
export function normalizeTitle(title: string | null | undefined): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

export type DuplicateCandidate = { id: string; productId: string; title: string | null; externalId?: string | null };

export type Duplicate = {
  id: string;
  title: string | null;
  externalId: string | null;
  // La que ya está en el pipeline, o una anterior de las que se agregan juntas.
  other: { id: string; title: string | null; externalId: string | null; inPipeline: boolean };
  reason: 'product' | 'title';
};

/**
 * Las que son del mismo producto que otra que ya está en el pipeline, o que
 * otra anterior de la misma tanda, o que tienen el mismo título. Es solo un
 * aviso: varias publicaciones del mismo producto son un caso normal.
 */
export function findDuplicates(candidates: DuplicateCandidate[], inPipeline: DuplicateCandidate[]): Duplicate[] {
  const already = new Set(inPipeline.map((o) => o.id));
  const seen = [...inPipeline];
  const out: Duplicate[] = [];
  for (const c of candidates) {
    const title = normalizeTitle(c.title);
    const sameProduct = seen.find((o) => o.id !== c.id && o.productId === c.productId);
    const sameTitle = title ? seen.find((o) => o.id !== c.id && normalizeTitle(o.title) === title) : undefined;
    const other = sameProduct ?? sameTitle;
    if (other) {
      out.push({
        id: c.id,
        title: c.title,
        externalId: c.externalId ?? null,
        other: { id: other.id, title: other.title, externalId: other.externalId ?? null, inPipeline: already.has(other.id) },
        reason: sameProduct ? 'product' : 'title',
      });
    }
    seen.push(c);
  }
  return out;
}

// ───────────────────────────── Movimientos ─────────────────────────────

export class PipelineError extends Error {}

type Tx = Prisma.TransactionClient;

export type AddResult = {
  added: number;
  // Las descartadas que volvieron, en el paso donde estaban.
  resumed: number;
  alreadyIn: number;
  // Del mismo producto o con el mismo título que otra del pipeline: entran
  // igual, con aviso.
  related: Duplicate[];
};

/**
 * Agrega publicaciones al pipeline, tengan o no código del canal: las que
 * todavía no están publicadas lo cargan en el paso Publicación. Las que ya
 * están en el pipeline se saltean.
 */
export async function addToPipeline(
  tx: Tx,
  args: { accountId: string; publicationIds: string[]; userId: string | null; now?: Date },
): Promise<AddResult> {
  const ids = [...new Set(args.publicationIds)];
  if (ids.length === 0) throw new PipelineError('No elegiste ninguna publicación.');
  // De a una tanda por cuenta a la vez, así dos personas no agregan el mismo
  // producto al mismo tiempo sin enterarse.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pipeline:${args.accountId}`}))`;

  const rows = await tx.publication.findMany({
    where: { id: { in: ids }, product: { accountId: args.accountId } },
    select: {
      id: true,
      productId: true,
      title: true,
      externalId: true,
      pipelineStatus: true,
      pipelineStep: true,
      pipelineRemoval: true,
      product: { select: { name: true } },
    },
  });
  if (rows.length !== ids.length) throw new PipelineError('Alguna publicación ya no existe. Recargá la página.');
  // En el orden en que se eligieron.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)!);

  const alreadyIn = ordered.filter((r) => r.pipelineStatus === 'IN_PIPELINE');
  const toAdd = ordered.filter((r) => r.pipelineStatus !== 'IN_PIPELINE');

  let related: Duplicate[] = [];
  if (toAdd.length > 0) {
    const inPipeline = await tx.publication.findMany({
      where: { pipelineStatus: 'IN_PIPELINE', product: { accountId: args.accountId } },
      select: { id: true, productId: true, title: true, externalId: true, product: { select: { name: true } } },
    });
    const asCandidate = (r: {
      id: string;
      productId: string;
      title: string | null;
      externalId: string | null;
      product: { name: string };
    }) => ({ id: r.id, productId: r.productId, title: r.title, externalId: r.externalId });
    related = findDuplicates(toAdd.map(asCandidate), inPipeline.map(asCandidate));
  }

  const at = args.now ?? new Date();
  let resumed = 0;
  for (const r of toAdd) {
    const step = entryStep(r);
    if (r.pipelineStatus === 'DISCARDED' && r.pipelineStep) resumed++;
    await tx.pipelineMovement.create({ data: { publicationId: r.id, step, enteredAt: at, userId: args.userId } });
    await tx.publication.update({
      where: { id: r.id },
      data: { pipelineStatus: 'IN_PIPELINE', pipelineStep: step, pipelineRemoval: null },
    });
  }
  return { added: toAdd.length - resumed, resumed, alreadyIn: alreadyIn.length, related };
}

async function lockInPipeline(tx: Tx, publicationId: string, expected: PipelineStep) {
  const [row] = await tx.$queryRaw<{ pipelineStatus: PipelineStatus; pipelineStep: PipelineStep | null }[]>`
    SELECT "pipelineStatus", "pipelineStep" FROM publications WHERE id = ${publicationId} FOR UPDATE`;
  if (!row) throw new PipelineError('La publicación no existe.');
  if (row.pipelineStatus !== 'IN_PIPELINE') throw new PipelineError('La publicación no está en el pipeline.');
  // Evita que un doble clic, o dos personas a la vez, la muevan dos veces.
  if (row.pipelineStep !== expected) throw new PipelineError('La publicación cambió de paso mientras tanto. Recargá la página.');
  return row;
}

/** Cierra el paso abierto con su motivo de salida. */
async function closeOpen(
  tx: Tx,
  args: { publicationId: string; at: Date; exitKind: PipelineExit; removal?: PipelineRemoval; userId: string | null },
) {
  await tx.pipelineMovement.updateMany({
    where: { publicationId: args.publicationId, exitedAt: null },
    data: { exitedAt: args.at, exitKind: args.exitKind, removal: args.removal ?? null, exitedById: args.userId },
  });
}

type MoveArgs = { publicationId: string; expected: PipelineStep; userId: string | null; now?: Date };

async function moveTo(tx: Tx, args: MoveArgs, to: PipelineStep, exitKind: 'ADVANCED' | 'BACK'): Promise<{ step: PipelineStep }> {
  const at = args.now ?? new Date();
  await closeOpen(tx, { publicationId: args.publicationId, at, exitKind, userId: args.userId });
  await tx.pipelineMovement.create({ data: { publicationId: args.publicationId, step: to, enteredAt: at, userId: args.userId } });
  await tx.publication.update({ where: { id: args.publicationId }, data: { pipelineStep: to } });
  return { step: to };
}

/** Pasa al paso siguiente. En el último paso se termina con completePipeline. */
export async function advanceStep(tx: Tx, args: MoveArgs): Promise<{ step: PipelineStep }> {
  await lockInPipeline(tx, args.publicationId, args.expected);
  const to = nextStep(args.expected);
  if (!to) throw new PipelineError('Es el último paso: marcala como corregida.');
  return moveTo(tx, args, to, 'ADVANCED');
}

/** Vuelve al paso anterior. */
export async function backStep(tx: Tx, args: MoveArgs): Promise<{ step: PipelineStep }> {
  await lockInPipeline(tx, args.publicationId, args.expected);
  const to = previousStep(args.expected);
  if (!to) throw new PipelineError('Es el primer paso: no hay uno anterior.');
  return moveTo(tx, args, to, 'BACK');
}

/** Termina el último paso: la publicación queda corregida. Para eso tiene que estar publicada. */
export async function completePipeline(tx: Tx, args: MoveArgs): Promise<void> {
  await lockInPipeline(tx, args.publicationId, args.expected);
  if (nextStep(args.expected)) throw new PipelineError('Todavía faltan pasos.');
  const pub = await tx.publication.findUniqueOrThrow({ where: { id: args.publicationId }, select: { externalId: true } });
  if (!pub.externalId?.trim()) {
    throw new PipelineError('Falta el ID de la publicación en el canal. Cargalo en este paso para marcarla como corregida.');
  }
  await closeOpen(tx, { publicationId: args.publicationId, at: args.now ?? new Date(), exitKind: 'COMPLETED', userId: args.userId });
  await tx.publication.update({
    where: { id: args.publicationId },
    data: { pipelineStatus: 'CORRECTED', pipelineStep: null, pipelineRemoval: null },
  });
}

/** Saca la publicación del pipeline con un motivo. No borra nada: conserva el paso para retomar. */
export async function removeFromPipeline(tx: Tx, args: MoveArgs & { reason: PipelineRemoval }): Promise<void> {
  await lockInPipeline(tx, args.publicationId, args.expected);
  await closeOpen(tx, {
    publicationId: args.publicationId,
    at: args.now ?? new Date(),
    exitKind: 'REMOVED',
    removal: args.reason,
    userId: args.userId,
  });
  await tx.publication.update({
    where: { id: args.publicationId },
    data: { pipelineStatus: 'DISCARDED', pipelineRemoval: args.reason },
  });
}

/**
 * La propuesta completa con IA aplicada en el canal también corrige la
 * publicación, si no estaba en el pipeline. Lo usa "Marcar como aplicada".
 */
export async function markCorrectedOutsidePipeline(tx: Tx, publicationId: string): Promise<void> {
  await tx.publication.updateMany({
    where: { id: publicationId, pipelineStatus: 'UNTOUCHED' },
    data: { pipelineStatus: 'CORRECTED' },
  });
}

/**
 * Al deshacer esa aplicación: vuelve a "Sin tocar" si nunca pasó por el
 * pipeline ni le queda otra aplicación.
 */
export async function undoCorrectedOutsidePipeline(tx: Tx, publicationId: string): Promise<void> {
  const [moves, applications] = await Promise.all([
    tx.pipelineMovement.count({ where: { publicationId } }),
    tx.channelApplication.count({ where: { publicationId } }),
  ]);
  if (moves > 0 || applications > 0) return;
  await tx.publication.updateMany({
    where: { id: publicationId, pipelineStatus: 'CORRECTED' },
    data: { pipelineStatus: 'UNTOUCHED' },
  });
}
