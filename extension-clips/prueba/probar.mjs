// Prueba la extensión en un Chrome de verdad, contra una app y un Mercado Libre
// de mentira. Uso: node extension-clips/prueba/probar.mjs
// Hace falta Playwright y un Chromium (MRB_CHROME, o el de /opt/pw-browsers).
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AQUI = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.MRB_CHROME ?? '/opt/pw-browsers/chromium';

const CLIP = randomBytes(9 * 1024 * 1024 + 123);
const HUELLA = createHash('sha256').update(CLIP).digest('hex');
const PEDAZO = 4 * 1024 * 1024;
const SUBIDA = 'https://www.mercadolibre.com.ar/video/creator/upload?item_id=MLA4188931774&user_product_id=MLAU1&origin=syi_dropdown';

const fila = (opcion = 'Crear video', href = SUBIDA) => `
  <div><button class="sll-list-row-secondary-actions-trigger" aria-label="Acciones secundarias" onclick="this.nextElementSibling.hidden=false"></button>
  <ul hidden><li><a class="sll-list-row-secondary-action__label--link" href="https://www.mercadolibre.com.ar/publicar/kit">Publicar en kit</a></li>
  <li><a class="sll-list-row-secondary-action__label--link" target="_self" href="${href}">${opcion}</a></li></ul></div>`;
const CREAR = `<title>Crear clip con IA</title><h1>Crear video</h1>
  <div class="clip-dropzone" role="button">Subir más<input type="file" class="clip-dropzone__file-input" accept=".mp4,.mpeg,.avi,.mov" style="display:none"></div>
  <div class="clip-preview"><div class="clip-preview__pill">PUBLICADO</div></div>
  <div id="paso"></div>
  <script>document.querySelector('input').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');
    // Como el de verdad: primero un círculo girando, y recién después lo que sigue.
    document.querySelector('#paso').innerHTML = '<div class="clip-preview"><div class="clip-preview__loading">.</div></div><div class="andes-progress-indicator-circular">.</div>';
    setTimeout(() => { document.querySelector('#paso').innerHTML = (window.rechaza ? '' : '<div class="clip-preview"><div class="clip-preview__pill">EN REVISIÓN</div></div>') + '<p id="dato">' + f.name + '|' + f.type + '|' + f.size + '|' + h + '</p><button onclick="window.tocado=true">Eliminar</button>'; }, 5000);
  });</script>`;

