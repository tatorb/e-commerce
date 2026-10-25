import type { PrismaClient } from '@/generated/prisma/client';
import type { ActivityKind, ActivitySource } from '@/generated/prisma/enums';
import { titleOrUntitled } from '@/domain/publication-title';

// Anotar lo que hace cada persona: los cambios que guarda y sus ingresos.
// Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Lo más largo que se guarda de un dato.
const MAX_DETAIL = 500;

export type ActivityEntry = {
  userId: string | null;
  email?: string | null;
  accountId?: string | null;
  kind?: ActivityKind;
  section?: string | null;
  summary: string;
  publicationId?: string | null;
  productId?: string | null;
  // Sobre qué, cuando no es una publicación ni un producto: por ejemplo otro usuario.
  targetLabel?: string | null;
  detail?: string | null;
  via?: ActivitySource;
};

const clip = (text: string | null | undefined) => {
  const t = text?.replace(/\s+/g, ' ').trim();
  return t ? (t.length > MAX_DETAIL ? `${t.slice(0, MAX_DETAIL - 1)}…` : t) : null;
};

/** Cómo se llama ahora lo que se tocó, para que se entienda aunque después se borre. */
async function labelOf(db: Db, e: ActivityEntry): Promise<{ label: string | null; productId: string | null }> {
  if (e.publicationId) {
    const p = await db.publication.findUnique({ where: { id: e.publicationId }, select: { title: true, externalId: true, productId: true } });
    if (p) return { label: `${titleOrUntitled(p.title)}${p.externalId ? ` · ${p.externalId}` : ''}`, productId: e.productId ?? p.productId };
  }
  if (e.productId) {
    const p = await db.product.findUnique({ where: { id: e.productId }, select: { name: true } });
    if (p) return { label: p.name, productId: e.productId };
  }
  return { label: null, productId: e.productId ?? null };
}

/** Anota una entrada. Si no puede, lo dice en los logs del servidor pero no corta lo que se estaba haciendo. */
export async function logActivity(db: Db, e: ActivityEntry): Promise<void> {
  try {
    const target = await labelOf(db, e);
    await db.activityLog.create({
      data: {
        userId: e.userId,
        email: e.email ?? null,
        accountId: e.accountId ?? null,
        kind: e.kind ?? 'CHANGE',
        section: e.section ?? null,
        summary: e.summary,
        publicationId: e.publicationId ?? null,
        productId: target.productId,
        targetLabel: clip(e.targetLabel ?? target.label),
        detail: clip(e.detail),
        via: e.via ?? 'APP',
      },
    });
  } catch (err) {
    console.error('No se pudo anotar la actividad', err instanceof Error ? err.message : err);
  }
}
