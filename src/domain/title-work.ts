import { Prisma } from '@/generated/prisma/client';
import type { CaptureSource, TitleLockDecision } from '@/generated/prisma/enums';
import { writeContentField } from './content';
import { advanceStep, PipelineError } from './pipeline';
import { checkTitle, cleanSeeds, sameText, wordKey, type WordStatus } from './titles';
import type { TitleRules } from './title-rules';

// Lo que se guarda en el paso Título: la decisión sobre el título bloqueado,
// las semillas, las palabras elegidas, las búsquedas principales, lo que se
// leyó del buscador, las posiciones y el título aprobado. No sabe de canales.

type Tx = Prisma.TransactionClient;

export class TitleError extends Error {}

export type TitleProposal = { title: string; reason: string };

export function parseProposals(raw: unknown): TitleProposal[] {
  return Array.isArray(raw)
    ? raw.flatMap((p) =>
        p && typeof p === 'object' && typeof (p as TitleProposal).title === 'string'
          ? [{ title: (p as TitleProposal).title, reason: String((p as TitleProposal).reason ?? '') }]
          : [],
      )
    : [];
}

export function parseWordStatuses(raw: unknown): Record<string, WordStatus> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (e): e is [string, WordStatus] => e[1] === 'use' || e[1] === 'discard',
    ),
  );
}

export function parseStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/** El trabajo del título de la publicación; lo crea si no existe. */
export async function ensureTitleWork(tx: Tx, publicationId: string) {
  return tx.titleWork.upsert({ where: { publicationId }, update: {}, create: { publicationId } });
}

/** Bloquea la publicación y confirma que está en el paso Título. */
async function lockAtTitle(tx: Tx, publicationId: string) {
  const [row] = await tx.$queryRaw<{ pipelineStatus: string; pipelineStep: string | null }[]>`
    SELECT "pipelineStatus", "pipelineStep" FROM publications WHERE id = ${publicationId} FOR UPDATE`;
  if (!row) throw new TitleError('La publicación no existe.');
  if (row.pipelineStatus !== 'IN_PIPELINE' || row.pipelineStep !== 'TITLE') {
    throw new TitleError('La publicación ya no está en el paso Título. Recargá la página.');
  }
}

export async function saveSeeds(tx: Tx, publicationId: string, seeds: string[]): Promise<string[]> {
  const clean = cleanSeeds(seeds);
  await tx.titleWork.upsert({ where: { publicationId }, update: { seeds: clean }, create: { publicationId, seeds: clean } });
  return clean;
}

/** Tilda, descarta o deja sin marcar una palabra. Cambia solo esa palabra, aunque haya otros cambios al mismo tiempo. */
export async function setWordStatus(tx: Tx, publicationId: string, word: string, status: WordStatus | null) {
  const key = wordKey(word);
  if (!key) throw new TitleError('La palabra no es válida.');
  await ensureTitleWork(tx, publicationId);
  if (status) {
    await tx.$executeRaw`
      UPDATE title_works SET words = words || jsonb_build_object(${key}::text, ${status}::text), "updatedAt" = now()
      WHERE "publicationId" = ${publicationId}`;
  } else {
    await tx.$executeRaw`
      UPDATE title_works SET words = words - ${key}::text, "updatedAt" = now() WHERE "publicationId" = ${publicationId}`;
  }
}

export const MAX_PROPOSALS = 3;

/**
 * Guarda propuestas de título armadas fuera de la app, por ejemplo por Claude
 * en una conversación. Reemplazan las que había y aparecen en el paso para
 * elegir. Sin costo de la IA de la app.
 */
export async function saveProposals(tx: Tx, publicationId: string, proposals: TitleProposal[], now: Date = new Date()) {
  const clean: TitleProposal[] = [];
  for (const p of proposals) {
    const title = p.title.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (title && !clean.some((c) => sameText(c.title, title))) clean.push({ title, reason: p.reason.trim().slice(0, 1000) });
  }
  if (clean.length === 0) throw new TitleError('Falta al menos una propuesta.');
  if (clean.length > MAX_PROPOSALS) throw new TitleError(`Hasta ${MAX_PROPOSALS} propuestas.`);
  const data = { proposals: clean, proposalsAt: now, proposalUsage: Prisma.DbNull };
  await tx.titleWork.upsert({ where: { publicationId }, update: data, create: { publicationId, ...data } });
  return clean;
}

export const MAX_MAIN_SEARCHES = 5;

export async function setMainSearches(tx: Tx, publicationId: string, searches: string[]): Promise<string[]> {
  const clean: string[] = [];
  for (const raw of searches) {
    const s = raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
    if (s && !clean.some((c) => sameText(c, s))) clean.push(s);
  }
  if (clean.length > MAX_MAIN_SEARCHES) throw new TitleError(`Elegí hasta ${MAX_MAIN_SEARCHES} búsquedas principales.`);
  await tx.titleWork.upsert({
    where: { publicationId },
    update: { mainSearches: clean },
    create: { publicationId, mainSearches: clean },
  });
  return clean;
}

