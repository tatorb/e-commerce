// Subida de un video al Drive desde el navegador, de a partes. Primero prueba
// hablar directo con Google; si el navegador no puede, manda las partes por la
// app (/api/drive/subida), más chicas. Si se corta, le pregunta a Google hasta
// dónde llegó y sigue desde ahí.

import type { BrowserMeasure } from '@/lib/videos';

// Las partes tienen que ser múltiplos de 256 KB, salvo la última.
const DIRECT_PART = 8 * 1024 * 1024;
const PROXY_PART = 4 * 1024 * 1024;
const MAX_FAILURES = 5;

type Mode = 'direct' | 'proxy';
type PartResult = { kind: 'more'; next: number } | { kind: 'done'; fileId: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hasta dónde guardó Google, según el encabezado Range ("bytes=0-1234"). */
function nextFrom(range: string | null, fallback: number): number {
  const m = range?.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : fallback;
}

async function sendPart(mode: Mode, url: string, body: Blob | null, contentRange: string, assumeNext: number): Promise<PartResult> {
  if (mode === 'direct') {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Range': contentRange }, body });
    if (res.status === 308) return { kind: 'more', next: nextFrom(res.headers.get('range'), assumeNext) };
    if (res.ok) {
      const file = (await res.json()) as { id?: string };
      if (file.id) return { kind: 'done', fileId: file.id };
    }
    throw new UploadFailure(res.status);
  }
  const res = await fetch('/api/drive/subida', {
    method: 'PUT',
    headers: { 'x-upload-url': url, 'x-content-range': contentRange },
    body,
  });
  const r = (await res.json().catch(() => null)) as { status?: number; range?: string | null; file?: { id?: string } | null; error?: string } | null;
  if (!res.ok || !r?.status) throw new UploadFailure(res.status, r?.error);
  if (r.status === 308) return { kind: 'more', next: nextFrom(r.range ?? null, assumeNext) };
  if ((r.status === 200 || r.status === 201) && r.file?.id) return { kind: 'done', fileId: r.file.id };
  throw new UploadFailure(r.status);
}

class UploadFailure extends Error {
  constructor(
    readonly status: number,
    message?: string,
  ) {
    super(message ?? `Google respondió con un error (código ${status}).`);
  }
}

/** Sube el archivo y devuelve el id del archivo en el Drive. */
export async function uploadToDrive(file: File, uploadUrl: string, onProgress: (sent: number) => void): Promise<string> {
  const size = file.size;
  // Antes de mandar nada, pregunta directo hasta dónde llegó: si el navegador
  // no puede hablar con Google, va por la app desde el principio.
  let mode: Mode = 'direct';
  let offset = 0;
  try {
    const probe = await sendPart('direct', uploadUrl, null, `bytes */${size}`, 0);
    if (probe.kind === 'done') return probe.fileId;
    offset = probe.next;
  } catch {
    mode = 'proxy';
  }
  let failures = 0;
  for (;;) {
    const part = mode === 'direct' ? DIRECT_PART : PROXY_PART;
    const end = Math.min(offset + part, size);
    try {
      const r = await sendPart(mode, uploadUrl, file.slice(offset, end), `bytes ${offset}-${end - 1}/${size}`, end);
      if (r.kind === 'done') {
        onProgress(size);
        return r.fileId;
      }
      offset = r.next;
      failures = 0;
      onProgress(offset);
    } catch (e) {
      // La subida venció o Google la cerró: no tiene arreglo.
      if (e instanceof UploadFailure && (e.status === 404 || e.status === 410 || e.status === 400 || e.status === 401)) {
        throw new Error('Google cerró la subida. Probá de nuevo.');
      }
      failures++;
      if (failures > MAX_FAILURES) throw new Error('Se cortó la subida varias veces. Revisá la conexión y probá de nuevo.');
      // Directo no anduvo: sigue por la app.
      if (mode === 'direct' && !(e instanceof UploadFailure)) mode = 'proxy';
      else await sleep(1000 * 2 ** (failures - 1));
      // Hasta dónde llegó, por si guardó algo antes de cortarse. Si ya estaba
      // entero, Google devuelve el archivo.
      try {
        const s = await sendPart(mode, uploadUrl, null, `bytes */${size}`, offset);
        if (s.kind === 'done') return s.fileId;
        offset = s.next;
      } catch {
        // Se vuelve a probar desde donde estaba.
      }
    }
  }
}

/** El ancho, el alto y la duración como los ve el navegador, con el giro del teléfono aplicado. Null si no lo puede leer. */
export function measureVideo(src: string | File, timeoutMs = 15_000): Promise<BrowserMeasure | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    let settled = false;
    const done = (m: BrowserMeasure | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(m);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const ok = video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.duration) && video.duration > 0;
      done(ok ? { width: video.videoWidth, height: video.videoHeight, durationMs: Math.round(video.duration * 1000) } : null);
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}
