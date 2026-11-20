import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { parseRejections } from '@/domain/channel-sync';
import { channelFamilyNameOf, comparableText } from '@/domain/families';

// El título aprobado en el paso Título que no llegó al canal: la app lo
// escribe en la publicación, pero sube recién con push_titles o desde Por
// subir. Si nadie lo sube, el canal sigue con el viejo sin que nadie se entere.

type Db = PrismaClient | Prisma.TransactionClient;

export type TitleNotPushed = {
  // sin_subir: el canal tiene otro y no se intentó; rechazado: se intentó y el canal no lo tomó.
  kind: 'sin_subir' | 'rechazado';
  approved: string;
  inChannel: string | null;
  approvedAt: Date;
  approvedBy: string | null;
  reason: string | null;
};

/** El aviso en una línea, para las tarjetas. */
export function titleNotPushedText(t: TitleNotPushed): string {
  return t.kind === 'rechazado' ? `Título rechazado por el canal: ${t.reason ?? 'sin motivo'}` : 'Título aprobado sin subir';
}

/**
 * Las publicaciones con el último título aprobado distinto del que leyó la app
 * del canal. Solo cuenta si la publicación sigue con ese título: si después se
 * cambió, el aviso es el borrador de siempre. En una familia, el canal muestra
 * el nombre de la familia. Sin publicationIds, todas las de la cuenta.
 */
export async function titlesNotPushed(db: Db, args: { accountId: string; publicationIds?: string[] }): Promise<Map<string, TitleNotPushed>> {
  const rows = await db.publication.findMany({
    where: {
      product: { accountId: args.accountId },
      ...(args.publicationIds ? { id: { in: args.publicationIds } } : {}),
      externalId: { not: null },
      titleApprovals: { some: { outcome: 'WRITTEN' } },
      channelCopy: { is: { missingSince: null, status: { notIn: ['CLOSED', 'DELETED'] } } },
    },
    select: {
      id: true,
      title: true,
      channelCopy: { select: { title: true, details: true, rejections: true } },
      titleApprovals: { orderBy: { createdAt: 'desc' }, take: 1, select: { outcome: true, title: true, createdAt: true, user: { select: { name: true } } } },
    },
  });
  const out = new Map<string, TitleNotPushed>();
  for (const r of rows) {
    const last = r.titleApprovals[0];
    if (!last || last.outcome !== 'WRITTEN' || !last.title || !r.channelCopy) continue;
    if (comparableText(r.title ?? '') !== comparableText(last.title)) continue;
    const inChannel = channelFamilyNameOf(r.channelCopy.details) ?? r.channelCopy.title;
    if (inChannel && comparableText(inChannel) === comparableText(last.title)) continue;
    const rejection = parseRejections(r.channelCopy.rejections).title;
    out.set(r.id, {
      kind: rejection ? 'rechazado' : 'sin_subir',
      approved: last.title,
      inChannel,
      approvedAt: last.createdAt,
      approvedBy: last.user?.name ?? null,
      reason: rejection?.message ?? null,
    });
  }
  return out;
}

/**
 * Después de aprobar un título: si no está en el canal, deja una nota en la
 * publicación para que el equipo lo vea, y devuelve el aviso. La app no lo
 * sube sola: va con push_titles o desde Por subir.
 */
export async function noteTitleNotPushed(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; userId: string | null; viaClaude: boolean; timeZone: string },
): Promise<TitleNotPushed | null> {
  const t = (await titlesNotPushed(db, { accountId: args.accountId, publicationIds: [args.publicationId] })).get(args.publicationId);
  if (!t) return null;
  const day = new Intl.DateTimeFormat('es-AR', { timeZone: args.timeZone, dateStyle: 'short' }).format(t.approvedAt);
  const { addNote } = await import('@/lib/publication-notes');
  await addNote(db, {
    accountId: args.accountId,
    publicationId: args.publicationId,
    authorId: args.userId,
    viaClaude: args.viaClaude,
    input: {
      text: `Aviso automático: el título aprobado el ${day} salió del paso Título sin subirse al canal. Falta subirlo con push_titles o desde Por subir. Aprobado: «${t.approved}». En el canal: «${t.inChannel ?? 'sin título'}».`,
    },
  });
  return t;
}
