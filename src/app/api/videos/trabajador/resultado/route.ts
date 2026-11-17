import { NextResponse } from 'next/server';
import { videoResultSchema } from '@/domain/video-edit';
import { prisma } from '@/lib/db';
import { withDriveToken } from '@/lib/drive';
import { storageError } from '@/lib/stored-files';
import { uploadedClip } from '@/lib/video-edit-files';
import { submitEditFailure, submitEditResult } from '@/lib/video-edits';
import { fail, videoWorkerRequest } from '@/lib/video-worker-api';

// La Mac entrega la edición: el clip que armó o por qué no pudo. La app
// comprueba que el clip esté en el Drive y lo deja esperando la aprobación.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await videoWorkerRequest(req, videoResultSchema);
  if (!r.ok) return r.res;
  try {
    const outcome = r.body.ok
      ? await submitEditResult(prisma, r.workerId, r.body, { collect: (edit) => withDriveToken(prisma, (token) => uploadedClip(token, edit.editId)) })
      : await submitEditFailure(prisma, r.workerId, r.body);
    return NextResponse.json(outcome);
  } catch (e) {
    const message = storageError(e);
    if (!message) throw e;
    // La Mac vuelve a entregar en un rato.
    return fail(503, message);
  }
}
