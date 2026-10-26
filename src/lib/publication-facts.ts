import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { parseVariantListings, parseVariations, type VariantLike } from '@/domain/media';
import { singleMeasure } from '@/lib/stock-plan';

// Lo que conviene ver siempre arriba de una publicación: el código con el que
// se nombra el producto (por ejemplo SP-914), si tiene medidas y cuántas, y si
// la respuesta automática a los compradores está prendida.

type Db = PrismaClient | Prisma.TransactionClient;

export type MeasuresFact =
  // Varias medidas en la misma publicación del canal, o en la ficha si todavía no se publicó.
  | { kind: 'variants'; labels: string[] }
  // Una publicación por medida, que la app trata como una sola.
  | { kind: 'family'; labels: string[] }
  // Una publicación que vende una sola medida de un producto que tiene varias.
  | { kind: 'sole'; label: string }
  | { kind: 'none' };

export type PublicationFacts = { code: string | null; measures: MeasuresFact; autoAnswer: boolean };

export type FactsInput = {
  autoAnswer: boolean;
  externalId: string | null;
  variantListings: unknown;
  channelCopy: { variations: unknown; details: unknown; missingSince: Date | null } | null;
};

const labelOf = (v: VariantLike, i: number) => v.measure?.trim() || v.sku?.trim() || `Medida ${i + 1}`;

export function publicationFacts(pub: FactsInput, product: { partNumber: string | null; variants: VariantLike[] }): PublicationFacts {
  const skus = product.variants.map((v) => v.sku?.trim()).filter((s): s is string => Boolean(s));
  const code = product.partNumber?.trim() || (skus.length === 1 ? skus[0] : null);
  return { code, measures: measuresOf(pub, product), autoAnswer: pub.autoAnswer };
}

function measuresOf(pub: FactsInput, product: { variants: VariantLike[] }): MeasuresFact {
  const family = parseVariantListings(pub.variantListings);
  if (family.length >= 2) return { kind: 'family', labels: family.map(labelOf) };
  const copy = pub.channelCopy && !pub.channelCopy.missingSince ? pub.channelCopy : null;
  if (copy) {
    const variations = parseVariations(copy.variations);
    if (variations.length >= 2) return { kind: 'variants', labels: variations.map(labelOf) };
    const sole = variations.length === 0 ? singleMeasure(product, copy) : null;
    if (sole) return { kind: 'sole', label: labelOf(sole, 0) };
    return { kind: 'none' };
  }
  // Sin leer del canal: si todavía no se publicó, se va a crear con las medidas de la ficha.
  if (!pub.externalId && product.variants.length >= 2) return { kind: 'variants', labels: product.variants.map(labelOf) };
  return { kind: 'none' };
}

/** Las medidas en palabras: "2 medidas: STD y 0.50", "Solo la medida STD" o "Sin medidas". */
export function measuresText(m: MeasuresFact): string {
  if (m.kind === 'sole') return `Solo la medida ${m.label}`;
  if (m.kind === 'none') return 'Sin medidas';
  const list = m.labels.length > 1 ? `${m.labels.slice(0, -1).join(', ')} y ${m.labels[m.labels.length - 1]}` : m.labels[0];
  return `${m.labels.length} medidas: ${list}${m.kind === 'family' ? ', una publicación por medida' : ''}`;
}

const FACTS_SELECT = {
  id: true,
  autoAnswer: true,
  externalId: true,
  variantListings: true,
  channelCopy: { select: { variations: true, details: true, missingSince: true } },
  product: { select: { partNumber: true, variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
} satisfies Prisma.PublicationSelect;

/** Lo de arriba de varias publicaciones, por su id. */
export async function loadPublicationFacts(db: Db, publicationIds: string[]): Promise<Map<string, PublicationFacts>> {
  if (publicationIds.length === 0) return new Map();
  const rows = await db.publication.findMany({ where: { id: { in: publicationIds } }, select: FACTS_SELECT });
  return new Map(rows.map((r) => [r.id, publicationFacts(r, r.product)]));
}
