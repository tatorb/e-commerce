import { NextResponse } from 'next/server';
import { resultSchema } from '@/domain/photo-contract';
import { prisma } from '@/lib/db';
import { withDriveToken } from '@/lib/drive';
import { runOutputs } from '@/lib/photo-files';
import { submitFailure, submitResult } from '@/lib/photo-queue';
import { fail, workerRequest } from '@/lib/photo-worker-api';
import { storageError } from '@/lib/stored-files';

// El trabajador entrega el paso: lo que hizo o por qué no pudo. La app
// comprueba que los archivos estén en el Drive y deja el paso esperando la
// aprobación.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await workerRequest(req, resultSchema);
  if (!r.ok) return r.res;
  try {
    const outcome = r.body.ok
      ? await submitResult(prisma, r.workerId, r.body, { collect: (run) => withDriveToken(prisma, (token) => runOutputs(token, run.runId)) })
      : await submitFailure(prisma, r.workerId, r.body);
    return NextResponse.json(outcome);
  } catch (e) {
    const message = storageError(e);
    if (!message) throw e;
    // La Mac vuelve a entregar en un rato.
    return fail(503, message);
  }
}
