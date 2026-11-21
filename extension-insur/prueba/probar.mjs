// Prueba la extensión en un Chrome de verdad, contra una app y un Insur de
// mentira. Uso: node extension-insur/prueba/probar.mjs
// Hace falta Playwright y un Chromium (MRB_CHROME, o el de /opt/pw-browsers).
// Todos los datos son inventados.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AQUI = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.MRB_CHROME ?? '/opt/pw-browsers/chromium';

// ── El Insur de mentira: 1.203 artículos, tres páginas de a 500.
const articulos = [];
for (let i = 0; i < 1200; i++) {
  articulos.push({ id: 1000 + i, codigo: `ZZ-${String(i).padStart(4, '0')}`, medidaNombre: '-', marcaNombre: i % 400 === 0 ? 'Marca Uno' : 'Otra', rubroNombre: 'Rubro', detalle: `Artículo ${i}`, precioProveedor: 9191, precioCosto: 8181, precioLista: 9292, precioFinal: 9393, stock: [{ depositoNombre: 'Cordoba', stockReal: i % 400 === 0 ? 2 : 0 }, { depositoNombre: 'Rosario', stockReal: 7 }] });
}
articulos.push(
  { id: 1, codigo: 'SP-169 STD', medidaNombre: 'STD', marcaNombre: 'Marca Uno', rubroNombre: 'Subconjuntos', detalle: 'Subconjunto', precioProveedor: 9191, precioCosto: 8181, precioLista: 9292, precioFinal: 9393, stock: [{ depositoNombre: 'Santa Fe', stockReal: 2 }, { depositoNombre: 'Cordoba', stockReal: 3 }, { depositoNombre: 'Rosario', stockReal: 9 }] },
  { id: 2, codigo: 'SP-169 060', medidaNombre: '060', marcaNombre: 'Marca Uno', rubroNombre: 'Subconjuntos', detalle: 'Subconjunto', precioProveedor: 100, precioCosto: 9494, precioLista: 9292, precioFinal: 9393, stock: [{ depositoNombre: 'Cordoba', stockReal: -1 }] },
  { id: 3, codigo: '00269BRG', medidaNombre: '-', marcaNombre: 'Marca Uno', rubroNombre: 'Rodamientos', detalle: 'Rodamiento', precioProveedor: 9191, precioCosto: 8181, precioLista: 9292, precioFinal: 9393, stock: [] },
);
articulos.sort((a, b) => a.codigo.localeCompare(b.codigo));
const insur = { sesion: true, fallarUna: null, pedidos: [] };
const servidorInsur = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  insur.pedidos.push(`${req.method} ${req.url}`);
  const json = (estado, cuerpo) => res.writeHead(estado, { 'Content-Type': 'application/json' }).end(JSON.stringify(cuerpo));
  if (!insur.sesion) return json(401, { success: false });
  if (insur.fallarUna && req.url.includes(insur.fallarUna)) {
    insur.fallarUna = null;
    return json(500, { success: false });
  }
  if (u.pathname === '/api/articulos') {
    const pagina = Number(u.searchParams.get('page'));
    const tamano = Number(u.searchParams.get('size'));
    const content = articulos.slice(pagina * tamano, (pagina + 1) * tamano);
    const totalPages = Math.ceil(articulos.length / tamano);
    return json(200, { success: true, message: 'ok', data: { content, page: pagina, size: tamano, totalElements: articulos.length, totalPages, last: pagina + 1 >= totalPages } });
  }
  const ficha = u.pathname.match(/^\/api\/articulos\/(\d+)$/);
  if (ficha) {
    const a = articulos.find((x) => x.id === Number(ficha[1]));
    if (!a) return json(404, { success: false });
    return json(200, { success: true, data: { ...a, precodigo: a.codigo.split(' ')[0], detalleArticuloId: 41, bocas: '4', observaciones: 'LE FALTA CRAPODINA', lineaNombre: 'Liviano', listadoVehiculos: 'Renault MASTER', listadoMedidas: [{ codigo: a.codigo, precioFinal: 9393 }], factor: 9595, margenEmpresa: 9696 } });
  }
  json(404, {});
});
await new Promise((r) => servidorInsur.listen(0, '127.0.0.1', r));
const INSUR = `http://127.0.0.1:${servidorInsur.address().port}`;