// La app de mentira: la pantalla que pide la subida y el clip de a pedazos, solo con sesión.
const app = createServer((req, res) => {
  if (req.url.startsWith('/a/')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'sesion=1; Path=/; SameSite=Lax; HttpOnly' });
    return res.end(`<h1>Clips por subir</h1><script>
      window.avances = [];
      addEventListener('message', (e) => { if (e.data?.origen === 'mrb-clips') window.avances.push(e.data); });
      window.subir = (codigo) => postMessage({ origen: 'mrb-app', tipo: 'subir', publicacion: 'pub123456', video: 'vid123456', codigo, nombre: 'clip · editado.mp4', tipoDeArchivo: 'video/mp4' }, location.origin);
    </script>`);
  }
  if (req.url === '/api/drive/videos/vid123456') {
    if (!/sesion=1/.test(req.headers.cookie ?? '')) return res.writeHead(401).end();
    const desde = Number(/bytes=(\d+)-/.exec(req.headers.range ?? '')?.[1] ?? 0);
    const hasta = Math.min(desde + PEDAZO, CLIP.length);
    res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${desde}-${hasta - 1}/${CLIP.length}` });
    return res.end(CLIP.subarray(desde, hasta));
  }
  res.writeHead(404).end();
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const APP = `http://localhost:${app.address().port}`;

// Una copia de la extensión que además acepta la app de mentira.
const copia = mkdtempSync(join(tmpdir(), 'mrb-clips-'));
cpSync(join(AQUI, '..'), copia, { recursive: true });
const manifiesto = JSON.parse(readFileSync(join(copia, 'manifest.json'), 'utf8'));
manifiesto.host_permissions.push('http://localhost/*');
manifiesto.content_scripts[0].matches = ['http://localhost/*'];
writeFileSync(join(copia, 'manifest.json'), JSON.stringify(manifiesto));

const contexto = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mrb-perfil-')), {
  executablePath: CHROME,
  headless: false,
  args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${copia}`, `--load-extension=${copia}`],
});
let listado = fila();
let crear = CREAR;
const pedidosML = [];
await contexto.route(/mercadolibre\.com\.ar/, (ruta) => {
  const url = ruta.request().url();
  pedidosML.push(`${ruta.request().method()} ${url}`);
  // Como el de verdad: el listado pasa al sitio de vendedores y pierde el /listado.
  if (url.includes('www.mercadolibre.com.ar/publicaciones/listado')) return ruta.fulfill({ status: 302, headers: { location: url.replace('www.', 'vendedores.').replace('/publicaciones/listado', '/publicaciones') } });
  if (new URL(url).pathname === '/publicaciones') return ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: listado });
  if (url.includes('/video/creator/upload')) return ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: crear });
  return ruta.fulfill({ status: 404, body: '' });
});

let fallas = 0;
const comprobar = (que, ok, detalle = '') => {
  console.log(`${ok ? '✓' : '✗'} ${que}${ok ? '' : ` → ${detalle}`}`);
  if (!ok) fallas++;
};

const pagina = await contexto.newPage();
await pagina.goto(`${APP}/a/insur/clips-por-subir`);
await pagina.evaluate(() => postMessage({ origen: 'mrb-app', tipo: 'hola' }, location.origin));
await pagina.waitForFunction(() => window.avances.some((a) => a.tipo === 'hola'), null, { timeout: 10000 });
comprobar('la app ve que la extensión está', (await pagina.evaluate(() => window.avances.find((a) => a.tipo === 'hola').version)) === '0.2.0');

async function correr(codigo) {
  await pagina.evaluate(() => (window.avances = []));
  const espera = contexto.waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await pagina.evaluate((c) => window.subir(c), codigo);
  const ml = await espera;
  await pagina.waitForFunction(() => window.avances.some((a) => a.tipo === "avance" && (a.error || a.listo)), null, { timeout: 60000 });
  return { ml, avances: await pagina.evaluate(() => window.avances) };
}

// 1. El camino feliz: llega hasta cargar el archivo, entero, y no confirma.
{
  const { ml, avances } = await correr('mla3307805900');
  const fin = avances.at(-1);
  comprobar('termina avisando que el clip quedó subido y en revisión', fin.listo === true && fin.subido === true && /quedó subido en Mercado Libre/.test(fin.texto), JSON.stringify(fin).slice(0, 300));
  comprobar('avisa de qué clip y publicación', fin.publicacion === 'pub123456' && fin.video === 'vid123456');
  const dato = await ml.locator('#dato').innerText();
  comprobar('el archivo llega entero, con su nombre y tipo', dato === `clip · editado.mp4|video/mp4|${CLIP.length}|${HUELLA}`, dato);
  comprobar('esperó a que terminara de cargar', !JSON.stringify(fin.informe.despues).includes('clip-preview__loading'));
  comprobar('no tocó ningún botón', (await ml.evaluate(() => window.tocado)) !== true);
  comprobar('buscó por el código y entró por Crear video', pedidosML[0] === 'GET https://www.mercadolibre.com.ar/publicaciones/listado?search=MLA3307805900' && pedidosML.some((p) => p === `GET ${SUBIDA}`), pedidosML.join(' , '));
  comprobar('solo leyó páginas de Mercado Libre', pedidosML.every((p) => p.startsWith('GET ')));
  comprobar('hubo avances del traslado', avances.some((a) => /Trayendo el clip: 100 %/.test(a.texto ?? '')));
  await ml.close();
}
// 1b. Mercado Libre no suma el video: no lo da por subido.
{
  crear = CREAR.replace('<script>', '<script>window.rechaza = true;');
  const { ml, avances } = await correr('MLA1000001');
  const fin = avances.at(-1);
  comprobar('si el video no aparece en Tus videos, no lo da por subido', /no sumó el video/.test(fin.error ?? '') && fin.subido !== true, JSON.stringify(fin).slice(0, 200));
  crear = CREAR;
  await ml.close();
}
// 2. Dos publicaciones en el listado: no elige.
{
  listado = fila() + fila();
  const antes = pedidosML.length;
  const { ml, avances } = await correr('MLA1000001');
  comprobar('con dos publicaciones se frena', /2 publicaciones/.test(avances.at(-1).error ?? ''), JSON.stringify(avances.at(-1)).slice(0, 200));
  comprobar('y no entra a la subida', !pedidosML.slice(antes).some((p) => p.includes('/video/creator')));
  await ml.close();
}
// 3. La pantalla cambió.
{
  listado = fila('Crear video con IA');
  let r = await correr('MLA1000001');
  comprobar('si el menú no ofrece Crear video, se frena con informe', /no ofrece/.test(r.avances.at(-1).error ?? '') && r.avances.at(-1).informe?.botones);
  await r.ml.close();
  listado = fila('Crear video', 'https://www.mercadolibre.com.ar/publicar/kit');
  r = await correr('MLA1000001');
  comprobar('si el link lleva a otro lado, se frena', /no lleva a la subida/.test(r.avances.at(-1).error ?? ''));
  await r.ml.close();
  listado = fila('Crear video', 'https://otro-sitio.example/video/creator/upload?item_id=1');
  r = await correr('MLA1000001');
  comprobar('si el link sale de Mercado Libre, se frena', /no lleva a la subida/.test(r.avances.at(-1).error ?? ''));
  await r.ml.close();
}
// 4. Sesión cerrada.
{
  listado = '<form><input type="password"></form>';
  const { ml, avances } = await correr('MLA1000001');
  comprobar('con la sesión cerrada avisa', /sesión de Mercado Libre está cerrada/.test(avances.at(-1).error ?? ''));
  await ml.close();
}
// 5. Pedidos que no valen, y pestañas que no son de un trabajo.
{
  await pagina.evaluate(() => (window.avances = []));
  await pagina.evaluate(() => window.subir('https://malo.example'));
  await pagina.waitForFunction(() => window.avances.some((a) => a.error), null, { timeout: 10000 });
  comprobar('rechaza un código que no vale', /código/.test((await pagina.evaluate(() => window.avances.at(-1))).error));
  listado = fila();
  const suelta = await contexto.newPage();
  await suelta.goto('https://vendedores.mercadolibre.com.ar/publicaciones?search=MLA1');
  await suelta.waitForTimeout(1500);
  comprobar('en una pestaña de Mercado Libre que no abrió, no hace nada', (await suelta.locator('#mrb-clips-cartel').count()) === 0 && (await suelta.locator('ul').first().isHidden()));
  await suelta.close();
}
// 6. Se cierra la pestaña a mitad.
{
  crear = '<h1>Crear video</h1>';
  listado = fila();
  await pagina.evaluate(() => (window.avances = []));
  const espera = contexto.waitForEvent('page');
  await pagina.evaluate(() => window.subir('MLA1000001'));
  const ml = await espera;
  for (let i = 0; i < 100 && !/creator\/upload/.test(ml.url()); i++) await pagina.waitForTimeout(200);
  await ml.close();
  await pagina.waitForFunction(() => window.avances.some((a) => a.error), null, { timeout: 10000 });
  comprobar('si se cierra la pestaña, avisa', /Se cerró la pestaña/.test((await pagina.evaluate(() => window.avances.at(-1))).error));
}

await contexto.close();
app.close();
console.log(fallas === 0 ? '\nTodo bien.' : `\n${fallas} comprobaciones fallaron.`);
process.exit(fallas === 0 ? 0 : 1);
