// El fondo de la extensión: una vez por día, o cuando se le pide, lee el
// listado de artículos de Insur con la sesión de la persona, de a una página
// y con pausas, y le manda a la app los que tienen que ver con sus productos.
// Solo hace pedidos GET a Insur. Los precios viven en la memoria mientras dura
// la corrida y se descartan: no se guardan en chrome.storage ni en ningún lado.

import { camposDe, clasificar, faltaFicha, fichaPermitida, paraLaApp, proximaHora, tandas } from './lectura.js';

const INSUR = 'https://insurmotor.com.ar';
const version = chrome.runtime.getManifest().version;
// Los orígenes de la app: los mismos del manifiesto.
const APPS = chrome.runtime.getManifest().content_scripts[0].matches.map((m) => new URL(m.replace('/*', '/')));
const esDeLaApp = (origen) => {
  try {
    const u = new URL(origen);
    return APPS.some((a) => a.protocol === u.protocol && a.hostname === u.hostname);
  } catch {
    return false;
  }
};

const POR_PAGINA = 500;
const PAUSA_PAGINA = 2500;
const PAUSA_FICHA = 1500;
// Un pedido que tarda más de esto se da por caído.
const ESPERA = 30_000;
// Un pedido que falla se reintenta una sola vez, después de esto.
const REINTENTO = 30_000;
// La corrida completa no pasa de veinte minutos.
const TOPE = 20 * 60_000;
// Las fichas se leen hasta acá, para que quede tiempo de mandar todo a la app.
const TOPE_FICHAS = 16 * 60_000;
const HORA = '06:40';

/** Un corte de la corrida, con el mensaje para la persona. */
class Corte extends Error {}

// La corrida en curso. Solo en la memoria.
let enCurso = null;

const ahora = () => Date.now();

/** Espera sin que Chrome duerma el fondo: cada tanto usa una función de la extensión. */
async function esperar(ms) {
  const hasta = ahora() + ms;
  while (ahora() < hasta) {
    await new Promise((r) => setTimeout(r, Math.min(10_000, hasta - ahora())));
    await chrome.runtime.getPlatformInfo();
  }
}

/** Cómo va, para la ventana de la extensión. Sin precios: solo la etapa y cuánto falta. */
async function avance(etapa, detalle) {
  if (enCurso) Object.assign(enCurso, { etapa, detalle });
  await chrome.storage.session.set({ avance: { etapa, detalle, desde: enCurso?.desde ?? null } });
}

function vencio(tope = TOPE) {
  return ahora() - enCurso.desde > tope;
}

/** Un GET a Insur, con la sesión del navegador. Si falla, un solo reintento a los 30 segundos. */
async function pedirInsur(ruta, opciones = {}) {
  let motivo = '';
  for (let intento = 1; intento <= 2; intento++) {
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), ESPERA);
    try {
      const res = await fetch(INSUR + ruta, { method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }, signal: corte.signal });
      const tipo = res.headers.get('content-type') ?? '';
      // Una ficha que Insur ya no tiene se saltea: no corta la corrida.
      if (res.status === 404 && opciones.puedeFaltar) return null;
      if (res.status === 401 || res.status === 403 || (res.ok && !tipo.includes('json'))) motivo = 'Entrá a Insur y volvé a iniciar sesión.';
      else if (!res.ok) motivo = `Insur respondió con el error ${res.status}.`;
      else {
        const datos = await res.json();
        if (datos && datos.success === false) motivo = 'Insur respondió que no pudo entregar los datos.';
        else return datos;
      }
    } catch (e) {
      motivo = e?.name === 'AbortError' ? 'Insur tardó más de 30 segundos en responder.' : 'No se pudo llegar a Insur.';
    } finally {
      clearTimeout(reloj);
    }
    if (intento === 1) await esperar(REINTENTO);
  }
  throw new Corte(motivo);
}

/** Un pedido a la app, con la sesión de la persona. */
async function pedirApp(origen, ruta, cuerpo) {
  let res;
  try {
    res = await fetch(origen + ruta, {
      method: cuerpo ? 'POST' : 'GET',
      credentials: 'include',
      cache: 'no-store',
      ...(cuerpo ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) } : {}),
    });
  } catch {
    throw new Corte('No se pudo llegar a la app E-commerce.');
  }
  const datos = await res.json().catch(() => null);
  if (res.status === 401) throw new Corte('Entrá a la app E-commerce y volvé a iniciar sesión.');
  if (!res.ok) throw new Corte(datos?.error ? `La app respondió: ${datos.error}` : `La app respondió con el error ${res.status}.`);
  return datos;
}

async function origenDeLaApp() {
  const { origenApp } = await chrome.storage.local.get('origenApp');
  return esDeLaApp(origenApp) ? origenApp : APPS[0].origin;
}

