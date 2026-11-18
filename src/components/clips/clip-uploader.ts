'use client';

import { useSyncExternalStore } from 'react';
import { markClipUploadedAction } from '@/app/a/[cuenta]/pipeline/video-actions';

// La conversación con la extensión de Chrome de Studio MRB, que sube los clips
// a Mercado Libre desde el navegador de la persona. Vive fuera de las
// pantallas: así el avance de una subida se ve en cualquier parte y no se
// pierde cuando la pantalla se vuelve a dibujar. Cuando Mercado Libre ya tiene
// el video, lo anota como subido.

/** Lo que hace falta para pedir una subida. */
export type ClipUploadAsk = { publicationId: string; videoId: string; externalId: string; fileName: string; mimeType: string; allMeasures: boolean };

/** La clave de una subida: el mismo clip puede subirse una vez por medida. */
export const uploadKey = (c: { publicationId: string; videoId: string }) => `${c.publicationId}:${c.videoId}`;
// Los informes se juntan, para copiarlos si algo no sale.
export type ClipProgress = { text: string | null; error: string | null; done: boolean; uploaded: boolean; reports: unknown[] };

type FromExtension = { origen?: string; tipo?: string; version?: string; sola?: boolean; publicacion?: string; video?: string; texto?: string | null; error?: string | null; listo?: boolean; subido?: boolean; informe?: unknown };
// queue: si la extensión de este navegador sube sola la cola.
type State = { extension: string | null; queue: boolean; progress: Record<string, ClipProgress> };

let state: State = { extension: null, queue: false, progress: {} };
const EMPTY: State = { extension: null, queue: false, progress: {} };
const listeners = new Set<() => void>();
// Qué cuenta y qué hacer al terminar, por cada subida pedida desde esta pestaña.
const asked = new Map<string, { accountSlug: string; allMeasures: boolean; onUploaded?: () => void }>();
let listening = false;

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

const BLANK: ClipProgress = { text: null, error: null, done: false, uploaded: false, reports: [] };
const setProgress = (key: string, p: Partial<ClipProgress>) => set({ ...state, progress: { ...state.progress, [key]: { ...(state.progress[key] ?? BLANK), ...p } } });

function hear(e: MessageEvent<FromExtension>) {
  if (e.source !== window || e.origin !== window.location.origin || e.data?.origen !== 'mrb-clips') return;
  const d = e.data;
  if (d.tipo === 'hola' && d.version) {
    if (state.extension !== d.version || state.queue !== (d.sola === true)) set({ ...state, extension: d.version, queue: d.sola === true });
    return;
  }
  if (d.tipo !== 'avance' || !d.publicacion || !d.video) return;
  const key = uploadKey({ publicationId: d.publicacion, videoId: d.video });
  const before = state.progress[key];
  setProgress(key, { text: d.texto ?? null, error: d.error ?? null, done: d.listo === true, reports: d.informe ? [...(before?.reports ?? []), d.informe] : (before?.reports ?? []) });
  if (d.subido !== true) return;
  // Mercado Libre ya tiene el video: se anota solo.
  const from = asked.get(key);
  if (!from) return;
  markClipUploadedAction(from.accountSlug, d.publicacion, d.video, true, !from.allMeasures).then(
    (r) => {
      if (!r.ok) return setProgress(key, { error: `Se subió a Mercado Libre, pero no se pudo anotar acá: ${r.error} Tocá Ya lo subí.` });
      setProgress(key, { uploaded: true });
      from.onUploaded?.();
    },
    () => setProgress(key, { error: 'Se subió a Mercado Libre, pero se cortó la conexión con la app al anotarlo. Tocá Ya lo subí.' }),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listening) {
    listening = true;
    window.addEventListener('message', hear);
    window.postMessage({ origen: 'mrb-app', tipo: 'hola' }, window.location.origin);
  }
  return () => listeners.delete(listener);
}

/** La extensión, si está en este navegador, y cómo va cada subida. */
export function useClipUploader(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

/** Si la extensión está en este navegador. Fuera de un componente. */
export const hasClipExtension = () => state.extension !== null;

/** Le pide a la extensión que suba el clip. `onUploaded` corre cuando Mercado Libre ya lo tiene y quedó anotado. */
export function askClipUpload(accountSlug: string, ask: ClipUploadAsk, onUploaded?: () => void) {
  const key = uploadKey(ask);
  asked.set(key, { accountSlug, allMeasures: ask.allMeasures, onUploaded });
  setProgress(key, { text: 'Pidiendo la subida a la extensión…', error: null, done: false, uploaded: false, reports: [] });
  window.postMessage(
    {
      origen: 'mrb-app',
      tipo: 'subir',
      publicacion: ask.publicationId,
      video: ask.videoId,
      codigo: ask.externalId,
      nombre: ask.fileName,
      tipoDeArchivo: ask.mimeType,
      todasLasVariantes: ask.allMeasures,
    },
    window.location.origin,
  );
}

/** Prende o apaga que la extensión de este navegador suba sola la cola. */
export function setClipQueue(on: boolean) {
  window.postMessage({ origen: 'mrb-app', tipo: 'cola', sola: on }, window.location.origin);
}
