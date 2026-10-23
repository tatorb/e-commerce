import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { channelFaceValues } from '@/domain/channel-sync';
import { titleOrUntitled } from '@/domain/publication-title';
import { applyQuantities, QuantityError, sameQuantities, parseQuantities, type QuantityChange } from '@/domain/quantities';

// Cambiar las cantidades disponibles en la app. Quedan como borrador, igual
// que el precio, y se suben desde Por subir. Lo que el canal maneja solo, como
// el stock en Full, no se toca. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

export type QuantitiesResult = {
  // Las que quedaron con el cambio para subir.
  saved: string[];
  // Las que no se cambiaron, con el motivo.
  skipped: { id: string; title: string; reason: string }[];
};

/**
 * Pone las cantidades: la misma en todas las medidas de cada publicación, o la
 * de cada medida por su clave. Parte de lo que tiene la app o, si no cambió
 * nada, de lo que se leyó del canal. Si queda igual que en el canal, la app
 * vuelve a seguir al canal.
 */
export async function saveQuantities(db: Db, args: { accountId: string; publicationIds: string[]; change: QuantityChange }): Promise<QuantitiesResult> {
  const publications = await db.publication.findMany({
    where: { id: { in: args.publicationIds }, product: { accountId: args.accountId } },
    select: {
      id: true,
      title: true,
      externalId: true,
      quantities: true,
      store: { select: { channel: { select: { kind: true, name: true } } } },
      channelCopy: {
        select: {
          title: true,
          description: true,
          attributes: true,
          photos: true,
          photoIds: true,
          variations: true,
          price: true,
          installments: true,
          discount: true,
          quantity: true,
          stockInChannel: true,
          missingSince: true,
        },
      },
    },
  });
  const result: QuantitiesResult = { saved: [], skipped: [] };
  const found = new Set(publications.map((p) => p.id));
  for (const id of args.publicationIds) if (!found.has(id)) result.skipped.push({ id, title: '', reason: 'No está en la cuenta.' });

  for (const p of publications) {
    const channelName = getChannelAdapter(p.store.channel.kind, p.store.channel.name).name;
    const skip = (reason: string) => result.skipped.push({ id: p.id, title: titleOrUntitled(p.title), reason });
    const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
    if (!p.externalId) {
      skip(`Todavía no está publicada: la cantidad se carga al crearla en ${channelName}.`);
      continue;
    }
    if (copy?.stockInChannel) {
      skip(`El stock lo maneja ${channelName}, por ejemplo porque está en Full.`);
      continue;
    }
    const inChannel = copy ? channelFaceValues(copy).quantity : null;
    const base = parseQuantities(p.quantities) ?? inChannel;
    if (!base) {
      skip(`Todavía no se leyó la cantidad de ${channelName}.`);
      continue;
    }
    let next;
    try {
      next = applyQuantities(base, args.change);
    } catch (e) {
      if (!(e instanceof QuantityError)) throw e;
      skip(e.message);
      continue;
    }
    // Igual que en el canal: no hay nada para subir.
    const quantities = sameQuantities(next, inChannel) ? Prisma.DbNull : (next as Prisma.InputJsonValue);
    await db.publication.update({ where: { id: p.id }, data: { quantities } });
    result.saved.push(p.id);
  }
  return result;
}
