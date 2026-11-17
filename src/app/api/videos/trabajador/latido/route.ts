import { NextResponse } from 'next/server';
import { editorAllows, videoHeartbeatSchema } from '@/domain/video-edit';
import { prisma } from '@/lib/db';
import { editHeartbeat, loadEditorSettings } from '@/lib/video-edits';
import { videoWorkerRequest } from '@/lib/video-worker-api';

// Mientras edita, la Mac avisa cada tanto que sigue. Si la edición ya no es
// suya (se pidió de nuevo o se descartó), o si se apagó la edición de videos
// en Equipo, se le dice para que la deje.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await videoWorkerRequest(req, videoHeartbeatSchema);
  if (!r.ok) return r.res;
  const settings = await loadEditorSettings(prisma);
  // Apagar corta el trabajo en curso. El horario no: lo que empezó, termina.
  const off = editorAllows({ ...settings, mode: settings.mode === 'OFF' ? 'OFF' : 'ON', pluggedOnly: false }, { minute: null, plugged: null });
  const mine = await editHeartbeat(prisma, r.workerId, r.body.id, r.body.turno);
  return NextResponse.json({ vigente: mine && off.allowed, ...(mine && !off.allowed ? { motivo: off.reason } : {}) });
}
