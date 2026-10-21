'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { revokeAllConnections, revokeConnection } from '@/lib/mcp/oauth';
import { createWorkerKey, revokeWorkerKey } from '@/lib/image-worker';
import { CryptoError } from '@/lib/crypto';
import { DriveError, disconnectDrive, saveDriveCredentials, startDriveAuthorization } from '@/lib/drive';

// Cortar las conexiones de Claude, cada persona solo las suyas, la llave del
// trabajador de imágenes y la conexión con el Drive, que son del estudio.

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

// ───────────────────────────── Google Drive ─────────────────────────────

function driveFailure(e: unknown): { ok: false; error: string } {
  if (e instanceof DriveError || e instanceof CryptoError) return { ok: false, error: e.message };
  throw e;
}

/** Guarda el ID y la clave secreta del cliente de Google. Sin clave nueva, conserva la guardada. */
export async function saveDriveCredentialsAction(clientId: string, clientSecret: string | null): Promise<Result> {
  await requireUser();
  try {
    await saveDriveCredentials(prisma, { clientId: String(clientId ?? ''), clientSecret: clientSecret ? String(clientSecret) : null });
  } catch (e) {
    return driveFailure(e);
  }
  revalidatePath('/equipo');
  return { ok: true };
}

/** El link para darle permiso a la app en Google. */
export async function startDriveConnectAction(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    return { ok: true, url: await startDriveAuthorization(prisma, { userId: user.id }) };
  } catch (e) {
    return driveFailure(e);
  }
}

export async function disconnectDriveAction(): Promise<Result> {
  await requireUser();
  try {
    await disconnectDrive(prisma);
  } catch (e) {
    return driveFailure(e);
  }
  revalidatePath('/equipo');
  return { ok: true };
}
