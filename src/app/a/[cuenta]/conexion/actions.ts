'use server';

import { act } from '@/lib/auth/guard';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { ConnectError } from '@/channels/connect';
import { CryptoError } from '@/lib/crypto';
import { disconnect, saveAppCredentials, startAuthorization } from '@/lib/connections';
import { runProbe } from '@/lib/research';
import { readSales } from '@/lib/stock';

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
  return act(accountSlug, { section: 'conexion', level: 'read' }, async () => {
    await requireUser();
    const store = await storeFor(accountSlug, storeId);
    if (!store) return NO_STORE;
    await runProbe(prisma, { channel: store.channel, storeId: store.id });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** Guarda el App ID y la clave secreta de la aplicación del cliente. Sin clave nueva, conserva la guardada. */
export async function saveAppCredentialsAction(
  accountSlug: string,
  storeId: string,
  appId: string,
  appSecret: string | null,
): Promise<Result> {
  return act(accountSlug, { section: 'conexion', does: 'Guardó los datos de la aplicación de la tienda' }, async () => {
    await requireUser();
    if (!(await storeFor(accountSlug, storeId))) return NO_STORE;
    try {
      await saveAppCredentials(prisma, { storeId, appId: String(appId ?? ''), appSecret: appSecret ? String(appSecret) : null });
    } catch (e) {
      return failure(e);
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** El link para dar permiso: para abrirlo ahora, o para mandárselo al cliente. */
export async function startConnectAction(
  accountSlug: string,
  storeId: string,
  shared: boolean,
): Promise<{ ok: true; url: string; expiresAt: Date } | { ok: false; error: string }> {
  return act(accountSlug, { section: 'conexion', does: 'Empezó a conectar la tienda con el canal' }, async () => {
    const user = await requireUser();
    if (!(await storeFor(accountSlug, storeId))) return NO_STORE as { ok: false; error: string };
    try {
      const r = await startAuthorization(prisma, { storeId, userId: user.id, shared: Boolean(shared) });
      return { ok: true, ...r };
    } catch (e) {
      return failure(e) as { ok: false; error: string };
    }
  });
}

export async function disconnectAction(accountSlug: string, storeId: string): Promise<Result> {
  return act(accountSlug, { section: 'conexion', does: 'Desconectó la tienda del canal' }, async () => {
    await requireUser();
    if (!(await storeFor(accountSlug, storeId))) return NO_STORE;
    try {
      await disconnect(prisma, storeId);
    } catch (e) {
      return failure(e);
    }
    revalidatePath(`/a/${accountSlug}`, 'layout');
    return { ok: true };
  });
}

/** Lee ahora las ventas de la tienda, para ver si ya tiene el permiso. */
export async function readSalesNowAction(accountSlug: string, storeId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  return act(accountSlug, { section: 'conexion', does: 'Leyó las ventas de la tienda' }, async () => {
    const store = await storeFor(accountSlug, storeId);
    if (!store) return { ok: false as const, error: 'La tienda no es de esta cuenta.' };
    const r = await readSales(prisma, { budgetMs: 20_000, storeId: store.id });
    const after = await prisma.store.findUnique({ where: { id: store.id }, select: { salesError: true, salesSince: true } });
    revalidatePath(`/a/${accountSlug}`, 'layout');
    if (after?.salesError) return { ok: false, error: after.salesError };
    if (!after?.salesSince) return { ok: false, error: 'No se pudo conectar con el canal. Probá de nuevo en un rato.' };
    return {
      ok: true,
      message: `Listo, lee las ventas. ${r.orders === 1 ? 'Llegó 1 venta reciente' : `Llegaron ${r.orders} ventas recientes`}${r.sent > 0 ? ` y se subió la cantidad a ${r.sent === 1 ? '1 publicación' : `${r.sent} publicaciones`}` : ''}.`,
    };
  });
}
