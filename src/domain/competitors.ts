import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';

// Publicaciones de la competencia que más venden, cargadas a mano en el paso
// Información. Sus títulos suman palabras al mapa del paso Título.

// Sin tope en la práctica: este es solo de protección.
export const MAX_COMPETITORS = 100;

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
    }),
  )
  .max(MAX_COMPETITORS, `Hasta ${MAX_COMPETITORS} publicaciones.`);

export type CompetitorsInput = z.input<typeof competitorsSchema>;

/** Reemplaza la lista entera. */
export async function saveCompetitors(
  tx: Prisma.TransactionClient,
  publicationId: string,
  rows: z.output<typeof competitorsSchema>,
): Promise<void> {
  await tx.competitorListing.deleteMany({ where: { publicationId } });
  if (rows.length > 0) {
    await tx.competitorListing.createMany({ data: rows.map((r, position) => ({ ...r, publicationId, position })) });
  }
}
