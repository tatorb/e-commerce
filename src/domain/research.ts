import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { InsightKind } from '@/generated/prisma/enums';

// La investigación del producto que se junta en el paso Información: lo del
// fabricante, las aclaraciones para las imágenes, las preguntas de los
// compradores y los dolores y objeciones. Es del producto, como la ficha,
// salvo las preguntas en la publicación propia, que son de cada publicación.
// No sabe nada de canales.

type Tx = Prisma.TransactionClient;

export class ResearchError extends Error {}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const link = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || isHttpUrl(v), 'El link tiene que empezar con http:// o https://')
  .transform((v) => (v === '' ? null : v));

const longText = (max: number) =>
  z
    .string()
    .max(max, `Máximo ${max.toLocaleString('es-AR')} caracteres.`)
    .transform((v) => (v.trim() === '' ? null : v.trim()));

export const manufacturerSchema = z.object({
  site: link,
  productUrl: link,
  text: longText(100_000),
});

export const questionsSchema = z.object({
  own: longText(100_000),
  competitors: longText(100_000),
});

// ───────────────────────────── Texto con formato ─────────────────────────────

const RICH_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'];
export const MAX_RICH_TEXT = 50_000;

/** Deja solo párrafos, negrita, cursiva y listas, sin atributos. Vacío da null. */
export function cleanRichText(html: string): string | null {
  const clean = sanitizeHtml(html, {
    allowedTags: RICH_TAGS,
    allowedAttributes: {},
    transformTags: { b: 'strong', i: 'em', div: 'p', h1: 'p', h2: 'p', h3: 'p', h4: 'p', h5: 'p', h6: 'p' },
  }).trim();
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim();
  if (text === '') return null;
  if (clean.length > MAX_RICH_TEXT) throw new ResearchError('El texto es demasiado largo.');
  return clean;
}

// ───────────────────────────── Guardar ─────────────────────────────

type ResearchFields = {
  manufacturerSite?: string | null;
  manufacturerProductUrl?: string | null;
  manufacturerText?: string | null;
  clarifications?: string | null;
  competitorQuestions?: string | null;
};

/** Guarda los campos que llegan; los demás quedan como estaban. */
export async function updateResearch(tx: Tx, args: { productId: string; userId: string | null; data: ResearchFields }) {
  const data = { ...args.data, updatedById: args.userId };
  return tx.productResearch.upsert({
    where: { productId: args.productId },
    update: data,
    create: { productId: args.productId, ...data },
  });
}

/**
 * Las preguntas de los compradores. Las de la publicación propia quedan en esa
 * publicación; las de la competencia, en el producto. Guarda las que llegan.
 */
export async function saveQuestions(
  tx: Tx,
  args: { productId: string; publicationId: string; userId: string | null; own?: string | null; competitors?: string | null },
) {
  if (args.own !== undefined) {
    await tx.publication.update({ where: { id: args.publicationId }, data: { ownQuestions: args.own } });
  }
  if (args.competitors !== undefined) {
    await updateResearch(tx, { productId: args.productId, userId: args.userId, data: { competitorQuestions: args.competitors } });
  }
}

// ───────────────────────────── Dolores y objeciones ─────────────────────────────

export const MAX_INSIGHTS = 50;
export const INSIGHT_LABEL: Record<InsightKind, { one: string; many: string }> = {
  PAIN: { one: 'Dolor', many: 'Dolores' },
  OBJECTION: { one: 'Objeción', many: 'Objeciones' },
};

export function cleanInsight(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) throw new ResearchError('Escribí algo.');
  if (text.length > 500) throw new ResearchError('Máximo 500 caracteres.');
  return text;
}

