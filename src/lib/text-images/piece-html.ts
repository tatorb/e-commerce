// La pieza de Imágenes con texto, como página: el mismo HTML, el mismo CSS y
// el mismo ajuste para la vista previa en la pantalla y para el PNG que arma
// el servidor. Sale del prototipo aprobado (pieza-compatibilidad.html). Se
// carga una vez y se pinta con window.pintar(datos), que devuelve la versión,
// cuántas dudas entraron, cuánto se achicaron los ítems y si entró todo.
// No usa la base ni nada del servidor: la vista previa la importa.

export type PieceBrand = { nombre: string; logo: string | null };

export type PiecePaint = {
  content: {
    TIPO_PRODUCTO: string;
    MOTOR: string;
    SELLO: string;
    compatible: { tipo: 'vehiculo' | 'motor'; marca?: string | null; titulo: string; detalle: string }[];
    no_compatible: { tipo: 'vehiculo' | 'motor'; marca?: string | null; titulo: string; detalle: string }[];
    TITULO_DUDAS: string;
    dudas: { titulo: string; respuesta: string }[];
  };
  photoUrl: string | null;
  // Las marcas que usa, por su clave.
  brands: Record<string, PieceBrand>;
  // En la vista previa, lo vacío se ve con un texto de ayuda; en el PNG no.
  preview: boolean;
};

export type PieceFit = {
  version: 'A' | 'B';
  // Cuántas dudas entraron: 4, 2 o ninguna.
  doubts: number;
  // Cuánto se achicaron los ítems: 1 es su tamaño, 0,55 lo mínimo.
  scale: number;
  fits: boolean;
};

const ENGINE_ICON =
  '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><path d="M14 10h22v5h8l5 5h5v-4h4v16h-4v-4h-5l-5 6H20l-6-6H9v5H5V13h4v5h5z"/><path d="M20 5h12M26 5v5"/></svg>';

