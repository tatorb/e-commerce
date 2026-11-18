import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { ProposalError } from '@/ai/request';
import { requestVideoScript, type VideoScriptInput, type VideoScriptResult } from '@/ai/video-script';
import { cleanScriptLines, cleanShownLines, parseAccountVideo, scriptSeconds, scriptWordBudget, SCRIPT_LINES_MAX } from '@/domain/video-edit';
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
  // Cómo se escribe cada frase en los subtítulos, una por frase; vacía si es igual a lo que se dice.
  shown: string[];
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
  const shown = cleanShownLines(lines, row.shown) ?? lines.map(() => '');
  return { lines, shown, source: row.source === 'claude' ? 'claude' : 'persona', seconds: scriptSeconds(lines), updatedAt: row.updatedAt, updatedBy: by?.name ?? null };
}

/** Las frases del guión del producto, o null si no tiene. */
export async function scriptLinesOf(db: Db, productId: string): Promise<string[] | null> {
  const row = await db.videoScript.findUnique({ where: { productId }, select: { lines: true } });
  const lines = cleanScriptLines(row?.lines);
  return lines.length > 0 ? lines : null;
}

/**
 * Cómo se escriben en los subtítulos esas frases, si son las del guión del
 * producto y alguna se escribe distinto de lo que se dice. Null si no.
 */
export async function scriptShownOf(db: Db, productId: string, lines: string[]): Promise<string[] | null> {
  const row = await db.videoScript.findUnique({ where: { productId }, select: { lines: true, shown: true } });
  if (!row || JSON.stringify(cleanScriptLines(row.lines)) !== JSON.stringify(lines)) return null;
  return cleanShownLines(lines, row.shown);
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
  args: { accountId: string; productId: string; lines: unknown; shown?: unknown; userId: string | null; rules?: Pick<ClipRules, 'maxSeconds'> | null; source?: 'claude' | 'persona' },
): Promise<VideoScriptView | null> {
  await productOf(db, args.accountId, args.productId);
  if (Array.isArray(args.lines) && args.lines.filter((l) => typeof l === 'string' && l.trim()).length > SCRIPT_LINES_MAX) {
    throw new VideoScriptError(`El guión puede tener hasta ${SCRIPT_LINES_MAX} frases.`);
  }
  if (Array.isArray(args.lines) && args.lines.some((l) => typeof l === 'string' && l.trim().length > 400)) {
    throw new VideoScriptError('Una frase del guión es muy larga: partila en dos.');
  }
  // Las frases vacías se van, y con ellas su texto para los subtítulos.
  const raw = Array.isArray(args.lines) ? args.lines : [];
  const kept = raw.map((l, i) => ({ l, s: Array.isArray(args.shown) ? args.shown[i] : undefined })).filter((x) => typeof x.l === 'string' && x.l.trim());
  const lines = cleanScriptLines(args.lines);
  if (lines.length === 0) {
    await db.videoScript.deleteMany({ where: { productId: args.productId } });
    return null;
  }
  check(lines, args.rules ?? null);
  const shown = lines.length === kept.length ? cleanShownLines(lines, kept.map((x) => x.s)) : null;
  const data = { lines, shown: shown ?? Prisma.DbNull, source: args.source ?? 'persona', updatedById: args.userId };
  await db.videoScript.upsert({ where: { productId: args.productId }, create: { productId: args.productId, ...data }, update: data });
  return loadVideoScript(db, args.productId);
}

/**
 * Los guiones que una persona escribió o corrigió en la cuenta, como ejemplo
 * de cómo le gustan: primero los de productos del mismo tipo, los más nuevos.
 */
export async function scriptExamples(db: Db, accountId: string, productId: string, max = 3): Promise<{ producto: string; frases: { voz: string; subtitulo: string }[] }[]> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { productType: true } });
  const rows = await db.videoScript.findMany({
    where: { source: 'persona', productId: { not: productId }, product: { accountId } },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { lines: true, shown: true, product: { select: { name: true, productType: true } } },
  });
  const sameType = (r: (typeof rows)[number]) => (product?.productType && r.product.productType === product.productType ? 0 : 1);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => sameType(a.r) - sameType(b.r) || a.i - b.i)
    .slice(0, max)
    .map(({ r }) => {
      const lines = cleanScriptLines(r.lines);
      const shown = cleanShownLines(lines, r.shown);
      return { producto: r.product.name, frases: lines.map((voz, i) => ({ voz, subtitulo: shown?.[i] || voz })) };
    })
    .filter((e) => e.frases.length > 0);
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
  const [settings, examples] = await Promise.all([db.videoAccountSettings.findUnique({ where: { accountId: args.accountId } }), scriptExamples(db, args.accountId, pub.productId)]);
  let r: VideoScriptResult;
  try {
    r = await request({
      info,
      faq: richTextToMarkdown(pub.faq ?? null),
      rules: richTextToMarkdown(pub.answerRules ?? null),
      competitorQuestions: richTextToMarkdown(research?.competitorQuestions ?? null),
      maxWords,
      accountRules: parseAccountVideo(settings?.values).scriptRules.trim() || null,
      examples,
    });
  } catch (e) {
    if (e instanceof ProposalError) return { ok: false, error: e.message, costUsd: e.usage?.costUsd ?? 0 };
    throw e;
  }
  const written = r.output.lineas.map((l) => ({ voz: l.voz.replace(/\s+/g, ' ').trim().slice(0, 400), subtitulo: (l.subtitulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) })).filter((l) => l.voz).slice(0, SCRIPT_LINES_MAX);
  if (written.length === 0) return { ok: false, error: 'Claude no encontró qué decir con los datos del producto. Completá el paso Información y probá de nuevo.', costUsd: r.usage.costUsd };
  // Si se pasó del largo, se le sacan frases del final: lo más importante va primero.
  const max = args.rules?.maxSeconds ?? 60;
  while (written.length > 1 && scriptSeconds(written.map((l) => l.voz)) > max) written.pop();
  const lines = written.map((l) => l.voz);
  const script = await saveVideoScript(db, { accountId: args.accountId, productId: pub.productId, lines, shown: written.map((l) => l.subtitulo), userId: args.userId, rules: args.rules ?? null, source: 'claude' });
  return script ? { ok: true, costUsd: r.usage.costUsd, script } : { ok: false, error: 'No se pudo guardar el guión.', costUsd: r.usage.costUsd };
}
