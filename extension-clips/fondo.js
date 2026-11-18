// El fondo de la extensión: recibe el pedido de la app, abre la publicación en
// Mercado Libre, le pasa el archivo del clip a esa pestaña de a pedazos y le
// cuenta a la app cómo va. No guarda contraseñas ni lee nada de Mercado Libre
// fuera de la pestaña que abrió para subir el clip.

const LISTADO = 'https://www.mercadolibre.com.ar/publicaciones/listado?search=';
const CODIGO = /^M[A-Z]{2}\d{6,}$/;
const ID = /^[A-Za-z0-9_-]{6,64}$/;
// Los orígenes de la app que pueden pedir una subida: los mismos del manifiesto.
const APPS = chrome.runtime.getManifest().content_scripts[0].matches.map((m) => new URL(m.replace('/*', '/')));
const esDeLaApp = (origen) => {
  try {
    const u = new URL(origen);
    return APPS.some((a) => a.protocol === u.protocol && a.hostname === u.hostname);
  } catch {
    return false;
  }
};

const clave = (tabId) => `trabajo:${tabId}`;
const leer = async (tabId) => (await chrome.storage.session.get(clave(tabId)))[clave(tabId)] ?? null;
const guardar = (trabajo) => chrome.storage.session.set({ [clave(trabajo.pestana)]: trabajo });
const borrar = (tabId) => chrome.storage.session.remove(clave(tabId));

function avisar(trabajo, datos) {
  // Un clip de la cola no tiene una pestaña de la app esperándolo: el resultado va a la app.
  if (trabajo.deCola) {
    if (datos.error || datos.subido) terminarDeCola(trabajo, datos);
    return;
  }
  chrome.tabs.sendMessage(trabajo.pestanaApp, { tipo: 'avance', publicacion: trabajo.publicacion, video: trabajo.video, ...datos }).catch(() => {});
}

async function empezar(pedido, sender) {
  const origen = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
  if (!sender.tab || !origen || !esDeLaApp(origen)) return { ok: false, error: 'Este pedido no viene de la app.' };
  return abrir(pedido, { origen, pestanaApp: sender.tab.id, deCola: false });
}

// Abre la publicación en Mercado Libre y deja anotado el trabajo de esa pestaña.
async function abrir(pedido, de) {
  const origen = de.origen;
  const codigo = String(pedido.codigo ?? '').trim().toUpperCase();
  if (!CODIGO.test(codigo)) return { ok: false, error: 'El código de la publicación no vale.' };
  if (!ID.test(String(pedido.video ?? '')) || !ID.test(String(pedido.publicacion ?? ''))) return { ok: false, error: 'El pedido no vale.' };
  // Un clip de la cola se sube en una ventana aparte que no toma el foco: así no
  // interrumpe a la persona, y la página se dibuja entera, cosa que no pasa en una pestaña de fondo.
  const url = LISTADO + encodeURIComponent(codigo);
  const pestana = de.deCola ? (await chrome.windows.create({ url, focused: false, type: 'normal', width: 1200, height: 850 })).tabs[0] : await chrome.tabs.create({ url, active: true });
  await guardar({
    pestana: pestana.id,
    pestanaApp: de.pestanaApp,
    deCola: de.deCola,
    origen,
    codigo,
    publicacion: pedido.publicacion,
    video: pedido.video,
    nombre: String(pedido.nombre ?? 'clip.mp4').slice(0, 200),
    tipoDeArchivo: String(pedido.tipoDeArchivo ?? 'video/mp4').slice(0, 60),
    // Si el video se ve en todas las medidas del producto o solo en la de esta publicación.
    todas: pedido.todasLasVariantes !== false,
    etapa: 'listado',
  });
  return { ok: true, pestana: pestana.id };
}

