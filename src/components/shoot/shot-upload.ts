import { useSyncExternalStore } from 'react';
import { uploadToDrive } from '@/components/drive/upload';
import type { MediaKind } from '@/domain/shoot';
import type { BrowserMeasure } from '@/lib/videos';
import { finishShotPhotoAction, finishShotVideoAction, startShotUploadAction } from '@/app/a/[cuenta]/registro-productos/actions';

// La foto o el video que se está subiendo en Registro de productos, uno por
// vez. Vive fuera de la pantalla: el operario puede pasar al paso siguiente, o
// a otro producto, mientras sube. Mientras no termina bien no se saca otra,
// porque abrir la cámara puede hacer que el celular cierre el navegador y se
// pierda. Está solo en la memoria de la página: no se guarda nada en el celular.

export type ShotUpload = {
  key: number;
  accountSlug: string;
  productId: string;
  // Cómo se nombra el producto en el aviso, por si el operario ya pasó a otro.
  productLabel: string;
  stepId: string | null;
  stepTitle: string | null;
  variantKey: string | null;
  kind: MediaKind;
  file: File;
  name: string;
  video: BrowserMeasure | null;
  // La vista previa en el celular, hasta que la pantalla tiene la guardada.
  url: string;
  status: 'uploading' | 'failed' | 'done';
  percent: number;
  saving: boolean;
  error: string | null;
  // El archivo ya en el Drive: si falla al anotarlo, se reintenta sin subirlo de nuevo.
  fileId: string | null;
  // La foto o el video guardado, cuando terminó.
  savedId: string | null;
};

type NewUpload = Pick<ShotUpload, 'accountSlug' | 'productId' | 'productLabel' | 'stepId' | 'stepTitle' | 'variantKey' | 'kind' | 'file' | 'name' | 'video'>;

let current: ShotUpload | null = null;
let seq = 0;
const listeners = new Set<() => void>();

/** Si hay una subida que todavía no terminó bien: mientras tanto no se saca otra. */
export const blocksCamera = (u: ShotUpload | null): boolean => u !== null && u.status !== 'done';

// Antes de cerrar la página con algo sin subir, el navegador pregunta.
const warn = (e: BeforeUnloadEvent) => e.preventDefault();

function set(next: ShotUpload | null) {
  if (current && current.url !== next?.url) URL.revokeObjectURL(current.url);
  const warned = blocksCamera(current);
  current = next;
  if (blocksCamera(current) !== warned) {
    if (warned) window.removeEventListener('beforeunload', warn);
    else window.addEventListener('beforeunload', warn);
  }
  for (const l of listeners) l();
}

function update(key: number, patch: Partial<ShotUpload>) {
  if (current?.key === key) set({ ...current, ...patch });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useShotUpload(): ShotUpload | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/** Empieza a subir. Si hay otra sin terminar bien, no hace nada y devuelve false. */
export function startShotUpload(u: NewUpload): boolean {
  if (blocksCamera(current)) return false;
  const key = ++seq;
  set({ ...u, key, url: URL.createObjectURL(u.file), status: 'uploading', percent: 0, saving: false, error: null, fileId: null, savedId: null });
  void run(key);
  return true;
}

async function run(key: number) {
  const u = current;
  if (!u || u.key !== key) return;
  try {
    let fileId = u.fileId;
    if (!fileId) {
      const start = await startShotUploadAction(u.accountSlug, u.productId, u.kind, { name: u.name, size: u.file.size, type: u.file.type });
      if (!start.ok) throw new Error(start.error);
      fileId = await uploadToDrive(u.file, start.uploadUrl, (sent) => update(key, { percent: Math.min(99, Math.floor((sent / u.file.size) * 100)) }));
      update(key, { fileId });
    }
    update(key, { saving: true });
    const r =
      u.kind === 'PHOTO'
        ? await finishShotPhotoAction(u.accountSlug, { productId: u.productId, fileId, stepId: u.stepId, variantKey: u.variantKey })
        : await finishShotVideoAction(u.accountSlug, { productId: u.productId, fileId, size: u.file.size, measure: u.video, stepId: u.stepId, variantKey: u.variantKey });
    if (!r.ok) throw new Error(r.error);
    update(key, { status: 'done', saving: false, percent: 100, savedId: r.id });
  } catch (e) {
    update(key, { status: 'failed', saving: false, error: e instanceof Error && e.message ? e.message : 'No se pudo subir. Revisá la conexión y probá de nuevo.' });
  }
}

export function retryShotUpload() {
  if (current?.status !== 'failed') return;
  const key = current.key;
  set({ ...current, status: 'uploading', percent: current.fileId ? 99 : 0, error: null });
  void run(key);
}

/** Saca de la memoria la que falló, sin subirla. */
export function discardShotUpload() {
  if (current?.status === 'failed') set(null);
}

/** Suelta la que terminó cuando la pantalla ya muestra la guardada. */
export function releaseShotUpload(savedId: string) {
  if (current?.status === 'done' && current.savedId === savedId) set(null);
}
