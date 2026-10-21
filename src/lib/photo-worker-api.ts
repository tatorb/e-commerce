import { NextResponse } from 'next/server';
import type { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { PHOTO_PROTOCOL, type Transfer } from '@/domain/photo-contract';
import { prisma } from './db';
import { driveEmail, NOT_CONNECTED } from './drive';
import { signedDownloadUrl } from './files';
import { verifyWorkerRequest } from './image-worker';
import { LEASE_MS } from './photo-queue';
import { inVercel } from './stored-files';

// Lo común a los pedidos del trabajador de imágenes: la llave, la forma del
// mensaje y las respuestas de error, siempre con un texto para mostrar en la Mac.

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

const OUTDATED = `El trabajador de imágenes está desactualizado: bajá la versión nueva y corré de nuevo bash instalar.sh.`;

/** Lee el pedido, comprueba la versión y la llave. Devuelve el error listo para responder si algo no va. */
export async function workerRequest<S extends z.ZodType>(
  req: Request,
  schema: S,
  info?: (body: z.infer<S>) => Prisma.InputJsonObject | null,
): Promise<{ ok: true; body: z.infer<S>; workerId: string } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: fail(400, 'Pedido inválido.') };
  }
  const protocol = raw && typeof raw === 'object' ? (raw as { protocolo?: unknown }).protocolo : undefined;
  if (protocol !== PHOTO_PROTOCOL) return { ok: false, res: fail(409, OUTDATED) };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: fail(400, `Pedido inválido: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`) };
  const auth = await verifyWorkerRequest(prisma, req.headers.get('authorization'), new Date(), info?.(parsed.data) ?? null);
  if (!auth) {
    return {
      ok: false,
      res: fail(401, 'La llave del trabajador no vale. Creá una nueva en Equipo y cargala en la Mac con bash configurar.sh.'),
    };
  }
  // Las fotos se guardan en el Drive del estudio.
  if (!(await driveEmail(prisma))) return { ok: false, res: fail(503, NOT_CONNECTED) };
  return { ok: true, body: parsed.data, workerId: auth.workerId };
}

/**
 * Cómo baja el trabajador el original: a través de la app, que lo lee del
 * Drive. Si todavía está en el depósito de Vercel, con un link firmado.
 */
export async function originalTransfer(base: string, edit: { id: string; originalUrl: string }): Promise<Transfer> {
  const throughApp: Transfer = { url: `${base}/api/imagenes/trabajador/original?foto=${encodeURIComponent(edit.id)}`, metodo: 'GET', encabezados: {} };
  if (!inVercel(edit.originalUrl)) return throughApp;
  try {
    return { url: await signedDownloadUrl(edit.originalUrl, LEASE_MS * 2), metodo: 'GET', encabezados: {} };
  } catch (e) {
    console.error('No se pudo firmar el link del original; se baja a través de la app.', e);
    return throughApp;
  }
}
