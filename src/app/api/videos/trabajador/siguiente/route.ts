import { NextResponse } from 'next/server';
import { editorAllows, videoNextSchema, type Transfer, type VideoNextResponse } from '@/domain/video-edit';
import { prisma } from '@/lib/db';
import { withDriveToken } from '@/lib/drive';
import { baseUrlFrom } from '@/lib/mcp/oauth';
import { storageError } from '@/lib/stored-files';
import { clipUpload, videosFolderPath } from '@/lib/video-edit-files';
import { buildVideoJob, claimNextEdit, loadEditorSettings, pendingEdits, releaseEditClaim, VIDEO_POLL_BUSY_S, VIDEO_POLL_IDLE_S } from '@/lib/video-edits';
import { fail, videoWorkerRequest } from '@/lib/video-worker-api';

// La Mac pregunta "¿hay un video para editar?". Cuenta su hora y si está
// enchufada: la app decide si puede editar ahora, según lo que se eligió en
// Equipo. Recibe una sola edición, con los permisos para bajar el original y
// subir el clip, o nada, por qué y cuándo volver a preguntar.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await videoWorkerRequest(req, videoNextSchema);
  if (!r.ok) return r.res;
  const allowed = editorAllows(await loadEditorSettings(prisma), { minute: r.body.minuto ?? null, plugged: r.body.enchufada ?? null });
  if (!allowed.allowed) return NextResponse.json({ trabajo: null, volver_en: VIDEO_POLL_IDLE_S, motivo: allowed.reason } satisfies VideoNextResponse);
  const claimed = await claimNextEdit(prisma, r.workerId);
  if (!claimed) {
    const waiting = await pendingEdits(prisma);
    return NextResponse.json({ trabajo: null, volver_en: waiting > 0 ? VIDEO_POLL_BUSY_S : VIDEO_POLL_IDLE_S } satisfies VideoNextResponse);
  }
  const base = baseUrlFrom(req);
  const download = (videoId: string, which: 'original' | 'liviana'): Transfer => ({
    url: `${base}/api/videos/trabajador/original?video=${encodeURIComponent(videoId)}&cual=${which}`,
    metodo: 'GET',
    encabezados: {},
  });
  try {
    const job = await withDriveToken(prisma, (token, email) =>
      buildVideoJob(prisma, claimed.editId, {
        folderPath: (productId) => videosFolderPath(prisma, productId),
        download,
        upload: (args) => clipUpload(prisma, token, email, args),
      }),
    );
    return NextResponse.json({ trabajo: job, volver_en: VIDEO_POLL_BUSY_S } satisfies VideoNextResponse);
  } catch (e) {
    const message = storageError(e);
    if (!message) throw e;
    // La edición vuelve a la cola: la Mac pregunta de nuevo en un rato.
    await releaseEditClaim(prisma, claimed.editId, r.workerId);
    return fail(503, message);
  }
}