// Un pedazo del clip, pedido a la app con la sesión de la persona.
async function pedazo(trabajo, desde) {
  const res = await fetch(`${trabajo.origen}/api/drive/videos/${encodeURIComponent(trabajo.video)}`, {
    headers: { Range: `bytes=${desde}-` },
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 401) return { ok: false, error: 'La sesión de la app está cerrada: entrá de nuevo a la app.' };
  if (!res.ok) return { ok: false, error: `La app no entregó el clip (código ${res.status}).` };
  const bytes = new Uint8Array(await res.arrayBuffer());
  const rango = res.headers.get('content-range')?.match(/bytes (\d+)-(\d+)\/(\d+)/);
  const total = rango ? Number(rango[3]) : desde + bytes.length;
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { ok: true, datos: btoa(texto), desde, hasta: desde + bytes.length, total };
}

chrome.runtime.onMessage.addListener((mensaje, sender, responder) => {
  (async () => {
    if (mensaje?.tipo === 'subir') return empezar(mensaje, sender);
    // La app pregunta o cambia si la extensión sube sola la cola.
    if (mensaje?.tipo === 'cola') {
      const origen = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
      if (!origen || !esDeLaApp(origen)) return { ok: false };
      // La app desde la que se usa, para preguntarle por la cola.
      await chrome.storage.local.set({ origenApp: origen });
      if (typeof mensaje.sola === 'boolean') {
        await chrome.storage.local.set({ sola: mensaje.sola, despuesDe: 0 });
        if (mensaje.sola) atenderCola().catch(() => {});
      }
      return { ok: true, sola: (await ajustes()).sola };
    }
    const trabajo = sender.tab ? await leer(sender.tab.id) : null;
    if (mensaje?.tipo === 'trabajo') return trabajo;
    if (!trabajo) return { ok: false, error: 'Esta pestaña no tiene un clip para subir.' };
    if (mensaje?.tipo === 'pedazo') return pedazo(trabajo, Number(mensaje.desde) || 0);
    if (mensaje?.tipo === 'etapa') {
      await guardar({ ...trabajo, etapa: String(mensaje.etapa) });
      return { ok: true };
    }
    if (mensaje?.tipo === 'avance') {
      avisar(trabajo, { texto: mensaje.texto, error: mensaje.error ?? null, listo: mensaje.listo === true, subido: mensaje.subido === true, informe: mensaje.informe ?? null });
      if (mensaje.error || mensaje.listo) await borrar(trabajo.pestana);
      return { ok: true };
    }
    return { ok: false };
  })()
    .then(responder)
    .catch((e) => responder({ ok: false, error: String(e?.message ?? e) }));
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const trabajo = await leer(tabId);
  if (!trabajo) return;
  if (trabajo.etapa !== 'cargado') avisar(trabajo, { texto: null, error: 'Se cerró la pestaña de Mercado Libre antes de terminar.' });
  await borrar(tabId);
});

// ───────────────────────────── La cola de subida ─────────────────────────────
// Con "subir sola la cola" prendido, la extensión le pregunta a la app cada
// minuto si alguien pidió subir un clip (una persona, o Claude). Sube de a uno,
// en una pestaña de fondo, con una pausa entre uno y otro. Hace falta tener
// Chrome abierto, con la sesión de la app y la de Mercado Libre iniciadas.

const version = chrome.runtime.getManifest().version;
const ORIGENES = APPS.map((a) => a.origin);
const ajustes = async () => ({ sola: false, despuesDe: 0, enCurso: null, ...(await chrome.storage.local.get(['sola', 'despuesDe', 'enCurso'])) });

async function terminarDeCola(trabajo, datos) {
  const cuerpo = { publicacion: trabajo.publicacion, video: trabajo.video, todasLasVariantes: trabajo.todas, ok: datos.subido === true, error: datos.error ?? null };
  await fetch(`${trabajo.origen}/api/clips/cola`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).catch(() => {});
  const { pausa = 120 } = await chrome.storage.local.get('pausa');
  await chrome.storage.local.set({ enCurso: null, despuesDe: Date.now() + pausa * 1000 });
  await guardar({ ...trabajo, terminado: true });
  // Lo que salió mal queda a la vista: la pestaña se cierra sola solo si se subió.
  if (datos.subido) chrome.tabs.remove(trabajo.pestana).catch(() => {});
}

async function atenderCola() {
  const a = await ajustes();
  // Una subida colgada más de veinte minutos no frena la cola para siempre.
  if (a.enCurso && Date.now() - a.enCurso < 20 * 60_000) return;
  const { origenApp } = await chrome.storage.local.get('origenApp');
  for (const origen of [...new Set([origenApp, ...ORIGENES].filter(Boolean))]) {
    let res;
    try {
      res = await fetch(`${origen}/api/clips/cola?version=${encodeURIComponent(version)}&sola=${a.sola && Date.now() >= a.despuesDe ? 1 : 0}`, { credentials: 'include', cache: 'no-store' });
    } catch {
      continue;
    }
    if (!res.ok) continue;
    const cola = await res.json().catch(() => null);
    if (typeof cola?.pausa_segundos === 'number') await chrome.storage.local.set({ pausa: cola.pausa_segundos });
    if (!cola?.trabajo) continue;
    await chrome.storage.local.set({ enCurso: Date.now() });
    const r = await abrir(cola.trabajo, { origen, pestanaApp: null, deCola: true });
    if (!r.ok) await terminarDeCola({ ...cola.trabajo, origen, todas: cola.trabajo.todasLasVariantes !== false, pestana: -1 }, { error: r.error });
    return;
  }
}

chrome.alarms.create('cola', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarma) => {
  if (alarma.name === 'cola') atenderCola().catch(() => {});
});