/** Guarda lo que devolvió el buscador para algo que se escribió, con la fecha de hoy. */
export async function saveSuggestions(
  tx: Tx,
  args: {
    accountId: string;
    channelId: string;
    seed: string;
    query: string;
    suggestions: string[];
    source: CaptureSource;
    publicationId: string | null;
    at?: Date;
  },
) {
  return tx.searchSuggestion.create({
    data: {
      accountId: args.accountId,
      channelId: args.channelId,
      seed: args.seed.toLowerCase().trim(),
      query: args.query.toLowerCase().trim(),
      suggestions: args.suggestions,
      source: args.source,
      publicationId: args.publicationId,
      capturedAt: args.at ?? new Date(),
    },
  });
}

export const MAX_PAGES = 3;

/** Guarda en qué página y posición aparece. Sin página: no aparece en las páginas revisadas. */
export async function savePosition(
  tx: Tx,
  args: { publicationId: string; query: string; page: number | null; position: number | null; source: CaptureSource; at?: Date },
) {
  const query = args.query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!query) throw new TitleError('Falta la búsqueda.');
  if (args.page !== null && (!Number.isInteger(args.page) || args.page < 1 || args.page > MAX_PAGES)) {
    throw new TitleError(`La página tiene que ser de 1 a ${MAX_PAGES}.`);
  }
  if (args.page !== null && (args.position === null || !Number.isInteger(args.position) || args.position < 1 || args.position > 100)) {
    throw new TitleError('La posición tiene que ser un número de 1 a 100.');
  }
  return tx.searchPosition.create({
    data: {
      publicationId: args.publicationId,
      query,
      page: args.page,
      position: args.page === null ? null : args.position,
      pagesChecked: MAX_PAGES,
      source: args.source,
      checkedAt: args.at ?? new Date(),
    },
  });
}

/**
 * Qué hacer con un título bloqueado. Mantenerlo completa el paso sin cambios
 * y pasa a Imágenes; probarlo en la copia sigue en el paso. Null deshace la
 * decisión de probar en la copia.
 */
export async function decideLock(
  tx: Tx,
  args: { publicationId: string; decision: TitleLockDecision | null; userId: string | null; now?: Date },
): Promise<void> {
  await lockAtTitle(tx, args.publicationId);
  const at = args.now ?? new Date();
  await tx.titleWork.upsert({
    where: { publicationId: args.publicationId },
    update: { lockDecision: args.decision, lockDecidedAt: args.decision ? at : null, lockDecidedById: args.decision ? args.userId : null },
    create: {
      publicationId: args.publicationId,
      lockDecision: args.decision,
      lockDecidedAt: args.decision ? at : null,
      lockDecidedById: args.decision ? args.userId : null,
    },
  });
  if (args.decision !== 'KEEP') return;
  const pub = await tx.publication.findUniqueOrThrow({ where: { id: args.publicationId }, select: { title: true } });
  await tx.titleApproval.create({
    data: { publicationId: args.publicationId, outcome: 'KEPT', before: pub.title, title: pub.title, userId: args.userId, createdAt: at },
  });
  await advanceStep(tx, { publicationId: args.publicationId, expected: 'TITLE', userId: args.userId, now: at });
}

/**
 * Aprueba el título: guarda qué propuso la IA y qué quedó, lo escribe en la
 * publicación (o lo deja para la copia con cuotas) y pasa a Imágenes. No deja
 * aprobar un título que no cumple las reglas, ni uno bloqueado sin decidir.
 */
export async function approveTitle(
  tx: Tx,
  args: {
    publicationId: string;
    title: string;
    // La propuesta de la IA de la que salió, si salió de una.
    aiTitle: string | null;
    locked: boolean | null;
    rules: TitleRules;
    userId: string | null;
    now?: Date;
  },
): Promise<{ outcome: 'WRITTEN' | 'COPY' }> {
  await lockAtTitle(tx, args.publicationId);
  const work = await ensureTitleWork(tx, args.publicationId);
  if (args.locked && !work.lockDecision) {
    throw new TitleError('El título está bloqueado: primero elegí si lo mantenés o lo probás en la copia con cuotas.');
  }
  const title = args.title.trim().replace(/\s+/g, ' ');
  const check = checkTitle(title, args.rules);
  if (check.errors.length > 0) throw new TitleError(`Para aprobar falta: ${check.errors.join(' ')}`);
  const copy = work.lockDecision === 'TRY_IN_COPY';
  const pub = await tx.publication.findUniqueOrThrow({
    where: { id: args.publicationId },
    select: { title: true, productId: true },
  });
  const at = args.now ?? new Date();
  const aiTitle = args.aiTitle?.trim() || null;
  await tx.titleApproval.create({
    data: {
      publicationId: args.publicationId,
      outcome: copy ? 'COPY' : 'WRITTEN',
      before: pub.title,
      title,
      aiTitle,
      aiProposals: work.proposals ?? [],
      // Sin propuesta de la IA, el título lo escribió la persona.
      edited: aiTitle === null || aiTitle !== title,
      userId: args.userId,
      createdAt: at,
    },
  });
  if (!copy) {
    await writeContentField(tx, { productId: pub.productId, publicationId: args.publicationId }, 'title', title);
  }
  try {
    await advanceStep(tx, { publicationId: args.publicationId, expected: 'TITLE', userId: args.userId, now: at });
  } catch (e) {
    if (e instanceof PipelineError) throw new TitleError(e.message);
    throw e;
  }
  return { outcome: copy ? 'COPY' : 'WRITTEN' };
}