const CSS = `
  :root{
    --tinta:#141414; --gris:#6b6b6b; --linea:#d9dbd4;
    --verde:#4f8a1f; --verde-fondo:#d3e0c3;
    --rojo:#c8281e;  --rojo-fondo:#e8d8d6;
    --display:'Archivo MRB','Arial Black',sans-serif;
    --texto:'Inter MRB',Arial,sans-serif;
    --k:1;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1200px;height:1200px;overflow:hidden;background:transparent}
  body{font-family:var(--texto)}
  .pieza{width:1200px;height:1200px;position:relative;overflow:hidden;
    background:linear-gradient(160deg,#eeefea 0%,#e9eae4 55%,#dde6d0 100%);
    padding:56px 56px 48px;color:var(--tinta);display:flex;flex-direction:column}
  .foto{position:absolute;top:16px;right:56px;width:250px;height:250px;object-fit:contain}
  .foto-vacia{position:absolute;top:16px;right:56px;width:250px;height:250px;outline:2px dashed #b9bbb3;
    display:flex;align-items:center;justify-content:center;color:#8a8c85;font-size:20px;text-align:center;padding:24px}
  .cabecera{margin-top:128px}
  .tipo{font-size:25px;color:var(--gris);font-weight:500}
  .motor{font-family:var(--display);font-stretch:125%;font-weight:800;font-size:33px;line-height:1.1;margin-top:4px;max-width:720px}
  .sello{font-family:var(--display);font-stretch:125%;font-weight:900;font-size:122px;line-height:.95;letter-spacing:-2px;margin-top:8px;white-space:nowrap}
  .seccion{margin-top:30px}
  .seccion h2{font-family:var(--display);font-stretch:125%;font-weight:800;font-size:31px;padding-bottom:12px;border-bottom:2px solid var(--tinta)}
  .columnas{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:20px}
  .col{padding:18px 20px 6px;min-width:0}
  .col.si{background:var(--verde-fondo)} .col.no{background:var(--rojo-fondo)}
  .col h3{font-size:19px;font-weight:600;padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,.08)}
  .si h3{color:var(--verde)} .no h3{color:var(--rojo)}
  .item{display:grid;grid-template-columns:calc(78px*var(--k)) 1fr;gap:calc(16px*var(--k));align-items:center;
    padding:calc(16px*var(--k)) 0;border-bottom:1px solid rgba(0,0,0,.08)}
  .item:last-child{border-bottom:0}
  .item b{display:block;font-family:var(--display);font-stretch:125%;font-weight:800;font-size:calc(25px*var(--k));line-height:1.12;overflow-wrap:anywhere}
  .item small{display:block;font-size:calc(16px*var(--k));color:var(--gris);margin-top:4px;line-height:1.25;overflow-wrap:anywhere}
  .icono{width:calc(78px*var(--k));height:calc(44px*var(--k));display:flex;align-items:center;justify-content:center}
  .icono img{max-width:100%;max-height:100%;object-fit:contain}
  .icono svg{height:100%;width:auto}
  .si .icono.motor{color:var(--verde)} .no .icono.motor{color:var(--rojo)}
  .sin-logo{font-family:var(--display);font-stretch:110%;font-weight:800;font-size:calc(13px*var(--k));
    letter-spacing:.5px;text-transform:uppercase;color:#555;text-align:center;line-height:1.1;overflow-wrap:anywhere}
  .dudas{display:grid;grid-template-columns:1fr 1fr;gap:14px 32px;margin-top:20px}
  .duda{border:1.5px solid var(--linea);background:rgba(255,255,255,.35);padding:16px 20px}
  .duda b{display:block;font-family:var(--display);font-stretch:125%;font-weight:800;font-size:21px;line-height:1.15}
  .duda p{font-size:17px;color:#3c3c3c;margin-top:6px;line-height:1.35}
  .version-b #sec-dudas{display:none}
  .version-b .seccion-compat{flex:1;display:flex;flex-direction:column;min-height:0}
  .version-b .columnas{flex:1;min-height:0}
  .vacio{opacity:.35}
`;

const BODY = `
<div class="pieza" id="pieza">
  <div id="foto"></div>
  <div class="cabecera">
    <div class="tipo" id="tipo"></div>
    <div class="motor" id="motor"></div>
    <div class="sello" id="sello"></div>
  </div>
  <div class="seccion seccion-compat">
    <h2>Compatibilidad</h2>
    <div class="columnas">
      <div class="col si"><h3>Compatible con</h3><div id="lista-si"></div></div>
      <div class="col no"><h3>No compatible con</h3><div id="lista-no"></div></div>
    </div>
  </div>
  <div class="seccion" id="sec-dudas">
    <h2 id="titulo-dudas"></h2>
    <div class="dudas" id="lista-dudas"></div>
  </div>
</div>`;

