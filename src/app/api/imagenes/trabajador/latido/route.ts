import { NextResponse } from 'next/server';
import { heartbeatSchema } from '@/domain/photo-contract';
import { prisma } from '@/lib/db';
import { heartbeat } from '@/lib/photo-queue';
import { workerRequest } from '@/lib/photo-worker-api';

// Mientras procesa, el trabajador avisa cada tanto que sigue. Si el paso ya
// no es suyo (se rehízo o se sacó la foto), se le dice para que lo deje.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await workerRequest(req, heartbeatSchema);
  if (!r.ok) return r.res;
  return NextResponse.json({ vigente: await heartbeat(prisma, r.workerId, r.body.id, r.body.turno) });
}
