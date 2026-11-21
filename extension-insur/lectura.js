// Lo que la extensión decide sin tocar la red ni Chrome: qué artículos de
// Insur le manda a la app y con qué datos. Acá se quedan los precios que la
// app no tiene que ver: de cada artículo solo sale el costo, y de la ficha
// solo los datos permitidos. Está aparte para poder probarlo solo.

/** Un número de pieza para comparar: mayúsculas, sin espacios, puntos, guiones ni barras. Igual que en la app. */
export const normalizar = (s) => String(s ?? '').toUpperCase().replace(/[\s.\-/]+/g, '');

/** El código sin la medida: "SP-169 040" con medida "040" es "SP-169". Sin medida, Insur manda "-". */
export function codigoSinMedida(codigo, medidaNombre) {
  const entero = String(codigo ?? '').trim();
  const medida = String(medidaNombre ?? '').trim();
  if (!medida || medida === '-') return entero;
  return entero.toUpperCase().endsWith(` ${medida.toUpperCase()}`) ? entero.slice(0, entero.length - medida.length).trim() : entero;
}

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** El stock de Córdoba y de Santa Fe. Rosario cerró: no se suma nunca. Un negativo vale 0. */
export function stockDe(articulo) {
  const out = { cordoba: 0, santaFe: 0 };
  for (const d of Array.isArray(articulo?.stock) ? articulo.stock : []) {
    const nombre = sinAcentos(d?.depositoNombre);
    const unidades = typeof d?.stockReal === 'number' && Number.isFinite(d.stockReal) && d.stockReal > 0 ? Math.floor(d.stockReal) : 0;
    if (nombre === 'cordoba') out.cordoba += unidades;
    else if (nombre === 'santafe') out.santaFe += unidades;
  }
  return out;
}

/**
 * El costo de reposición sin IVA (precioCosto) y si es sospechoso: vacío, 0,
 * negativo, o mayor que el precio del proveedor. El precio del proveedor se
 * mira acá y no sale de Chrome.
 */
export function costoDe(articulo) {
  const costo = typeof articulo?.precioCosto === 'number' && Number.isFinite(articulo.precioCosto) ? articulo.precioCosto : null;
  if (costo === null || costo <= 0) return { costo: null, sospechoso: true };
  const proveedor = typeof articulo?.precioProveedor === 'number' && Number.isFinite(articulo.precioProveedor) ? articulo.precioProveedor : null;
  return { costo, sospechoso: proveedor !== null && costo > proveedor };
}

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Lo que viaja a la app de un artículo. conCosto false: es solo para el listado de los que no tienen producto. */
export function paraLaApp(articulo, conCosto) {
  const stock = stockDe(articulo);
  const base = {
    id: articulo.id,
    codigo: String(articulo.codigo ?? '').trim(),
    medida: texto(articulo.medidaNombre),
    marca: texto(articulo.marcaNombre),
    rubro: texto(articulo.rubroNombre),
    detalle: texto(articulo.detalle),
    ...(articulo.bocas !== undefined ? { bocas: sinPrecios(articulo.bocas) } : {}),
    stock_cordoba: stock.cordoba,
    stock_santa_fe: stock.santaFe,
  };
  if (!conCosto) return base;
  const { costo, sospechoso } = costoDe(articulo);
  return { ...base, costo, costo_sospechoso: sospechoso };
}

/**
 * Qué se hace con un artículo del listado: "candidato" si tiene cruce o su
 * número de pieza está en la app; "sin_producto" si es de una marca que la app
 * tiene y hay stock en Córdoba o Santa Fe; null si no se manda.
 */
export function clasificar(articulo, catalogo) {
  if (typeof articulo?.id !== 'number' || !texto(articulo.codigo)) return null;
  if (catalogo.cruces.has(articulo.id)) return 'candidato';
  const { claves, marcas } = catalogo;
  if (claves.has(normalizar(articulo.codigo)) || claves.has(normalizar(codigoSinMedida(articulo.codigo, articulo.medidaNombre)))) return 'candidato';
  const stock = stockDe(articulo);
  return marcas.has(String(articulo.marcaNombre ?? '').trim().toUpperCase()) && stock.cordoba + stock.santaFe > 0 ? 'sin_producto' : null;
}

