'use client';

// Lo del navegador para las notificaciones: registrar el service worker,
// pedir el permiso y suscribirse. Todo devuelve un motivo en palabras simples
// cuando no se puede.

export type PushSupport =
  | { kind: 'ok' }
  // iPhone o iPad desde Safari, sin instalar la app en la pantalla de inicio.
  | { kind: 'ios-install' }
  | { kind: 'unsupported' };

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function standalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return { kind: 'unsupported' };
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIos() && !standalone()) return { kind: 'ios-install' };
  return has ? { kind: 'ok' } : { kind: 'unsupported' };
}

export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** "iPhone · Safari", para reconocer el dispositivo en la lista. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Dispositivo';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua) || /CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador';
  return `${device} · ${browser}`;
}

export type SubscribeResult =
  | { ok: true; sub: { endpoint: string; p256dh: string; auth: string; label: string } }
  | { ok: false; error: string };

/** Pide el permiso y se suscribe. Tiene que llamarse al tocar un botón. */
export async function subscribe(publicKey: string): Promise<SubscribeResult> {
  const support = pushSupport();
  if (support.kind === 'ios-install') return { ok: false, error: 'En el iPhone, primero instalá la app: Compartir, Agregar a inicio. Después abrila desde el ícono.' };
  if (support.kind === 'unsupported') return { ok: false, error: 'Este navegador no puede recibir notificaciones.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'El navegador no dio permiso. Se cambia en los ajustes del navegador, en los permisos de este sitio.' };
  }
  const reg = await registerWorker();
  if (!reg) return { ok: false, error: 'El navegador no dejó instalar la parte que recibe las notificaciones.' };
  await navigator.serviceWorker.ready;
  try {
    const existing = await reg.pushManager.getSubscription();
    const s = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    const json = s.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { ok: false, error: 'El navegador no dio los datos de la suscripción.' };
    return { ok: true, sub: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, label: deviceLabel() } };
  } catch {
    return { ok: false, error: 'El navegador no aceptó la suscripción. Probá de nuevo.' };
  }
}

export async function unsubscribe(): Promise<string | null> {
  const s = await currentSubscription();
  if (!s) return null;
  const endpoint = s.endpoint;
  await s.unsubscribe().catch(() => undefined);
  return endpoint;
}
