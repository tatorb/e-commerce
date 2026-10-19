import { createHash } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import { randomToken } from '@/lib/crypto';

// La llave del trabajador de imágenes. Es una sola para todo el estudio: la
// crea alguien del equipo en Equipo, se muestra una sola vez y se pega en la
// Mac. En la base se guarda solo su huella, como las llaves de Claude
// (src/lib/mcp/oauth.ts). Recibe la base por parámetro para poder probarlo
// con una base de prueba.

const KEY_PREFIX = 'mrbimg_';
// Sin señales en este tiempo, la app lo muestra desconectado. Pregunta cada
// minuto cuando no tiene trabajo.
export const CONNECTED_WITHIN_MS = 3 * 60 * 1000;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Crea la llave y corta la anterior. Devuelve la llave: es la única vez que se ve. */
export async function createWorkerKey(db: PrismaClient, userId: string | null, now = new Date()): Promise<string> {
  const key = `${KEY_PREFIX}${randomToken(32)}`;
  await db.$transaction([
    db.imageWorker.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } }),
    db.imageWorker.create({ data: { keyHash: hash(key), keyHint: key.slice(-4), createdById: userId } }),
  ]);
  return key;
}

export async function revokeWorkerKey(db: PrismaClient, now = new Date()): Promise<boolean> {
  const r = await db.imageWorker.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } });
  return r.count > 0;
}

/** El trabajador dueño de la llave del pedido, si la llave vale. Anota la señal. */
export async function verifyWorkerRequest(
  db: PrismaClient,
  authorization: string | null,
  now = new Date(),
  info?: Prisma.InputJsonValue | null,
): Promise<{ workerId: string } | null> {
  const key = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? '';
  if (!key.startsWith(KEY_PREFIX)) return null;
  const row = await db.imageWorker.findUnique({ where: { keyHash: hash(key) }, select: { id: true, revokedAt: true } });
  if (!row || row.revokedAt) return null;
  await db.imageWorker.update({ where: { id: row.id }, data: { lastSeenAt: now, ...(info ? { info } : {}) } });
  return { workerId: row.id };
}

export type WorkerInfo = { version?: string; modelo_fondo?: string | null; memoria_gb?: number | null; sistema?: string | null; aviso?: string | null };

export type WorkerState =
  | { kind: 'none' }
  | { kind: 'connected' | 'disconnected' | 'never'; keyHint: string; createdAt: Date; lastSeenAt: Date | null; info: WorkerInfo };

/** Si hay llave y si el trabajador dio señales hace poco. */
export async function workerState(db: PrismaClient, now = new Date()): Promise<WorkerState> {
  const row = await db.imageWorker.findFirst({ where: { revokedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!row) return { kind: 'none' };
  const info = (row.info && typeof row.info === 'object' && !Array.isArray(row.info) ? row.info : {}) as WorkerInfo;
  const kind = !row.lastSeenAt
    ? 'never'
    : now.getTime() - row.lastSeenAt.getTime() <= CONNECTED_WITHIN_MS
      ? 'connected'
      : 'disconnected';
  return { kind, keyHint: row.keyHint, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, info };
}
