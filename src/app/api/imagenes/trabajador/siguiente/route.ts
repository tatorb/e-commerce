import { NextResponse } from 'next/server';
import { nextRequestSchema, type NextResponse as NextBody } from '@/domain/photo-contract';
import { prisma } from '@/lib/db';
import { withDriveToken } from '@/lib/drive';
import { baseUrlFrom } from '@/lib/mcp/oauth';
import { outputTransfers, photoOwner } from '@/lib/photo-files';
import { buildJob, claimNext, idlePollSeconds, POLL_BUSY_S, releaseClaim } from '@/lib/photo-queue';
import { fail, originalTransfer, workerRequest } from '@/lib/photo-worker-api';
import { storageError } from '@/lib/stored-files';

// El trabajador pregunta "¿hay algo para hacer?". Recibe un solo paso de una
// sola foto, con los permisos para bajar el original y subir lo que haga al
// Drive, o nada y cuándo volver a preguntar: cada minuto, o cada 5 segundos si
// alguien está trabajando en la línea. Cada pregunta cuenta como señal de vida.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await workerRequest(req, nextRequestSchema, (b) => ({ ...(b.info ?? {}), version: b.version ?? null }));
  if (!r.ok) return r.res;
  const claimed = await claimNext(prisma, r.workerId);
  if (!claimed) return NextResponse.json({ trabajo: null, volver_en: await idlePollSeconds(prisma) } satisfies NextBody);
  const base = baseUrlFrom(req);
  try {
    const job = await withDriveToken(prisma, (token, email) =>
      buildJob(prisma, claimed.runId, {
        protocol: r.body.protocolo,
        download: (edit) => originalTransfer(base, edit),
        uploads: async (run, kinds) =>
          outputTransfers(prisma, token, email, { owner: await photoOwner(prisma, run.productId), runId: run.runId, originalName: run.originalName, kinds }),
      }),
    );
    return NextResponse.json({ trabajo: job, volver_en: POLL_BUSY_S } satisfies NextBody);
  } catch (e) {
    const message = storageError(e);
    if (!message) throw e;
    // El paso vuelve a la cola: la Mac pregunta de nuevo en un rato.
    await releaseClaim(prisma, claimed.runId, r.workerId);
    return fail(503, message);
  }
}
