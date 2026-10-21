'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { revokeAllConnections, revokeConnection } from '@/lib/mcp/oauth';
import { createWorkerKey, revokeWorkerKey } from '@/lib/image-worker';
import { CryptoError } from '@/lib/crypto';
import { DriveError, disconnectDrive, saveDriveCredentials, startDriveAuthorization } from '@/lib/drive';
import { deleteVercelBatch, moveBatch, type MoveResult } from '@/lib/move-to-drive';
import { storageError } from '@/lib/stored-files';

// Cortar las conexiones de Claude, cada persona solo las suyas, la llave del
// trabajador de imágenes y la conexión con el Drive, que son del estudio, y
// pasar al Drive lo que quedó guardado en Vercel.

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

// ───────────────────────────── Lo guardado en Vercel ─────────────────────────────

// Cada tanda trabaja hasta este tiempo; la pantalla pide la siguiente.
const BATCH_MS = 45_000;

/** Pasa al Drive una tanda de lo que quedó en Vercel. */
export async function moveToDriveAction(): Promise<({ ok: true } & MoveResult) | { ok: false; error: string }> {
  await requireUser();
  try {
    const r = await moveBatch(prisma, { budgetMs: BATCH_MS });
    revalidatePath('/equipo');
    return { ok: true, ...r };
  } catch (e) {
    const message = storageError(e);
    if (message) return { ok: false, error: message };
    throw e;
  }
}

/** Borra de Vercel una tanda de archivos. Solo cuando ya pasó todo al Drive. */
export async function deleteVercelFilesAction(): Promise<{ ok: true; deleted: number; more: boolean } | { ok: false; error: string }> {
  await requireUser();
  try {
    const r = await deleteVercelBatch(prisma, { budgetMs: BATCH_MS });
    revalidatePath('/equipo');
    return { ok: true, ...r };
  } catch (e) {
    const message = storageError(e) ?? (e instanceof Error && /blob/i.test(e.message) ? 'Vercel no dejó borrar los archivos. Probá de nuevo en un rato.' : null);
    if (message) return { ok: false, error: message };
    throw e;
  }
}
