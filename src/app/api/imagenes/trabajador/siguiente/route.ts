import { NextResponse } from 'next/server';
import { nextRequestSchema, type NextResponse as NextBody } from '@/domain/photo-contract';
import { prisma } from '@/lib/db';
import { baseUrlFrom } from '@/lib/mcp/oauth';
import { outputPathname, uploadTransfer } from '@/lib/photo-files';
import { buildJob, claimNext, idlePollSeconds, LEASE_MS, POLL_BUSY_S } from '@/lib/photo-queue';
import { originalTransfer, workerRequest } from '@/lib/photo-worker-api';

// El trabajador pregunta "¿hay algo para hacer?". Recibe un solo paso de una
// sola foto, con los permisos para bajar el original y subir lo que haga, o
// nada y cuándo volver a preguntar: cada minuto, o cada 5 segundos si alguien
// está trabajando en la línea. Cada pregunta cuenta como señal de vida.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await workerRequest(req, nextRequestSchema, (b) => ({ ...(b.info ?? {}), version: b.version ?? null }));
  if (!r.ok) return r.res;
  const claimed = await claimNext(prisma, r.workerId);
  if (!claimed) return NextResponse.json({ trabajo: null, volver_en: await idlePollSeconds(prisma) } satisfies NextBody);
  const base = baseUrlFrom(req);
  const job = await buildJob(prisma, claimed.runId, {
    download: (edit) => originalTransfer(base, edit),
    upload: (kind, pathname) => uploadTransfer(kind, pathname, LEASE_MS * 2),
    pathnameFor: outputPathname,
  });
  return NextResponse.json({ trabajo: job, volver_en: POLL_BUSY_S } satisfies NextBody);
}
