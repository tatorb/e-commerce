import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { VIDEO_PROTOCOLS } from '@/domain/video-edit';
import { prisma } from './db';
import { driveEmail, NOT_CONNECTED } from './drive';
import { verifyWorkerRequest } from './image-worker';

// Lo común a los pedidos del editor de videos de la Mac: la llave, que es la
// misma del trabajador de imágenes, la forma del mensaje y las respuestas de
// error, siempre con un texto para mostrar en la Mac.

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

const OUTDATED = 'El editor de videos está desactualizado: bajá la versión nueva y corré de nuevo bash instalar.sh.';

/** Lee el pedido, comprueba la versión y la llave. Devuelve el error listo para responder si algo no va. */
export async function videoWorkerRequest<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<{ ok: true; body: z.infer<S>; workerId: string } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: fail(400, 'Pedido inválido.') };
  }
  const protocol = raw && typeof raw === 'object' ? (raw as { protocolo?: unknown }).protocolo : undefined;
  if (!(VIDEO_PROTOCOLS as readonly unknown[]).includes(protocol)) return { ok: false, res: fail(409, OUTDATED) };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: fail(400, `Pedido inválido: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`) };
  const auth = await verifyWorkerRequest(prisma, req.headers.get('authorization'));
  if (!auth) return { ok: false, res: fail(401, 'La llave del trabajador no vale. Creá una nueva en Equipo y cargala en la Mac con bash configurar.sh.') };
  // Los videos se guardan en el Drive del estudio.
  if (!(await driveEmail(prisma))) return { ok: false, res: fail(503, NOT_CONNECTED) };
  return { ok: true, body: parsed.data, workerId: auth.workerId };
}