// La lógica de ajuste es la del prototipo: ajustar() con la variable --k.
const SCRIPT = `
(function(){
  var ICONO_MOTOR = ${JSON.stringify(ENGINE_ICON)};
  var pieza = document.getElementById('pieza');
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function texto(id, valor, ayuda, preview){
    var el = document.getElementById(id);
    el.classList.toggle('vacio', !valor && preview);
    el.textContent = valor || (preview ? ayuda : '');
  }
  function iconoHTML(x, marcas){
    if (x.tipo === 'motor') return '<span class="icono motor">' + ICONO_MOTOR + '</span>';
    var m = (x.marca && marcas[x.marca]) || null;
    if (!m) return '<span class="icono"></span>';
    if (!m.logo) return '<span class="icono"><span class="sin-logo">' + esc(m.nombre) + '</span></span>';
    return '<span class="icono"><img src="' + esc(m.logo) + '" alt="' + esc(m.nombre) + '" data-nombre="' + esc(m.nombre) + '"></span>';
  }
  function itemHTML(x, marcas){
    return '<div class="item">' + iconoHTML(x, marcas) + '<div><b>' + esc(x.titulo) + '</b>' + (x.detalle ? '<small>' + esc(x.detalle) + '</small>' : '') + '</div></div>';
  }
  function dudaHTML(x){ return '<div class="duda"><b>' + esc(x.titulo) + '</b><p>' + esc(x.respuesta) + '</p></div>'; }
  function cabe(){
    return pieza.scrollHeight <= 1200 && Array.prototype.every.call(document.querySelectorAll('.col'), function(c){ return c.scrollHeight <= c.clientHeight + 1; });
  }
  function ajustar(version, dudas){
    var lista = document.getElementById('lista-dudas');
    var mostradas = 0;
    pieza.style.setProperty('--k', '1');
    if (version === 'A'){
      lista.innerHTML = dudas.slice(0, 4).map(dudaHTML).join('');
      mostradas = Math.min(4, dudas.length);
      if (!cabe() && dudas.length > 2){ lista.innerHTML = dudas.slice(0, 2).map(dudaHTML).join(''); mostradas = 2; }
    } else lista.innerHTML = '';
    var k = 1;
    if (!cabe()){
      for (var i = 95; i >= 55; i -= 5){
        k = i / 100;
        pieza.style.setProperty('--k', k.toFixed(2));
        if (cabe()) break;
      }
    }
    return { version: version, doubts: mostradas, scale: k, fits: cabe() };
  }
  function cargadas(){
    var imgs = Array.prototype.slice.call(document.images);
    return Promise.all(imgs.map(function(img){
      if (img.complete) return Promise.resolve();
      return new Promise(function(r){ img.onload = r; img.onerror = r; });
    }));
  }
  window.pintar = function(d){
    var c = d.content, marcas = d.brands || {};
    texto('tipo', c.TIPO_PRODUCTO, 'Tipo de producto', d.preview);
    texto('motor', c.MOTOR, 'Motor', d.preview);
    texto('sello', c.SELLO, 'COMPATIBLE', d.preview);
    texto('titulo-dudas', c.TITULO_DUDAS, 'Lo que tenés que saber', d.preview);
    var version = (c.compatible.length > 3 || c.no_compatible.length > 3) ? 'B' : 'A';
    pieza.classList.toggle('version-b', version === 'B');
    document.getElementById('foto').innerHTML = d.photoUrl
      ? '<img class="foto" src="' + esc(d.photoUrl) + '" alt="">'
      : (d.preview ? '<div class="foto-vacia">Elegí la foto del producto</div>' : '');
    document.getElementById('lista-si').innerHTML = c.compatible.map(function(x){ return itemHTML(x, marcas); }).join('');
    document.getElementById('lista-no').innerHTML = c.no_compatible.map(function(x){ return itemHTML(x, marcas); }).join('');
    // Si un logo no carga, va el nombre de la marca en chico.
    Array.prototype.forEach.call(document.querySelectorAll('.icono img'), function(img){
      img.onerror = function(){ var s = document.createElement('span'); s.className = 'sin-logo'; s.textContent = img.getAttribute('data-nombre'); img.replaceWith(s); };
    });
    var dudas = c.dudas || [];
    return document.fonts.ready.then(cargadas).then(function(){ return ajustar(version, dudas); });
  };
  window.piezaLista = true;
})();
`;

/** La página de la pieza. Las tipografías van por su dirección o adentro, como data:. */
export function pieceDocument(fonts: { archivo: string; inter: string }): string {
  const faces = `
  @font-face{font-family:'Archivo MRB';font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url(${fonts.archivo}) format('woff2');}
  @font-face{font-family:'Inter MRB';font-style:normal;font-weight:100 900;src:url(${fonts.inter}) format('woff2');}`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${faces}${CSS}</style></head><body>${BODY}<script>${SCRIPT}</script></body></html>`;
}
