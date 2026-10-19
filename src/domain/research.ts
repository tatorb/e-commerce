import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { InsightKind } from '@/generated/prisma/enums';

// La investigación del producto que se junta en el paso Información: lo del
// fabricante, las aclaraciones para las imágenes, las preguntas de los
// compradores y los dolores y objeciones. Es del producto, como la ficha, y
// no sabe nada de canales.

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
  ownQuestions?: string | null;
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
