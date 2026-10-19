import { NextResponse } from 'next/server';
import { resultSchema } from '@/domain/photo-contract';
import { prisma } from '@/lib/db';
import { outputPathname, uploadedFile } from '@/lib/photo-files';
import { submitFailure, submitResult } from '@/lib/photo-queue';
import { workerRequest } from '@/lib/photo-worker-api';

// El trabajador entrega el paso: lo que hizo o por qué no pudo. La app
// comprueba que los archivos estén en el depósito y deja el paso esperando
// la aprobación.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await workerRequest(req, resultSchema);
  if (!r.ok) return r.res;
  const outcome = r.body.ok
    ? await submitResult(prisma, r.workerId, r.body, { verify: uploadedFile, pathnameFor: outputPathname })
    : await submitFailure(prisma, r.workerId, r.body);
  return NextResponse.json(outcome);
}
