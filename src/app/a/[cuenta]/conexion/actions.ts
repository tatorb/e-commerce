'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';
import { runProbe } from '@/lib/research';

/** Prueba desde el servidor de la app qué se puede leer del canal. */
export async function runProbeAction(accountSlug: string, channelId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const account = await getAccountBySlug(accountSlug);
  if (!account) return { ok: false, error: 'La cuenta no existe.' };
  const store = await prisma.store.findFirst({
    where: { accountId: account.id, channelId },
    select: { channel: { select: { id: true, kind: true } } },
  });
  if (!store) return { ok: false, error: 'La cuenta no tiene tienda en ese canal.' };
  await runProbe(prisma, store.channel);
  revalidatePath(`/a/${accountSlug}`, 'layout');
  return { ok: true };
}
