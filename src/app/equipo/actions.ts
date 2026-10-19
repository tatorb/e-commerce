'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { revokeAllConnections, revokeConnection } from '@/lib/mcp/oauth';

// Cortar las conexiones de Claude. Cada persona corta solo las suyas.

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
