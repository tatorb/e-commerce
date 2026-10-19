import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { DuplicateExternalIdError, setPublicationCode } from '@/domain/publications';

// Cargar el código del canal de una publicación que ya se publicó. El canal
// limpia lo pegado, sea el código o el link, y arma el link; el resto de la
// app no conoce el formato. Lo usan el paso Publicación y Claude.

export type CodeResult = { ok: true; externalId: string; url: string | null } | { ok: false; error: string };

export async function savePublicationCode(
  db: PrismaClient,
  args: { accountId: string; publicationId: string; raw: string },
): Promise<CodeResult> {
  const pub = await db.publication.findFirst({
    where: { id: args.publicationId, product: { accountId: args.accountId } },
    select: { store: { select: { channel: { select: { kind: true, name: true } } } } },
  });
  if (!pub) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
  const adapter = getChannelAdapter(pub.store.channel.kind, pub.store.channel.name);
  const code = adapter.normalizeExternalId(String(args.raw ?? ''));
  if (!code.ok) return { ok: false, error: code.error };
  const url = adapter.publicationUrl(code.value);
  try {
    await db.$transaction((tx) => setPublicationCode(tx, { publicationId: args.publicationId, externalId: code.value, url }));
  } catch (e) {
    if (e instanceof DuplicateExternalIdError) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, externalId: code.value, url };
}
