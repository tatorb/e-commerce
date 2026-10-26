'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { actAsAdmin } from '@/lib/auth/guard';
import { logActivity } from '@/lib/activity';
import { TEAM_SECTION } from '@/domain/access';
import { revokeAllConnections, revokeConnection } from '@/lib/mcp/oauth';
import { createWorkerKey, revokeWorkerKey } from '@/lib/image-worker';
import { CryptoError } from '@/lib/crypto';
import { DriveError, disconnectDrive, saveDriveCredentials, startDriveAuthorization } from '@/lib/drive';
import { deleteVercelBatch, moveBatch, type MoveResult } from '@/lib/move-to-drive';
import { storageError } from '@/lib/stored-files';
import { sendEmail } from '@/lib/email';

// Cortar las conexiones de Claude, cada persona solo las suyas, la llave del
// trabajador de imágenes y la conexión con el Drive, que son del estudio y solo
// las tocan los administradores, y pasar al Drive lo que quedó guardado en Vercel.

type Result = { ok: true } | { ok: false; error: string };

export async function disconnectClaudeAction(tokenId: string): Promise<Result> {
  const user = await requireUser();
  const done = await revokeConnection(prisma, user.id, tokenId);
  if (done) await logActivity(prisma, { userId: user.id, section: TEAM_SECTION, summary: 'Cortó una conexión con Claude' });
  revalidatePath('/equipo');
  return done ? { ok: true } : { ok: false, error: 'Esa conexión ya no estaba activa.' };
}

export async function disconnectAllClaudeAction(): Promise<Result> {
  const user = await requireUser();
  await revokeAllConnections(prisma, user.id);
  await logActivity(prisma, { userId: user.id, section: TEAM_SECTION, summary: 'Cortó todas sus conexiones con Claude' });
  revalidatePath('/equipo');
  return { ok: true };
}

// ───────────────────────────── Trabajador de imágenes ─────────────────────────────

/** Crea la llave del trabajador de imágenes y corta la anterior. La llave se ve una sola vez. */
export async function createWorkerKeyAction(): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  return actAsAdmin({ does: 'Creó la llave del trabajador de imágenes' }, async () => {
    const user = await requireUser();
    const key = await createWorkerKey(prisma, user.id);
    revalidatePath('/equipo');
    return { ok: true, key };
  });
}

export async function revokeWorkerKeyAction(): Promise<Result> {
  return actAsAdmin({ does: 'Cortó la llave del trabajador de imágenes' }, async () => {
    await requireUser();
    const done = await revokeWorkerKey(prisma);
    revalidatePath('/equipo');
    return done ? { ok: true } : { ok: false, error: 'No había ninguna llave activa.' };
  });
}

// ───────────────────────────── Google Drive ─────────────────────────────

function driveFailure(e: unknown): { ok: false; error: string } {
  if (e instanceof DriveError || e instanceof CryptoError) return { ok: false, error: e.message };
  throw e;
}

/** Guarda el ID y la clave secreta del cliente de Google. Sin clave nueva, conserva la guardada. */
export async function saveDriveCredentialsAction(clientId: string, clientSecret: string | null): Promise<Result> {
  return actAsAdmin({ does: 'Guardó los datos de Google Drive' }, async () => {
    await requireUser();
    try {
      await saveDriveCredentials(prisma, { clientId: String(clientId ?? ''), clientSecret: clientSecret ? String(clientSecret) : null });
    } catch (e) {
      return driveFailure(e);
    }
    revalidatePath('/equipo');
    return { ok: true };
  });
}

/** El link para darle permiso a la app en Google. */
export async function startDriveConnectAction(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return actAsAdmin({}, async () => {
    const user = await requireUser();
    try {
      return { ok: true, url: await startDriveAuthorization(prisma, { userId: user.id }) };
    } catch (e) {
      return driveFailure(e);
    }
  });
}

export async function disconnectDriveAction(): Promise<Result> {
  return actAsAdmin({ does: 'Desconectó el Drive' }, async () => {
    await requireUser();
    try {
      await disconnectDrive(prisma);
    } catch (e) {
      return driveFailure(e);
    }
    revalidatePath('/equipo');
    return { ok: true };
  });
}

// ───────────────────────────── Lo guardado en Vercel ─────────────────────────────

// Cada tanda trabaja hasta este tiempo; la pantalla pide la siguiente.
const BATCH_MS = 45_000;

/** Pasa al Drive una tanda de lo que quedó en Vercel. */
export async function moveToDriveAction(): Promise<({ ok: true } & MoveResult) | { ok: false; error: string }> {
  return actAsAdmin({}, async () => {
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
  });
}

/** Borra de Vercel una tanda de archivos. Solo cuando ya pasó todo al Drive. */
export async function deleteVercelFilesAction(): Promise<{ ok: true; deleted: number; more: boolean } | { ok: false; error: string }> {
  return actAsAdmin({ does: 'Borró de Vercel archivos que ya estaban en el Drive' }, async () => {
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
  });
}

// ───────────────────────────── Mails ─────────────────────────────

/** Un mail de prueba al administrador, para ver que Resend quedó bien configurado. */
export async function sendTestEmailAction(): Promise<Result> {
  return actAsAdmin({ does: 'Mandó un mail de prueba' }, async (user) => {
    const r = await sendEmail({
      to: user.email,
      subject: 'Prueba de E-commerce Studio MRB',
      text: `Hola ${user.name},\n\nSi te llegó este mail, los avisos de las tareas ya pueden salir.`,
      html: `<p>Hola ${user.name.replace(/[<>&]/g, '')},</p><p>Si te llegó este mail, los avisos de las tareas ya pueden salir.</p>`,
      key: `prueba-${user.id}-${Date.now()}`,
    });
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
  });
}
