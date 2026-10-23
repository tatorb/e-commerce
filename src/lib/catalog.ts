import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';

// Encuentra publicaciones de la lista de Publicaciones a partir de links o códigos pegados.
// Cada canal limpia lo suyo (src/channels/): acá solo se busca.

const MAX_CODES = 200;

export type ResolvedCodes = {
  // Publicaciones encontradas, en el orden en que se pegaron.
  ids: string[];
  // Códigos que se entienden pero no están en Publicaciones.
  notFound: string[];
  // Lo que no parece un link ni un código de ningún canal.
  invalid: string[];
};

export async function resolveExternalIds(db: PrismaClient, accountId: string, text: string): Promise<ResolvedCodes> {
  const tokens = [...new Set(text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))].slice(0, MAX_CODES);
  const stores = await db.store.findMany({
    where: { accountId },
    select: { id: true, channel: { select: { kind: true, name: true } } },
  });

  const out: ResolvedCodes = { ids: [], notFound: [], invalid: [] };
  for (const token of tokens) {
    let understood: string | null = null;
    let foundId: string | null = null;
    for (const store of stores) {
      const r = getChannelAdapter(store.channel.kind, store.channel.name).normalizeExternalId(token);
      if (!r.ok) continue;
      understood ??= r.value;
      const pub = await db.publication.findFirst({
        where: { storeId: store.id, externalId: r.value },
        select: { id: true },
      });
      if (pub) {
        foundId = pub.id;
        break;
      }
    }
    if (foundId) {
      if (!out.ids.includes(foundId)) out.ids.push(foundId);
    } else if (understood) {
      if (!out.notFound.includes(understood)) out.notFound.push(understood);
    } else {
      out.invalid.push(token);
    }
  }
  return out;
}
