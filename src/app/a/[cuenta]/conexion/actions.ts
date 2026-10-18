'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { ConnectError } from '@/channels/connect';
import { CryptoError } from '@/lib/crypto';
import { disconnect, saveAppCredentials, startAuthorization } from '@/lib/connections';
import { runProbe } from '@/lib/research';

type Result = { ok: true } | { ok: false; error: string };

async function storeFor(accountSlug: string, storeId: string) {
  const account = await getAccountBySlug(accountSlug);
  if (!account) return null;
  return prisma.store.findFirst({
    where: { id: storeId, accountId: account.id },
    select: { id: true, channel: { select: { id: true, kind: true } } },
  });
}

const NO_STORE: Result = { ok: false, error: 'La tienda no es de esta cuenta.' };

function failure(e: unknown): Result {
  if (e instanceof ConnectError || e instanceof CryptoError) return { ok: false, error: e.message };
  throw e;
}

/** Prueba desde el servidor de la app qué se puede leer del canal, y con la cuenta conectada si la hay. */
export async function runProbeAction(accountSlug: string, storeId: string): Promise<Result> {
  await requireUser();
  const store = await storeFor(accountSlug, storeId);
  if (!store) return NO_STORE;
  await runProbe(prisma, { channel: store.channel, storeId: store.id });
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}

/** Guarda el App ID y la clave secreta de la aplicación del cliente. Sin clave nueva, conserva la guardada. */
export async function saveAppCredentialsAction(
  accountSlug: string,
  storeId: string,
  appId: string,
  appSecret: string | null,
): Promise<Result> {
  await requireUser();
  if (!(await storeFor(accountSlug, storeId))) return NO_STORE;
  try {
    await saveAppCredentials(prisma, { storeId, appId: String(appId ?? ''), appSecret: appSecret ? String(appSecret) : null });
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}

/** El link para dar permiso: para abrirlo ahora, o para mandárselo al cliente. */
export async function startConnectAction(
  accountSlug: string,
  storeId: string,
  shared: boolean,
): Promise<{ ok: true; url: string; expiresAt: Date } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!(await storeFor(accountSlug, storeId))) return NO_STORE as { ok: false; error: string };
  try {
    const r = await startAuthorization(prisma, { storeId, userId: user.id, shared: Boolean(shared) });
    return { ok: true, ...r };
  } catch (e) {
    return failure(e) as { ok: false; error: string };
  }
}

export async function disconnectAction(accountSlug: string, storeId: string): Promise<Result> {
  await requireUser();
  if (!(await storeFor(accountSlug, storeId))) return NO_STORE;
  try {
    await disconnect(prisma, storeId);
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}
