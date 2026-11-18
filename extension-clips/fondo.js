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
  chrome.tabs.sendMessage(trabajo.pestanaApp, { tipo: 'avance', publicacion: trabajo.publicacion, video: trabajo.video, ...datos }).catch(() => {});
}

async function empezar(pedido, sender) {
  const origen = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
  if (!sender.tab || !origen || !esDeLaApp(origen)) return { ok: false, error: 'Este pedido no viene de la app.' };
  const codigo = String(pedido.codigo ?? '').trim().toUpperCase();
  if (!CODIGO.test(codigo)) return { ok: false, error: 'El código de la publicación no vale.' };
  if (!ID.test(String(pedido.video ?? '')) || !ID.test(String(pedido.publicacion ?? ''))) return { ok: false, error: 'El pedido no vale.' };
  const pestana = await chrome.tabs.create({ url: LISTADO + encodeURIComponent(codigo), active: true });
  await guardar({
    pestana: pestana.id,
    pestanaApp: sender.tab.id,
    origen,
    codigo,
    publicacion: pedido.publicacion,
    video: pedido.video,
    nombre: String(pedido.nombre ?? 'clip.mp4').slice(0, 200),
    tipoDeArchivo: String(pedido.tipoDeArchivo ?? 'video/mp4').slice(0, 60),
    etapa: 'listado',
  });
  return { ok: true };
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
    const trabajo = sender.tab ? await leer(sender.tab.id) : null;
    if (mensaje?.tipo === 'trabajo') return trabajo;
    if (!trabajo) return { ok: false, error: 'Esta pestaña no tiene un clip para subir.' };
    if (mensaje?.tipo === 'pedazo') return pedazo(trabajo, Number(mensaje.desde) || 0);
    if (mensaje?.tipo === 'etapa') {
      await guardar({ ...trabajo, etapa: String(mensaje.etapa) });
      return { ok: true };
    }
    if (mensaje?.tipo === 'avance') {
      avisar(trabajo, { texto: mensaje.texto, error: mensaje.error ?? null, listo: mensaje.listo === true, informe: mensaje.informe ?? null });
      // Con el clip cargado, el trabajo sigue hasta que se cierra la pestaña: la persona termina a mano.
      if (mensaje.error) await borrar(trabajo.pestana);
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
