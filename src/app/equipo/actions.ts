'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { revokeAllConnections, revokeConnection } from '@/lib/mcp/oauth';
import { createWorkerKey, revokeWorkerKey } from '@/lib/image-worker';

// Cortar las conexiones de Claude, cada persona solo las suyas, y la llave
// del trabajador de imágenes, que es del estudio.

type Result = { ok: true } | { ok: false; error: string };

export async function disconnectClaudeAction(tokenId: string): Promise<Result> {
  const user = await requireUser();
  const done = await revokeConnection(prisma, user.id, tokenId);
  revalidatePath('/equipo');
  return done ? { ok: true } : { ok: false, error: 'Esa conexión ya no estaba activa.' };
}

export async function disconnectAllClaudeAction(): Promise<Result> {
  const user = await requireUser();
  await revokeAllConnections(prisma, user.id);
  revalidatePath('/equipo');
  return { ok: true };
}

// ───────────────────────────── Trabajador de imágenes ─────────────────────────────

/** Crea la llave del trabajador de imágenes y corta la anterior. La llave se ve una sola vez. */
export async function createWorkerKeyAction(): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const key = await createWorkerKey(prisma, user.id);
  revalidatePath('/equipo');
  return { ok: true, key };
}

export async function revokeWorkerKeyAction(): Promise<Result> {
  await requireUser();
  const done = await revokeWorkerKey(prisma);
  revalidatePath('/equipo');
  return done ? { ok: true } : { ok: false, error: 'No había ninguna llave activa.' };
}
