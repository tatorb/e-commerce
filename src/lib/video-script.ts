import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { ProposalError } from '@/ai/request';
import { requestVideoScript, type VideoScriptInput, type VideoScriptResult } from '@/ai/video-script';
import { cleanScriptLines, scriptSeconds, scriptWordBudget, SCRIPT_LINES_MAX } from '@/domain/video-edit';
import { descriptionInput } from '@/lib/descriptions';
import { richTextToMarkdown } from '@/domain/research';
import type { ClipRules } from '@/domain/videos';

// El guión de la voz en off de los clips de un producto. Se escribe antes de
// editar, con Claude o a mano, con la misma información que la imagen con
// texto: no relata el video, da las certezas de la publicación. Es del
// producto: vale para todos sus videos y todas sus publicaciones. Recibe la
// base por parámetro para poder probarlo con una base de prueba.

type Db = PrismaClient | Prisma.TransactionClient;

export class VideoScriptError extends Error {}

export type VideoScriptView = {
  lines: string[];
  // claude: lo propuso Claude y nadie lo tocó. persona: se escribió o se corrigió a mano.
  source: 'claude' | 'persona';
  // Cuántos segundos lleva decirlo, a ojo.
  seconds: number;
  updatedAt: Date;
  updatedBy: string | null;
};

export async function loadVideoScript(db: Db, productId: string): Promise<VideoScriptView | null> {
  const row = await db.videoScript.findUnique({ where: { productId } });
  if (!row) return null;
  const lines = cleanScriptLines(row.lines);
  if (lines.length === 0) return null;
  const by = row.updatedById ? await db.user.findUnique({ where: { id: row.updatedById }, select: { name: true } }) : null;
  return { lines, source: row.source === 'claude' ? 'claude' : 'persona', seconds: scriptSeconds(lines), updatedAt: row.updatedAt, updatedBy: by?.name ?? null };
}

/** Las frases del guión del producto, o null si no tiene. */
export async function scriptLinesOf(db: Db, productId: string): Promise<string[] | null> {
  const row = await db.videoScript.findUnique({ where: { productId }, select: { lines: true } });
  const lines = cleanScriptLines(row?.lines);
  return lines.length > 0 ? lines : null;
}

async function productOf(db: Db, accountId: string, productId: string) {
  const product = await db.product.findFirst({ where: { id: productId, accountId }, select: { id: true } });
  if (!product) throw new VideoScriptError('El producto no es de esta cuenta.');
  return product;
}

/** Lo que no deja guardar un guión: muy largo para el clip más largo que acepta el canal. */
function check(lines: string[], rules: Pick<ClipRules, 'maxSeconds'> | null): void {
  const max = rules?.maxSeconds ?? 60;
  const seconds = scriptSeconds(lines);
  if (seconds > max) {
    throw new VideoScriptError(`El guión lleva unos ${Math.round(seconds)} segundos y el clip puede durar hasta ${max}. Acortalo o sacá alguna frase.`);
  }
}

/** Guarda el guión escrito o corregido a mano. Con todas las frases vacías, lo borra. */
export async function saveVideoScript(
  db: PrismaClient,
  args: { accountId: string; productId: string; lines: unknown; userId: string | null; rules?: Pick<ClipRules, 'maxSeconds'> | null; source?: 'claude' | 'persona' },
): Promise<VideoScriptView | null> {
  await productOf(db, args.accountId, args.productId);
  if (Array.isArray(args.lines) && args.lines.filter((l) => typeof l === 'string' && l.trim()).length > SCRIPT_LINES_MAX) {
    throw new VideoScriptError(`El guión puede tener hasta ${SCRIPT_LINES_MAX} frases.`);
  }
  if (Array.isArray(args.lines) && args.lines.some((l) => typeof l === 'string' && l.trim().length > 400)) {
    throw new VideoScriptError('Una frase del guión es muy larga: partila en dos.');
  }
  const lines = cleanScriptLines(args.lines);
  if (lines.length === 0) {
    await db.videoScript.deleteMany({ where: { productId: args.productId } });
    return null;
  }
  check(lines, args.rules ?? null);
  const data = { lines, source: args.source ?? 'persona', updatedById: args.userId };
  await db.videoScript.upsert({ where: { productId: args.productId }, create: { productId: args.productId, ...data }, update: data });
  return loadVideoScript(db, args.productId);
}

type Requester = (input: VideoScriptInput) => Promise<VideoScriptResult>;

export type ProposeResult = { ok: true; costUsd: number; script: VideoScriptView } | { ok: false; error: string; costUsd: number };

/**
 * Pide a Claude el guión a partir del paso Información y de Preguntas y
 * respuestas de la publicación, para un clip de esos segundos, y lo guarda.
 * Si ya hay un guión, solo lo reemplaza con replace.
 */
export async function proposeVideoScript(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; clipSeconds: number; userId: string | null; replace?: boolean; rules?: Pick<ClipRules, 'maxSeconds'> | null },
  request: Requester = requestVideoScript,
): Promise<ProposeResult> {
  const pub = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: { id: true, productId: true, faq: true, answerRules: true },
  });
  if (!pub) throw new VideoScriptError('La publicación no es de esta cuenta.');
  if (!args.replace && (await scriptLinesOf(db, pub.productId))) return { ok: false, error: 'Ya hay un guión: confirmá que querés reemplazarlo.', costUsd: 0 };
  const [info, research] = await Promise.all([
    descriptionInput(db, args.accountId, pub.id),
    db.productResearch.findUnique({ where: { productId: pub.productId }, select: { competitorQuestions: true } }),
  ]);
  const maxWords = scriptWordBudget(args.clipSeconds);
  let r: VideoScriptResult;
  try {
    r = await request({
      info,
      faq: richTextToMarkdown(pub.faq ?? null),
      rules: richTextToMarkdown(pub.answerRules ?? null),
      competitorQuestions: richTextToMarkdown(research?.competitorQuestions ?? null),
      maxWords,
    });
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0 };
    throw e;
  }
  const lines = cleanScriptLines(r.output.lineas.map((l) => l.slice(0, 400)).slice(0, SCRIPT_LINES_MAX));
  if (lines.length === 0) return { ok: false, error: 'Claude no encontró qué decir con los datos del producto. Completá el paso Información y probá de nuevo.', costUsd: r.usage.costUsd };
  // Si se pasó del largo, se le sacan frases del final: lo más importante va primero.
  const max = args.rules?.maxSeconds ?? 60;
  while (lines.length > 1 && scriptSeconds(lines) > max) lines.pop();
  const script = await saveVideoScript(db, { accountId: args.accountId, productId: pub.productId, lines, userId: args.userId, rules: args.rules ?? null, source: 'claude' });
  return script ? { ok: true, costUsd: r.usage.costUsd, script } : { ok: false, error: 'No se pudo guardar el guión.', costUsd: r.usage.costUsd };
}