// ── La app de mentira: la pantalla, el catálogo y lo que recibe de la corrida.
const app = { sesion: true, recibido: [] };
const servidorApp = createServer((req, res) => {
  const json = (estado, cuerpo) => res.writeHead(estado, { 'Content-Type': 'application/json' }).end(JSON.stringify(cuerpo));
  if (req.url.startsWith('/a/')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'sesion=1; Path=/; SameSite=Lax; HttpOnly' });
    return res.end(`<h1>Sistema de Insur</h1><script>
      window.mensajes = [];
      addEventListener('message', (e) => { if (e.data?.origen === 'mrb-insur') window.mensajes.push(e.data); });
      window.pedir = (tipo, extra) => postMessage({ origen: 'mrb-app-insur', tipo, ...extra }, location.origin);
    </script>`);
  }
  if (!app.sesion || !/sesion=1/.test(req.headers.cookie ?? '')) return json(401, { error: 'Hace falta la sesión de la app.' });
  if (req.url === '/api/insur/catalogo') {
    return json(200, { modo_prueba: true, ficha_cada_dias: 7, articulos_por_pedido: 300, claves: ['SP169', '00269BRG'], marcas: ['MARCA UNO'], cruces: [{ id: 3, codigo: '00269BRG', estado: 'automático', ignorado: false, detalle: 'Rodamiento', bocas: null, ficha_leida: new Date().toISOString() }] });
  }
  if (req.url === '/api/insur/sync' && req.method === 'POST') {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      const b = JSON.parse(cuerpo);
      app.recibido.push(b);
      if (b.accion === 'abrir') return json(200, { corrida: 'corrida1', solo_mostrar: true, modo_prueba: true });
      if (b.accion === 'cerrar') return json(200, { ok: true, solo_mostrar: true, recibidos: 3, cruzados: 3, cambios_de_stock: 2, cambios_de_costo: 2, costos_sospechosos: 1, no_aparecieron: 0, errores: 0 });
      json(200, { ok: true });
    });
    return;
  }
  json(404, {});
});
await new Promise((r) => servidorApp.listen(0, '127.0.0.1', r));
const APP = `http://localhost:${servidorApp.address().port}`;

// Una copia de la extensión que acepta la app y el Insur de mentira, con las pausas cortas.
const copia = mkdtempSync(join(tmpdir(), 'mrb-insur-'));
cpSync(join(AQUI, '..'), copia, { recursive: true });
const manifiesto = JSON.parse(readFileSync(join(copia, 'manifest.json'), 'utf8'));
manifiesto.host_permissions.push('http://localhost/*', 'http://127.0.0.1/*');
manifiesto.content_scripts[0].matches = ['http://localhost/*'];
writeFileSync(join(copia, 'manifest.json'), JSON.stringify(manifiesto));
const cambiar = (texto, de, a) => {
  if (!texto.includes(de)) throw new Error(`La prueba no encontró «${de}» en fondo.js`);
  return texto.replace(de, a);
};
let fondo = readFileSync(join(copia, 'fondo.js'), 'utf8');
fondo = cambiar(fondo, "const INSUR = 'https://insurmotor.com.ar';", `const INSUR = '${INSUR}';`);
fondo = cambiar(fondo, 'const PAUSA_PAGINA = 2500;', 'const PAUSA_PAGINA = 300;');
fondo = cambiar(fondo, 'const PAUSA_FICHA = 1500;', 'const PAUSA_FICHA = 200;');
fondo = cambiar(fondo, 'const REINTENTO = 30_000;', 'const REINTENTO = 400;');
writeFileSync(join(copia, 'fondo.js'), fondo);

