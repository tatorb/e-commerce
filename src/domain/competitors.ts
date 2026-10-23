import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { parsePercent, parsePrice } from '@/domain/money';

// Publicaciones de la competencia que más venden, cargadas a mano en el paso
// Información. Sus títulos suman palabras al mapa del paso Título, y su
// precio, descuento, cuotas y envío sirven para comparar precios.

// Sin tope en la práctica: este es solo de protección.
export const MAX_COMPETITORS = 100;

// Las cuotas sin interés que se pueden elegir: 0 es sin cuotas.
export const INSTALLMENT_OPTIONS = [0, 3, 6, 9, 12] as const;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const competitorsSchema = z
  .array(
    z.object({
      url: z
        .string()
        .trim()
        .max(1000)
        .refine((v) => v === '' || isHttpUrl(v), 'El link tiene que empezar con http:// o https://')
        .transform((v) => (v === '' ? null : v)),
      title: z.string().trim().min(1, 'Falta el título de una publicación.').max(300),
      soldQuantity: z
        .union([z.string(), z.number(), z.null()])
        .transform((v, ctx) => {
          if (v === null || v === '') return null;
          const n = typeof v === 'number' ? v : Number(String(v).replace(/[.\s+]/g, ''));
          if (!Number.isInteger(n) || n < 0) {
            ctx.addIssue({ code: 'custom', message: 'Los vendidos tienen que ser un número, por ejemplo 150.' });
            return z.NEVER;
          }
          return n;
        }),
      sellerName: z
        .string()
        .trim()
        .max(200, 'El nombre del vendedor es muy largo.')
        .nullish()
        .transform((v) => v || null),
      listPrice: z
        .union([z.string(), z.number(), z.null()])
        .optional()
        .transform((v, ctx) => {
          const n = v === undefined || v === null ? null : typeof v === 'number' ? v : parsePrice(v);
          if (n === null) return null;
          if (n === 'invalid' || !Number.isFinite(n) || n <= 0 || n > 1_000_000_000) {
            ctx.addIssue({ code: 'custom', message: 'El precio de lista tiene que ser un número, por ejemplo 125.000.' });
            return z.NEVER;
          }
          return n;
        }),
      discountPct: z
        .union([z.string(), z.number(), z.null()])
        .optional()
        .transform((v, ctx) => {
          const n = v === undefined || v === null ? null : typeof v === 'number' ? v : parsePercent(v);
          if (n === null) return 0;
          if (n === 'invalid' || !Number.isFinite(n) || n < 0 || n >= 100) {
            ctx.addIssue({ code: 'custom', message: 'El descuento va de 0 a 99 %, por ejemplo 15.' });
            return z.NEVER;
          }
          return n;
        }),
      installments: z
        .union([z.string(), z.number(), z.null()])
        .optional()
        .transform((v, ctx) => {
          const n = v === undefined || v === null || v === '' ? 0 : Number(v);
          if (!(INSTALLMENT_OPTIONS as readonly number[]).includes(n)) {
            ctx.addIssue({ code: 'custom', message: 'Las cuotas sin interés son 3, 6, 9 o 12.' });
            return z.NEVER;
          }
          return n;
        }),
      freeShipping: z.boolean().optional().default(false),
      // El día, como 2026-10-23.
      surveyedAt: z
        .union([z.string(), z.null()])
        .optional()
        .transform((v, ctx) => {
          const text = (v ?? '').trim();
          if (text === '') return null;
          const date = new Date(`${text}T00:00:00Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
            ctx.addIssue({ code: 'custom', message: 'La fecha del relevamiento no se entiende.' });
            return z.NEVER;
          }
          return text;
        }),
      notes: z
        .string()
        .trim()
        .max(2000, 'Las notas pueden tener hasta 2000 letras.')
        .nullish()
        .transform((v) => v || null),
    }),
  )
  .max(MAX_COMPETITORS, `Hasta ${MAX_COMPETITORS} publicaciones.`);

export type CompetitorsInput = z.input<typeof competitorsSchema>;

export type CompetitorsOutput = z.output<typeof competitorsSchema>;

/** Los datos de cada publicación de la competencia, para leerlos de la base. */
export const COMPETITOR_SELECT = {
  title: true,
  url: true,
  soldQuantity: true,
  sellerName: true,
  listPrice: true,
  discountPct: true,
  installments: true,
  freeShipping: true,
  surveyedAt: true,
  notes: true,
} as const;

type StoredCompetitor = {
  title: string;
  url: string | null;
  soldQuantity: number | null;
  sellerName: string | null;
  listPrice: { toString(): string } | null;
  discountPct: { toString(): string };
  installments: number;
  freeShipping: boolean;
  surveyedAt: Date | null;
  notes: string | null;
};

/** Una fila guardada, lista para volver a guardarla, por ejemplo en otra publicación. */
export function storedCompetitor(c: StoredCompetitor): CompetitorsOutput[number] {
  return {
    title: c.title,
    url: c.url,
    soldQuantity: c.soldQuantity,
    sellerName: c.sellerName,
    listPrice: c.listPrice === null ? null : Number(c.listPrice.toString()),
    discountPct: Number(c.discountPct.toString()),
    installments: c.installments,
    freeShipping: c.freeShipping,
    surveyedAt: dayOf(c.surveyedAt),
    notes: c.notes,
  };
}

/**
 * Reemplaza la lista entera. Con `today`, las que tienen precio y no dicen de
 * qué día es quedan con la fecha de hoy.
 */
export async function saveCompetitors(
  tx: Prisma.TransactionClient,
  publicationId: string,
  rows: CompetitorsOutput,
  today?: string,
): Promise<void> {
  await tx.competitorListing.deleteMany({ where: { publicationId } });
  if (rows.length > 0) {
    await tx.competitorListing.createMany({
      data: rows.map(({ surveyedAt, ...r }, position) => {
        const day = surveyedAt ?? (r.listPrice !== null ? today : undefined);
        return { ...r, surveyedAt: day ? new Date(`${day}T00:00:00Z`) : null, publicationId, position };
      }),
    });
  }
}

// ───────────────────────────── Precios ─────────────────────────────

/** Lo que ofrece una publicación de la competencia. El descuento va en %, por ejemplo 15. */
export type CompetitorOffer = { listPrice: number; discountPct: number; installments: number; freeShipping: boolean };

export type OfferPrices = {
  // Lo que paga el comprador por el producto, con el descuento.
  finalPrice: number;
  // Cada cuota sin interés; null si no ofrece cuotas.
  installmentValue: number | null;
  // Lo que paga en total: suma el envío si no es gratis.
  effectivePrice: number;
};

export function offerPrices(offer: CompetitorOffer, shippingCost: number): OfferPrices {
  const finalPrice = offer.listPrice * (1 - offer.discountPct / 100);
  return {
    finalPrice,
    installmentValue: offer.installments > 0 ? finalPrice / offer.installments : null,
    effectivePrice: finalPrice + (offer.freeShipping ? 0 : shippingCost),
  };
}

type Numeric = number | string | { toString(): string };

/** La oferta de una fila guardada; null si no tiene precio de lista. */
export function offerOf(row: { listPrice: Numeric | null; discountPct: Numeric; installments: number; freeShipping: boolean }): CompetitorOffer | null {
  if (row.listPrice === null) return null;
  return {
    listPrice: Number(row.listPrice.toString()),
    discountPct: Number(row.discountPct.toString()),
    installments: row.installments,
    freeShipping: row.freeShipping,
  };
}

/** El día guardado como 2026-10-23. */
export function dayOf(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Cuántos días pasaron desde el relevamiento. Los dos días van como 2026-10-23. */
export function daysSince(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
}