/** La lectura completa de Insur: todas las páginas, en orden de código. Devuelve solo lo que va a la app. */
async function leerListado(catalogo) {
  const candidatos = [];
  const sinProducto = [];
  let leidos = 0;
  // Los nombres de los campos del primer artículo, sin sus valores.
  let campos = [];
  let paginas = 1;
  let total = 0;
  for (let pagina = 0; pagina < paginas; pagina++) {
    if (vencio()) throw new Corte('La lectura de Insur pasó de veinte minutos y se cortó.');
    await avance('listado', `Página ${pagina + 1} de ${paginas === 1 && pagina === 0 ? '…' : paginas}`);
    // Se lee todo, también lo que está en 0: lo que pasó a 0 también se corrige.
    const r = await pedirInsur(`/api/articulos?page=${pagina}&size=${POR_PAGINA}&sort=codigo&dir=asc`);
    const d = r?.data;
    if (!d || !Array.isArray(d.content)) throw new Corte('Insur respondió algo que la extensión no esperaba en el listado de artículos.');
    paginas = Number.isInteger(d.totalPages) && d.totalPages > 0 ? d.totalPages : paginas;
    total = Number.isInteger(d.totalElements) ? d.totalElements : total;
    if (campos.length === 0 && d.content[0] && typeof d.content[0] === 'object') campos = Object.keys(d.content[0]).slice(0, 80);
    for (const articulo of d.content) {
      leidos++;
      const que = clasificar(articulo, catalogo);
      if (que === 'candidato') candidatos.push(paraLaApp(articulo, true));
      else if (que === 'sin_producto') sinProducto.push(paraLaApp(articulo, false));
    }
    if (d.last === true) break;
    if (pagina + 1 < paginas) await esperar(PAUSA_PAGINA);
  }
  // Una lectura a la que le falta una parte no se manda.
  if (total > 0 && leidos < total * 0.98) throw new Corte(`La lectura de Insur quedó incompleta: ${leidos} de ${total} artículos.`);
  return { candidatos, sinProducto, leidos, campos };
}

/** Las fichas que tocan, de a una y con pausa, hasta donde dé el tiempo. Lo que no entra queda para la próxima corrida. */
async function leerFichas(candidatos, catalogo) {
  const cuando = ahora();
  const porLeer = candidatos
    .map((a) => ({ a, falta: faltaFicha(a, catalogo.cruces.get(a.id), catalogo.cadaDias, cuando) }))
    .filter((x) => x.falta > 0)
    // Primero las que nunca se leyeron.
    .sort((x, y) => y.falta - x.falta);
  let campos = [];
  let leidas = 0;
  for (const { a } of porLeer) {
    if (vencio(TOPE_FICHAS)) break;
    await avance('fichas', `Ficha ${leidas + 1} de ${porLeer.length}`);
    const r = await pedirInsur(`/api/articulos/${encodeURIComponent(a.id)}`, { puedeFaltar: true });
    if (campos.length === 0) campos = camposDe(r);
    const ficha = fichaPermitida(r);
    if (ficha) a.ficha = ficha;
    leidas++;
    await esperar(PAUSA_FICHA);
  }
  return { campos, pendientes: porLeer.length - leidas };
}

/** Manda la corrida a la app, en tandas. Recién acá sale algo de Chrome. */
async function mandar(origen, corrida, lectura, fichas, opciones, catalogo) {
  await avance('enviando', 'Abriendo la corrida en la app');
  const abierta = await pedirApp(origen, '/api/insur/sync', { accion: 'abrir', origen: opciones.origen, solo_mostrar: opciones.soloMostrar, leidos: lectura.leidos, version });
  corrida.id = abierta.corrida;
  const partes = tandas(lectura.candidatos, 120, catalogo.porPedido);
  for (const [i, tanda] of partes.entries()) {
    if (vencio()) throw new Corte('La corrida pasó de veinte minutos y se cortó.');
    await avance('enviando', `Tanda ${i + 1} de ${partes.length}`);
    await pedirApp(origen, '/api/insur/sync', { accion: 'articulos', corrida: corrida.id, articulos: tanda });
  }
  // Los que no tienen producto en la app: solo los de más stock, para el listado.
  const sinProducto = [...lectura.sinProducto].sort((a, b) => b.stock_cordoba + b.stock_santa_fe - (a.stock_cordoba + a.stock_santa_fe)).slice(0, 3000);
  for (let i = 0; i < sinProducto.length; i += catalogo.porPedido) {
    await pedirApp(origen, '/api/insur/sync', { accion: 'sin_producto', corrida: corrida.id, total: lectura.sinProducto.length, articulos: sinProducto.slice(i, i + catalogo.porPedido) });
  }
  await avance('enviando', 'Cerrando la corrida');
  return pedirApp(origen, '/api/insur/sync', {
    accion: 'cerrar',
    corrida: corrida.id,
    duracion_ms: ahora() - enCurso.desde,
    fichas_pendientes: fichas.pendientes,
    campos_de_la_ficha: fichas.campos,
    campos_del_listado: lectura.campos,
    errores: [],
  });
}

function avisar(titulo, mensaje) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icono.png', title: titulo, message: mensaje }).catch?.(() => {});
}