// De a un cambio por producto a la vez, así el orden no se mezcla.
async function lockInsights(tx: Tx, productId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`insights:${productId}`}))`;
}

async function listKind(tx: Tx, productId: string, kind: InsightKind) {
  return tx.buyerInsight.findMany({ where: { productId, kind }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
}

export async function addInsight(tx: Tx, args: { productId: string; kind: InsightKind; text: string }) {
  const text = cleanInsight(args.text);
  await lockInsights(tx, args.productId);
  const list = await listKind(tx, args.productId, args.kind);
  if (list.length >= MAX_INSIGHTS) throw new ResearchError(`Hasta ${MAX_INSIGHTS} por lista.`);
  const position = list.length === 0 ? 0 : list[list.length - 1].position + 1;
  return tx.buyerInsight.create({ data: { productId: args.productId, kind: args.kind, text, position } });
}

export async function updateInsight(tx: Tx, args: { productId: string; id: string; text: string }) {
  const text = cleanInsight(args.text);
  const r = await tx.buyerInsight.updateMany({ where: { id: args.id, productId: args.productId }, data: { text } });
  if (r.count === 0) throw new ResearchError('Ese ítem ya no existe.');
}

export async function deleteInsight(tx: Tx, args: { productId: string; id: string }) {
  await tx.buyerInsight.deleteMany({ where: { id: args.id, productId: args.productId } });
}

/** Sube o baja un ítem un lugar dentro de su lista. */
export async function moveInsight(tx: Tx, args: { productId: string; id: string; direction: 'up' | 'down' }) {
  await lockInsights(tx, args.productId);
  const item = await tx.buyerInsight.findFirst({ where: { id: args.id, productId: args.productId } });
  if (!item) throw new ResearchError('Ese ítem ya no existe.');
  const list = await listKind(tx, args.productId, item.kind);
  const i = list.findIndex((x) => x.id === item.id);
  const j = args.direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  // Se renumera la lista entera: así el orden queda prolijo aunque haya posiciones repetidas.
  for (const [position, x] of list.entries()) {
    if (x.position !== position) await tx.buyerInsight.update({ where: { id: x.id }, data: { position } });
  }
}

// ───────────────────────────── Texto con formato ↔ texto simple ─────────────────────────────
// Para la conexión con Claude: lee y escribe el texto con formato como
// Markdown simple (**negrita**, _cursiva_, listas con "- " o "1. ").

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** El HTML limpio como Markdown simple. */
export function richTextToMarkdown(html: string | null): string {
  if (!html) return '';
  const lines: string[] = [];
  const lists: { ordered: boolean; n: number }[] = [];
  let line = '';
  const flush = () => {
    if (line.trim()) lines.push(line.replace(/\s+$/, ''));
    line = '';
  };
  for (const m of html.matchAll(/<(\/?)(p|br|strong|em|ul|ol|li)\s*\/?>|([^<]+)/g)) {
    const [, close, tag, text] = m;
    if (text !== undefined) {
      line += decode(text);
      continue;
    }
    if (tag === 'strong') line += '**';
    else if (tag === 'em') line += '_';
    else if (tag === 'br') flush();
    else if (tag === 'ul' || tag === 'ol') {
      flush();
      if (close) lists.pop();
      else lists.push({ ordered: tag === 'ol', n: 0 });
    } else if (tag === 'li' && !close) {
      flush();
      const list = lists[lists.length - 1];
      if (list) list.n++;
      line = `${'  '.repeat(Math.max(0, lists.length - 1))}${list?.ordered ? `${list.n}. ` : '- '}`;
    } else if (tag === 'p' && close && lists.length === 0) flush();
    else if (tag === 'li' && close) flush();
  }
  flush();
  return lines.join('\n');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');

/** Markdown simple a HTML limpio. Vacío da null. */
export function markdownToRichText(md: string): string | null {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of md.split(/\r?\n/)) {
    const bullet = raw.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = raw.match(/^\s*\d+[.)]\s+(.*)$/);
    const item = bullet ?? numbered;
    if (item) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li><p>${inline(item[1].trim())}</p></li>`);
    } else {
      close();
      if (raw.trim()) out.push(`<p>${inline(raw.trim())}</p>`);
    }
  }
  close();
  return cleanRichText(out.join(''));
}

/** Saca las líneas que parecen precios o listas de precios, por si se pegaron en el texto del fabricante. */
export function withoutPrices(text: string | null): { text: string | null; hidden: number } {
  if (!text) return { text, hidden: 0 };
  const lines = text.split(/\r?\n/);
  const keep = lines.filter((l) => !/\$\s?\d|\b(precio|precios|costo|costos|lista de precios|usd|u\$s)\b/i.test(l));
  return { text: keep.join('\n'), hidden: lines.length - keep.length };
}

/** Reemplaza la lista entera de dolores u objeciones. */
export async function replaceInsights(tx: Tx, args: { productId: string; kind: InsightKind; texts: string[] }) {
  const texts = [...new Set(args.texts.map(cleanInsight))];
  if (texts.length > MAX_INSIGHTS) throw new ResearchError(`Hasta ${MAX_INSIGHTS} por lista.`);
  await lockInsights(tx, args.productId);
  await tx.buyerInsight.deleteMany({ where: { productId: args.productId, kind: args.kind } });
  if (texts.length > 0) {
    await tx.buyerInsight.createMany({
      data: texts.map((text, position) => ({ productId: args.productId, kind: args.kind, text, position })),
    });
  }
  return texts;
}