// Nombres con que un precio podría venir dentro de un dato de la ficha.
const PRECIO = /precio|costo|factor|margen|importe|alicuota|iva/i;

/** Un dato de la ficha sin nada que parezca un precio, por si viene una lista o un objeto. */
export function sinPrecios(v) {
  if (Array.isArray(v)) return v.map(sinPrecios);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !PRECIO.test(k)).map(([k, x]) => [k, sinPrecios(x)]));
  return v ?? null;
}

/** De la ficha de un artículo, solo lo permitido. Nunca precios, factores ni márgenes. */
export function fichaPermitida(respuesta) {
  const f = respuesta && typeof respuesta === 'object' && respuesta.data && typeof respuesta.data === 'object' ? respuesta.data : respuesta;
  if (!f || typeof f !== 'object') return null;
  return {
    precodigo: texto(f.precodigo),
    detalle_articulo_id: f.detalleArticuloId ?? null,
    detalle: sinPrecios(f.detalle),
    bocas: sinPrecios(f.bocas),
    observaciones: sinPrecios(f.observaciones),
    linea: texto(f.lineaNombre),
    vehiculos: sinPrecios(f.listadoVehiculos),
    medidas: sinPrecios(f.listadoMedidas),
  };
}

/** Los nombres de los campos de una ficha, sin sus valores: para saber qué trae Insur. */
export function camposDe(respuesta) {
  const f = respuesta && typeof respuesta === 'object' && respuesta.data && typeof respuesta.data === 'object' ? respuesta.data : respuesta;
  return f && typeof f === 'object' ? Object.keys(f).slice(0, 80) : [];
}

// Compara como texto. Una lista o un objeto no se compara: no dispara una lectura.
const comoTexto = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? null : String(v).trim());
const igual = (a, b) => comoTexto(a) === null || comoTexto(b) === null || comoTexto(a) === comoTexto(b);

/**
 * Si hay que leer la ficha de un artículo: 2 si nunca se leyó, 1 si se leyó
 * hace más de cadaDias o cambió el detalle o las bocas en el listado, 0 si no.
 * Los ignorados no se leen.
 */
export function faltaFicha(enviado, cruce, cadaDias, ahora) {
  if (cruce?.ignorado) return 0;
  if (!cruce?.ficha_leida) return 2;
  if (ahora - Date.parse(cruce.ficha_leida) > cadaDias * 24 * 3600_000) return 1;
  if (!igual(enviado.detalle, cruce.detalle)) return 1;
  if (enviado.bocas !== undefined && !igual(enviado.bocas, cruce.bocas)) return 1;
  return 0;
}

/**
 * Parte los artículos en tandas para mandar. Los del mismo número de pieza van
 * juntos mientras entren: así la app carga cada producto de una vez.
 */
export function tandas(articulos, tamano, tope) {
  const out = [];
  let tanda = [];
  let anterior = null;
  for (const a of articulos) {
    const base = normalizar(codigoSinMedida(a.codigo, a.medida));
    if (tanda.length >= tope || (tanda.length >= tamano && base !== anterior)) {
      out.push(tanda);
      tanda = [];
    }
    tanda.push(a);
    anterior = base;
  }
  if (tanda.length > 0) out.push(tanda);
  return out;
}

/** La próxima vez que toca la hora "HH:MM", en milisegundos. */
export function proximaHora(hora, ahora) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? ''));
  const d = new Date(ahora);
  d.setHours(m ? Math.min(23, Number(m[1])) : 6, m ? Math.min(59, Number(m[2])) : 40, 0, 0);
  if (d.getTime() <= ahora) d.setDate(d.getDate() + 1);
  return d.getTime();
}
