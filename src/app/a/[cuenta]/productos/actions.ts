'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getChannelAdapter } from '@/channels';
import { parsePrice } from '@/domain/money';
import { dropEmptyRows, productInputSchema, saveProduct, type ProductInput } from '@/domain/products';
import { assertNotInCombos, ComboError } from '@/domain/combos';
import {
  createPublication,
  DuplicateExternalIdError,
  publicationDataSchema,
  updatePublication,
  type PublicationData,
} from '@/domain/publications';
import type { NameValue } from '@/domain/name-value';
import type { ChannelStatus } from '@/generated/prisma/enums';

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

async function accountIdFor(slug: string): Promise<string | null> {
  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } });
  return account?.id ?? null;
}

export async function saveProductAction(
  accountSlug: string,
  productId: string | null,
  input: ProductInput,
): Promise<SaveResult> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };

  const parsed = productInputSchema.safeParse(dropEmptyRows(input));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };

  try {
    const { id } = await saveProduct(prisma, { accountId, productId, data: parsed.data });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true, id };
  } catch (e) {
    if (e instanceof ComboError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deleteProductAction(accountSlug: string, productId: string): Promise<SimpleResult> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  let count = 0;
  try {
    count = await prisma.$transaction(async (tx) => {
      await assertNotInCombos(tx, productId);
      return (await tx.product.deleteMany({ where: { id: productId, accountId } })).count;
    });
  } catch (e) {
    if (e instanceof ComboError) return { ok: false, error: e.message };
    throw e;
  }
  if (count === 0) return { ok: false, error: 'El producto ya no existe.' };
  revalidatePath(`/a/${accountSlug}/productos`);
  return { ok: true };
}

export type PublicationFormInput = {
  externalId: string;
  url: string;
  title: string;
  description: string;
  attributes: NameValue[];
  price: string;
  channelStatus: ChannelStatus;
};

/**
 * Pasa lo que escribió la persona por las reglas del canal (ID y link) y
 * por las reglas generales de la publicación.
 */
function toPublicationData(
  channel: { kind: Parameters<typeof getChannelAdapter>[0]; name: string },
  input: PublicationFormInput,
): { ok: true; data: PublicationData } | { ok: false; error: string } {
  const adapter = getChannelAdapter(channel.kind, channel.name);

  let externalId: string | null = null;
  if (input.externalId.trim()) {
    const normalized = adapter.normalizeExternalId(input.externalId);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    externalId = normalized.value;
  }

  let url: string | null = input.url.trim() || null;
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    } catch {
      return { ok: false, error: 'El link tiene que empezar con http:// o https://' };
    }
  } else if (externalId) {
    url = adapter.publicationUrl(externalId);
  }

  const price = parsePrice(input.price);
  if (price === 'invalid') return { ok: false, error: 'No se entiende el precio. Escribilo así: 125.000 o 125.000,50' };

  if (adapter.titleMaxLength && input.title.trim().length > adapter.titleMaxLength) {
    return { ok: false, error: `En ${adapter.name} el título puede tener hasta ${adapter.titleMaxLength} caracteres.` };
  }

  const parsed = publicationDataSchema.safeParse({
    externalId,
    url,
    title: input.title,
    description: input.description,
    attributes: input.attributes,
    price,
    channelStatus: input.channelStatus,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  return { ok: true, data: parsed.data };
}

export async function createPublicationAction(
  accountSlug: string,
  productId: string,
  storeId: string,
  input: PublicationFormInput,
): Promise<SimpleResult> {
  const user = await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };

  const [product, store] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, accountId }, select: { id: true } }),
    prisma.store.findFirst({ where: { id: storeId, accountId }, include: { channel: true } }),
  ]);
  if (!product) return { ok: false, error: 'El producto no existe en esta cuenta.' };
  if (!store) return { ok: false, error: 'La tienda no existe en esta cuenta.' };

  const result = toPublicationData(store.channel, input);
  if (!result.ok) return result;

  try {
    await createPublication(prisma, { productId, storeId, data: result.data, userId: user.id });
  } catch (e) {
    if (e instanceof DuplicateExternalIdError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/a/${accountSlug}/productos`);
  return { ok: true };
}

export async function updatePublicationAction(
  accountSlug: string,
  publicationId: string,
  input: PublicationFormInput,
): Promise<SimpleResult> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };

  const publication = await prisma.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    include: { store: { include: { channel: true } } },
  });
  if (!publication) return { ok: false, error: 'La publicación no existe en esta cuenta.' };

  const result = toPublicationData(publication.store.channel, input);
  if (!result.ok) return result;

  try {
    await updatePublication(prisma, { publicationId, data: result.data });
  } catch (e) {
    if (e instanceof DuplicateExternalIdError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath(`/a/${accountSlug}/productos`);
  return { ok: true };
}