const contexto = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mrb-perfil-')), {
  executablePath: CHROME,
  headless: false,
  args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${copia}`, `--load-extension=${copia}`],
});

let fallas = 0;
const comprobar = (que, ok, detalle = '') => {
  console.log(`${ok ? '✓' : '✗'} ${que}${ok ? '' : ` → ${detalle}`}`);
  if (!ok) fallas++;
};

const pagina = await contexto.newPage();
await pagina.goto(`${APP}/a/insur/sistema-insur`);
await pagina.evaluate(() => window.pedir('estado'));
await pagina.waitForFunction(() => window.mensajes.some((m) => m.tipo === 'estado' && m.version), null, { timeout: 10000 });
const hola = await pagina.evaluate(() => window.mensajes.find((m) => m.tipo === 'estado'));
comprobar('la app ve que la extensión está, con su hora de todos los días', hola.version === manifiesto.version && hola.hora === '06:40', JSON.stringify(hola));
const fondoVivo = contexto.serviceWorkers()[0] ?? (await contexto.waitForEvent('serviceworker'));
const alarma = await fondoVivo.evaluate(() => chrome.alarms.get('diaria'));
comprobar('quedó programada la corrida diaria', alarma && alarma.periodInMinutes === 1440 && new Date(alarma.scheduledTime).getHours() === 6 && new Date(alarma.scheduledTime).getMinutes() === 40, JSON.stringify(alarma));

/** Pide una corrida desde la app y espera a que termine. */
async function correr(soloMostrar = false) {
  insur.pedidos = [];
  app.recibido = [];
  await pagina.evaluate(() => (window.mensajes = []));
  await pagina.evaluate((s) => window.pedir('correr', { soloMostrar: s }), soloMostrar);
  await pagina.waitForFunction(() => window.mensajes.some((m) => m.tipo === 'pedido'), null, { timeout: 10000 });
  const hasta = Date.now() + 60000;
  for (;;) {
    await pagina.evaluate(() => window.pedir('estado'));
    await pagina.waitForTimeout(300);
    const e = await pagina.evaluate(() => window.mensajes.filter((m) => m.tipo === 'estado').at(-1));
    if (e && !e.corriendo && e.ultimo) return e.ultimo;
    if (Date.now() > hasta) throw new Error('La corrida no terminó.');
  }
}

// 1. El camino feliz.
{
  const antes = Date.now();
  insur.fallarUna = 'page=1';
  const fin = await correr(true);
  comprobar('termina bien y cuenta el resultado sin precios', fin.ok === true && /3 artículos cruzados/.test(fin.texto) && !/\d{4}/.test(fin.texto), JSON.stringify(fin));
  comprobar('a Insur solo le hace pedidos GET', insur.pedidos.every((p) => p.startsWith('GET ')));
  const paginas = insur.pedidos.filter((p) => p.includes('/api/articulos?'));
  comprobar('lee todas las páginas de a 500, en orden de código, y reintenta una vez la que falló', paginas.join(' ') === [0, 1, 1, 2].map((n) => `GET /api/articulos?page=${n}&size=500&sort=codigo&dir=asc`).join(' '), paginas.join(' '));
  comprobar('no pide soloConStock', !insur.pedidos.some((p) => /soloConStock/.test(p)));
  comprobar('hace pausa entre páginas', Date.now() - antes > 3 * 300);
  const fichas = insur.pedidos.filter((p) => /\/api\/articulos\/\d+$/.test(p));
  // El 3 ya tiene su ficha leída esta semana y el mismo detalle.
  comprobar('pide la ficha solo de los candidatos que la necesitan', fichas.join(' ') === 'GET /api/articulos/2 GET /api/articulos/1', fichas.join(' '));
  const acciones = app.recibido.map((b) => b.accion).join(' ');
  comprobar('manda abrir, artículos, sin producto y cerrar', acciones === 'abrir articulos sin_producto cerrar', acciones);
  const abrir = app.recibido[0];
  comprobar('abre la corrida con lo leído y el pedido de solo mostrar', abrir.leidos === 1203 && abrir.solo_mostrar === true && abrir.origen === 'boton', JSON.stringify(abrir));
  const enviados = app.recibido.find((b) => b.accion === 'articulos').articulos;
  comprobar('manda solo los artículos que coinciden con la app', enviados.map((a) => a.codigo).join(',') === '00269BRG,SP-169 060,SP-169 STD', enviados.map((a) => a.codigo).join(','));
  const std = enviados.find((a) => a.codigo === 'SP-169 STD');
  comprobar('el stock de Córdoba y Santa Fe, sin Rosario', std.stock_cordoba === 3 && std.stock_santa_fe === 2, JSON.stringify(std));
  const sesenta = enviados.find((a) => a.codigo === 'SP-169 060');
  comprobar('un depósito en negativo va en 0, y el costo mayor que el del proveedor va marcado', sesenta.stock_cordoba === 0 && sesenta.costo_sospechoso === true && std.costo_sospechoso === false, JSON.stringify(sesenta));
  comprobar('la ficha viaja con sus datos permitidos', std.ficha?.precodigo === 'SP-169' && std.ficha.observaciones === 'LE FALTA CRAPODINA' && std.ficha.vehiculos === 'Renault MASTER' && enviados.find((a) => a.codigo === '00269BRG').ficha === undefined, JSON.stringify(std.ficha));
  // De la ficha viajan los nombres de sus campos, nunca sus valores.
  const todo = JSON.stringify(app.recibido.map((b) => ({ ...b, campos_de_la_ficha: undefined })));
  comprobar('a la app no viaja el precio del proveedor, el de lista, el final, el factor ni el margen', !/9191|9292|9393|9595|9696|precioProveedor|precioLista|precioFinal|margen|factor/.test(todo));
  comprobar('el costo viaja solo en los artículos cruzados', (todo.match(/8181/g) ?? []).length === 2 && std.costo === 8181);
  const sin = app.recibido.find((b) => b.accion === 'sin_producto');
  comprobar('los sin producto: solo con stock y de una marca de la app, sin costo', sin.total === 3 && sin.articulos.length === 3 && sin.articulos.every((a) => a.costo === undefined && a.stock_cordoba === 2), JSON.stringify(sin).slice(0, 300));
  const cerrar = app.recibido.at(-1);
  comprobar('al cerrar cuenta los campos de la ficha, solo sus nombres', cerrar.campos_de_la_ficha.includes('precodigo') && cerrar.fichas_pendientes === 0 && typeof cerrar.duracion_ms === 'number', JSON.stringify(cerrar));
  const guardado = JSON.stringify([await fondoVivo.evaluate(() => chrome.storage.local.get()), await fondoVivo.evaluate(() => chrome.storage.session.get())]);
  comprobar('en Chrome no queda guardado ningún precio', !/8181|9191|9292|9393|9494/.test(guardado), guardado.slice(0, 300));
}
// 2. La sesión de Insur vencida: reintenta una vez, corta y no manda nada a medias.
{
  insur.sesion = false;
  const fin = await correr();
  comprobar('con la sesión de Insur cerrada, corta y avisa', fin.ok === false && fin.texto === 'Entrá a Insur y volvé a iniciar sesión.', JSON.stringify(fin));
  comprobar('reintentó una sola vez', insur.pedidos.length === 2, insur.pedidos.join(' '));
  comprobar('no manda artículos: solo deja anotado el corte', app.recibido.map((b) => b.accion).join(' ') === 'fallo' && app.recibido[0].error === fin.texto, JSON.stringify(app.recibido));
  insur.sesion = true;
}
// 3. Sin la sesión de la app no lee nada de Insur.
{
  app.sesion = false;
  const fin = await correr();
  comprobar('sin la sesión de la app, avisa', fin.ok === false && /Entrá a la app E-commerce/.test(fin.texto), JSON.stringify(fin));
  comprobar('y no le pide nada a Insur', insur.pedidos.length === 0, insur.pedidos.join(' '));
  app.sesion = true;
}
// 4. La ventana de la extensión: cambiar la hora.
{
  const id = new URL(fondoVivo.url()).host;
  const ventana = await contexto.newPage();
  await ventana.goto(`chrome-extension://${id}/ventana.html`);
  await ventana.waitForFunction(() => document.getElementById('hora').value === '06:40');
  await ventana.fill('#hora', '07:15');
  await ventana.dispatchEvent('#hora', 'change');
  await ventana.waitForTimeout(500);
  const nueva = await fondoVivo.evaluate(() => chrome.alarms.get('diaria'));
  comprobar('la hora de la corrida diaria se cambia desde la ventana', new Date(nueva.scheduledTime).getHours() === 7 && new Date(nueva.scheduledTime).getMinutes() === 15, JSON.stringify(nueva));
  comprobar('la ventana muestra la última corrida', /Última corrida/.test(await ventana.locator('#ultimo').innerText()));
  await ventana.close();
}

await contexto.close();
servidorInsur.close();
servidorApp.close();
console.log(fallas === 0 ? '\nTodo bien.' : `\n${fallas} cosas fallaron.`);
process.exit(fallas === 0 ? 0 : 1);