/** Una corrida. origen: "boton" o "diaria". Una sola a la vez. */
async function correr(opciones) {
  if (enCurso) return { ok: false, error: 'Ya hay una corrida en curso.' };
  enCurso = { desde: ahora(), etapa: 'empezando', detalle: '' };
  const latido = setInterval(() => chrome.runtime.getPlatformInfo(), 20_000);
  const origen = await origenDeLaApp();
  const corrida = { id: null };
  let resultado;
  try {
    await avance('empezando', 'Pidiendo los productos a la app');
    // Primero la app: sin su sesión no se lee nada de Insur.
    const c = await pedirApp(origen, '/api/insur/catalogo');
    const catalogo = {
      claves: new Set(c.claves ?? []),
      marcas: new Set(c.marcas ?? []),
      cruces: new Map((c.cruces ?? []).map((x) => [x.id, x])),
      cadaDias: Number(c.ficha_cada_dias) > 0 ? Number(c.ficha_cada_dias) : 7,
      porPedido: Number(c.articulos_por_pedido) > 0 ? Number(c.articulos_por_pedido) : 300,
    };
    const lectura = await leerListado(catalogo);
    const fichas = await leerFichas(lectura.candidatos, catalogo);
    const r = await mandar(origen, corrida, lectura, fichas, opciones, catalogo);
    const texto = r.solo_mostrar
      ? `Solo mostrar: ${r.cruzados} artículos cruzados, cambiarían ${r.cambios_de_stock} de stock y ${r.cambios_de_costo} de costo. Miralo en la app, en Sistema de Insur.`
      : `Listo: ${r.cruzados} artículos cruzados, ${r.cambios_de_stock} cambios de stock y ${r.cambios_de_costo} de costo.`;
    resultado = { ok: true, texto: fichas.pendientes > 0 ? `${texto} Quedaron ${fichas.pendientes} fichas para la próxima corrida.` : texto };
    avisar('Insur → E-commerce', resultado.texto);
  } catch (e) {
    const error = e instanceof Corte ? e.message : `La extensión falló: ${String(e?.message ?? e)}`;
    resultado = { ok: false, texto: error };
    // Lo que se cortó queda anotado en la app, si se puede.
    await pedirApp(origen, '/api/insur/sync', { accion: 'fallo', corrida: corrida.id, origen: opciones.origen, error, duracion_ms: ahora() - enCurso.desde }).catch(() => {});
    avisar('Insur → E-commerce: la corrida se cortó', error);
  } finally {
    clearInterval(latido);
    // Solo el resultado en palabras y cantidades: nunca un precio.
    if (resultado) await chrome.storage.local.set({ ultimo: { cuando: ahora(), origen: opciones.origen, ...resultado } });
    await chrome.storage.session.remove('avance');
    enCurso = null;
  }
  return resultado;
}

async function estado() {
  const { hora = HORA, ultimo = null } = await chrome.storage.local.get(['hora', 'ultimo']);
  return { version, hora, ultimo, corriendo: enCurso ? { desde: enCurso.desde, etapa: enCurso.etapa, detalle: enCurso.detalle } : null };
}

async function programar() {
  const { hora = HORA } = await chrome.storage.local.get('hora');
  await chrome.alarms.clear('diaria');
  chrome.alarms.create('diaria', { when: proximaHora(hora, ahora()), periodInMinutes: 24 * 60 });
}

chrome.runtime.onInstalled.addListener(() => programar());
chrome.runtime.onStartup.addListener(() => programar());
chrome.alarms.onAlarm.addListener((alarma) => {
  if (alarma.name === 'diaria') correr({ origen: 'diaria', soloMostrar: false }).catch(() => {});
});

chrome.runtime.onMessage.addListener((mensaje, sender, responder) => {
  (async () => {
    // Desde una pantalla de la app, o desde la ventana de la extensión.
    const origen = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
    const propia = sender.id === chrome.runtime.id && origen === self.location.origin;
    if (!propia && !esDeLaApp(origen)) return { ok: false, error: 'Este pedido no viene de la app.' };
    if (!propia) await chrome.storage.local.set({ origenApp: origen });
    if (mensaje?.tipo === 'estado') return estado();
    if (mensaje?.tipo === 'hora') {
      if (!/^\d{1,2}:\d{2}$/.test(String(mensaje.hora))) return { ok: false, error: 'La hora no vale.' };
      await chrome.storage.local.set({ hora: String(mensaje.hora) });
      await programar();
      return estado();
    }
    if (mensaje?.tipo === 'correr') {
      if (enCurso) return { ok: false, error: 'Ya hay una corrida en curso.' };
      // No se espera a que termine: la ventana y la app preguntan cómo va.
      correr({ origen: 'boton', soloMostrar: mensaje.soloMostrar === true }).catch(() => {});
      return { ok: true };
    }
    return { ok: false };
  })()
    .then(responder)
    .catch((e) => responder({ ok: false, error: String(e?.message ?? e) }));
  return true;
});
