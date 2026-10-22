import {
  grayFromRgba,
  halfSource,
  LiveError,
  liveRenderer,
  readLivePackage,
  rgbaFrom,
  type LiveEdits,
  type LiveFile,
  type LiveSource,
  type MacPart,
  type Raster,
} from '@/domain/photo-live';

// La vista en vivo se dibuja acá, aparte de la pantalla: mientras se hacen
// las cuentas, los controles no se traban. Baja el paquete, lo lee una vez y
// dibuja cada vez que llegan valores nuevos, solo los últimos. Mientras los
// valores cambian, dibuja una copia a la mitad, que es más rápida; cuando se
// quedan quietos, la foto entera.

export type WorkerIn = { kind: 'open'; href: string; mac: { parts: MacPart[]; background: string } } | { kind: 'edits'; edits: LiveEdits };
export type WorkerOut =
  | { kind: 'frame'; w: number; h: number; rgba: Uint8ClampedArray<ArrayBuffer>; notes: string[] }
  | { kind: 'error'; message: string };

const FAILED = 'No se pudo abrir la foto para editar en vivo. Probá de nuevo en un rato.';
const OLD_BROWSER = 'Este navegador no puede editar en vivo. Actualizalo o probá con otro.';
// Cuánto esperar quieto para dibujar la foto entera.
const SETTLE_MS = 150;

const post = (m: WorkerOut, transfer: Transferable[] = []) => (self as unknown as { postMessage(m: WorkerOut, t: Transferable[]): void }).postMessage(m, transfer);

async function pixels(file: LiveFile): Promise<ImageData> {
  if (typeof OffscreenCanvas === 'undefined') throw new LiveError(OLD_BROWSER);
  const blob = new Blob([file.bytes as Uint8Array<ArrayBuffer>], { type: file.type });
  // Sin convertir colores: la foto ya está en sRGB y las cuentas son las de la Mac.
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new LiveError(OLD_BROWSER);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function load(href: string): Promise<LiveSource> {
  const res = await fetch(href);
  if (!res.ok) throw new LiveError((await res.text().catch(() => '')) || FAILED);
  const pkg = readLivePackage(await res.arrayBuffer());
  const { header } = pkg;
  const photos = new Set([header.base, ...(header.lente ?? []).map((v) => v.imagen)]);
  const images: (Raster | null)[] = await Promise.all(
    pkg.files.map(async (f, i) => {
      if (!photos.has(i)) return null;
      const d = await pixels(f);
      return { w: d.width, h: d.height, rgba: d.data };
    }),
  );
  let silhouette = null;
  if (header.silueta) {
    const d = await pixels(pkg.files[header.silueta.imagen]);
    silhouette = grayFromRgba(d.width, d.height, d.data);
  }
  return { pkg, images, silhouette };
}

type Renderer = ReturnType<typeof liveRenderer>;
let renderers: { full: Renderer; quick: Renderer } | null = null;
let latest: LiveEdits | null = null;
let drawnFull = false;
let ticking = false;
let settle: ReturnType<typeof setTimeout> | null = null;

function draw(render: Renderer, edits: LiveEdits) {
  try {
    const { image, notes } = render(edits);
    const rgba = rgbaFrom(image);
    post({ kind: 'frame', w: image.w, h: image.h, rgba, notes }, [rgba.buffer]);
  } catch (e) {
    if (!(e instanceof LiveError)) console.error('Editar en vivo: no se pudo dibujar.', e);
    post({ kind: 'error', message: e instanceof LiveError ? e.message : FAILED });
  }
}

// Los valores que llegaron mientras se dibujaba se juntan: se dibujan solo los últimos.
function tick() {
  ticking = false;
  if (!renderers || !latest) return;
  const edits = latest;
  if (!drawnFull) {
    drawnFull = true;
    draw(renderers.full, edits);
    return;
  }
  draw(renderers.quick, edits);
  settle = setTimeout(() => {
    settle = null;
    if (renderers && latest === edits) draw(renderers.full, edits);
  }, SETTLE_MS);
}

function schedule() {
  if (settle) {
    clearTimeout(settle);
    settle = null;
  }
  if (!ticking) {
    ticking = true;
    setTimeout(tick, 0);
  }
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.kind === 'edits') {
    latest = m.edits;
    schedule();
    return;
  }
  try {
    const source = await load(m.href);
    renderers = { full: liveRenderer(source, m.mac), quick: liveRenderer(halfSource(source), m.mac) };
    schedule();
  } catch (err) {
    if (!(err instanceof LiveError)) console.error('Editar en vivo: no se pudo abrir el paquete.', err);
    post({ kind: 'error', message: err instanceof LiveError ? err.message : FAILED });
  }
};
