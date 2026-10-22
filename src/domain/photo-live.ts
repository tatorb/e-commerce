import { z } from 'zod';

// Editar la foto en vivo: las mismas cuentas que hace la Mac en los ajustes de
// lente, perspectiva, blancos, luces y color, sobre una copia chica que la Mac
// sube con cada foto (trabajador-imagenes/mrb_imagenes/vivo.py). Quitar fondo
// y recorte no se rehacen: se usa la silueta que hizo la Mac, movida si cambió
// el encuadre. Es una vista previa: la foto final la hace siempre la Mac.
//
// Cada cuenta copia la de su paso en trabajador-imagenes/mrb_imagenes/pasos/,
// con el mismo nombre en el comentario, y las pruebas la comparan con números
// que sacó la Mac. Las fotos van de 0 a 1, en sRGB, tres valores por píxel.

// ───────────────────────────── El paquete ─────────────────────────────

const MARK = 'MRBVIVO1';
const bit = z.union([z.literal(0), z.literal(1)]);
const index = z.number().int().nonnegative();
const size = z.number().int().positive();

const headerSchema = z.object({
  version: z.literal(1),
  // El original preparado, en tamaño completo.
  original: z.object({ ancho: size, alto: size }),
  // La foto preparada en tamaño de pantalla, antes de los ajustes.
  base: index,
  // Una copia por cada combinación de correcciones de lente, si la foto trae datos de lente.
  lente: z.array(z.object({ distorsion: bit, aberracion: bit, vineta: bit, imagen: index })).nullable(),
  // La silueta que usó Quitar fondo, en tamaño de pantalla, y el tamaño completo de esa foto.
  silueta: z.object({ imagen: index, ancho_completo: size, alto_completo: size }).nullable(),
  imagenes: z.array(z.object({ tipo: z.string().max(40), inicio: index, largo: size, ancho: size, alto: size })).min(1).max(16),
});
export type LiveHeader = z.infer<typeof headerSchema>;

export type LiveFile = { type: string; bytes: Uint8Array; width: number; height: number };
export type LivePackage = { header: LiveHeader; files: LiveFile[] };

export class LiveError extends Error {}

const BROKEN = 'El paquete para editar en vivo vino mal. Rehacé la foto en la Mac para que lo vuelva a armar.';

/** Lee el paquete: la marca, el largo del encabezado, el encabezado en JSON y las imágenes una tras otra. */
export function readLivePackage(buf: ArrayBuffer): LivePackage {
  const bytes = new Uint8Array(buf);
  if (bytes.length < 12 || new TextDecoder().decode(bytes.subarray(0, 8)) !== MARK) throw new LiveError(BROKEN);
  const length = new DataView(buf).getUint32(8, true);
  if (12 + length > bytes.length) throw new LiveError(BROKEN);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + length)));
  } catch {
    throw new LiveError(BROKEN);
  }
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) throw new LiveError(BROKEN);
  const header = parsed.data;
  const body = bytes.subarray(12 + length);
  const files = header.imagenes.map((i) => {
    if (i.inicio + i.largo > body.length) throw new LiveError(BROKEN);
    return { type: i.tipo, bytes: body.subarray(i.inicio, i.inicio + i.largo), width: i.ancho, height: i.alto };
  });
  const refs = [header.base, ...(header.lente ?? []).map((v) => v.imagen), ...(header.silueta ? [header.silueta.imagen] : [])];
  if (refs.some((r) => r >= files.length)) throw new LiveError(BROKEN);
  return { header, files };
}

// ───────────────────────────── Fotos y color ─────────────────────────────

export type Rgb = { w: number; h: number; d: Float32Array };
export type Gray = { w: number; h: number; d: Float32Array };
// Una imagen del paquete como la lee el navegador: rojo, verde, azul y
// transparencia de 0 a 255. Ocupa la cuarta parte que en decimales.
export type Raster = { w: number; h: number; rgba: Uint8ClampedArray };

/** La silueta: un solo valor por píxel, el rojo. */
export function grayFromRgba(w: number, h: number, rgba: ArrayLike<number>): Gray {
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = rgba[i * 4] / 255;
  return { w, h, d };
}

/** De la foto a los píxeles del navegador. */
export function rgbaFrom(img: Rgb): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(img.w * img.h * 4);
  for (let i = 0, j = 0; i < img.w * img.h; i++, j += 4) {
    out[j] = Math.round(img.d[i * 3] * 255);
    out[j + 1] = Math.round(img.d[i * 3 + 1] * 255);
    out[j + 2] = Math.round(img.d[i * 3 + 2] * 255);
    out[j + 3] = 255;
  }
  return out;
}

const LUM = [0.2126, 0.7152, 0.0722] as const;

// a_lineal y a_srgb, de sRGB a luz lineal y de vuelta, con el valor llevado a
// 0..1. Con tablas, que es mucho más rápido que calcular la potencia en cada píxel.
const TABLE = 65535;
let tables: { lin: Float32Array; srgb: Float32Array } | null = null;

function colorTables() {
  if (tables) return tables;
  const lin = new Float32Array(TABLE + 2);
  const srgb = new Float32Array(TABLE + 2);
  for (let i = 0; i <= TABLE; i++) {
    const x = i / TABLE;
    lin[i] = x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    srgb[i] = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
  }
  lin[TABLE + 1] = lin[TABLE];
  srgb[TABLE + 1] = srgb[TABLE];
  tables = { lin, srgb };
  return tables;
}

function look(t: Float32Array, x: number): number {
  if (!(x > 0)) return t[0];
  if (x >= 1) return t[TABLE];
  const p = x * TABLE;
  const i = p | 0;
  return t[i] + (p - i) * (t[i + 1] - t[i]);
}

const clip01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** round() de Python: los empates van al par. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

const noChange = (values: Record<string, number>, keys: string[], tolerance: number) => keys.every((k) => Math.abs(values[k] ?? 0) <= tolerance);

// ───────────────────────────── Lente y perspectiva ─────────────────────────────

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Mat3 = number[];

/** Resuelve un sistema de ecuaciones chico por eliminación, eligiendo el mayor pivote. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let k = r + 1; k < n; k++) s -= m[r][k] * x[k];
    x[r] = s / m[r][r];
  }
  return x;
}

/** La transformación que lleva cuatro puntos a otros cuatro, como cv2.getPerspectiveTransform. */
function fourPoints(src: [number, number][], dst: [number, number][]): Mat3 {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  return [...solve(a, b), 1];
}

const mul3 = (a: Mat3, b: Mat3): Mat3 =>
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));

export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
}

function project(m: Mat3, x: number, y: number): [number, number] {
  const z = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / z, (m[3] * x + m[4] * y + m[5]) / z];
}

/** homografia: gira y corrige la perspectiva alrededor del centro. */
export function perspectiveMatrix(w: number, h: number, giro: number, vertical: number, horizontal: number): Mat3 {
  const cx = w / 2;
  const cy = h / 2;
  const dv = (vertical / 100) * (w / 2);
  const dh = (horizontal / 100) * (h / 2);
  const persp = fourPoints(
    [
      [dv, dh],
      [w - dv, -dh],
      [w + dv, h + dh],
      [-dv, h - dh],
    ],
    [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ],
  );
  const angle = (-giro * Math.PI) / 180;
  const al = Math.cos(angle);
  const be = Math.sin(angle);
  const rot = [al, be, (1 - al) * cx - be * cy, -be, al, be * cx + (1 - al) * cy, 0, 0, 1];
  return mul3(rot, persp);
}

/** Suma acumulada de lo que no sirve, para revisar cualquier rectángulo de una vez. */
function badSums(w: number, h: number, ok: (i: number) => boolean): Int32Array {
  const s = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += ok(y * w + x) ? 0 : 1;
      s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1] + row;
    }
  }
  return s;
}

const badIn = (s: Int32Array, w: number, b: Box) =>
  s[b.y1 * (w + 1) + b.x1] - s[b.y0 * (w + 1) + b.x1] - s[b.y1 * (w + 1) + b.x0] + s[b.y0 * (w + 1) + b.x0];

/** recorte_valido: el rectángulo centrado más grande, con la misma proporción, donde todo es foto real. */
export function centeredValidBox(w: number, h: number, valid: Uint8Array): Box | null {
  const sums = badSums(w, h, (i) => valid[i] === 1);
  const box = (scale: number): Box => {
    const bw = Math.max(1, Math.floor(w * scale));
    const bh = Math.max(1, Math.floor(h * scale));
    const x0 = Math.floor((w - bw) / 2);
    const y0 = Math.floor((h - bh) / 2);
    return { x0, y0, x1: x0 + bw, y1: y0 + bh };
  };
  if (badIn(sums, w, box(1)) === 0) return box(1);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (badIn(sums, w, box(mid)) === 0) lo = mid;
    else hi = mid;
  }
  return lo <= 0 ? null : box(lo);
}

/**
 * deformar y recorte_valido del paso Perspectiva: qué parte de la foto queda
 * con foto real después de girar. Un píxel cuenta si sale de adentro de la
 * foto y si tampoco hay nada de afuera a `radius` píxeles.
 */
export function perspectiveBox(w: number, h: number, inv: Mat3, radius: number): Box | null {
  const covered = new Uint8Array(w * h);
  // Como cv2.remap: la posición se redondea a 1/32 de píxel.
  const maxX = (w - 1) * 32;
  const maxY = (h - 1) * 32;
  const [a, b, c, d, e, f, g, k, m] = inv;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const z = g * x + k * y + m;
      const X = Math.round(((a * x + b * y + c) / z) * 32);
      const Y = Math.round(((d * x + e * y + f) / z) * 32);
      covered[y * w + x] = X >= 0 && X <= maxX && Y >= 0 && Y <= maxY ? 1 : 0;
    }
  }
  const sums = badSums(w, h, (i) => covered[i] === 1);
  const valid = new Uint8Array(w * h);
  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      const ok = badIn(sums, w, { x0: x - radius, y0: y - radius, x1: x + radius + 1, y1: y + radius + 1 }) === 0;
      valid[y * w + x] = ok ? 1 : 0;
    }
  }
  return centeredValidBox(w, h, valid);
}

function sampleRgb(src: Raster, x: number, y: number, out: Float32Array, o: number) {
  const fx = Math.min(Math.max(x, 0), src.w - 1);
  const fy = Math.min(Math.max(y, 0), src.h - 1);
  const x0 = Math.min(fx | 0, src.w - 2 < 0 ? 0 : src.w - 2);
  const y0 = Math.min(fy | 0, src.h - 2 < 0 ? 0 : src.h - 2);
  const x1 = Math.min(x0 + 1, src.w - 1);
  const y1 = Math.min(y0 + 1, src.h - 1);
  const ax = fx - x0;
  const ay = fy - y0;
  for (let c = 0; c < 3; c++) {
    const a = src.rgba[(y0 * src.w + x0) * 4 + c];
    const b = src.rgba[(y0 * src.w + x1) * 4 + c];
    const d = src.rgba[(y1 * src.w + x0) * 4 + c];
    const e = src.rgba[(y1 * src.w + x1) * 4 + c];
    out[o + c] = ((a + (b - a) * ax) * (1 - ay) + (d + (e - d) * ax) * ay) / 255;
  }
}

function sampleGray(src: Gray, x: number, y: number): number {
  // Afuera de la silueta no hay pieza.
  if (x < -0.5 || y < -0.5 || x > src.w - 0.5 || y > src.h - 0.5) return 0;
  const fx = Math.min(Math.max(x, 0), src.w - 1);
  const fy = Math.min(Math.max(y, 0), src.h - 1);
  const x0 = fx | 0;
  const y0 = fy | 0;
  const x1 = Math.min(x0 + 1, src.w - 1);
  const y1 = Math.min(y0 + 1, src.h - 1);
  const ax = fx - x0;
  const ay = fy - y0;
  const a = src.d[y0 * src.w + x0];
  const b = src.d[y0 * src.w + x1];
  const d = src.d[y1 * src.w + x0];
  const e = src.d[y1 * src.w + x1];
  return (a + (b - a) * ax) * (1 - ay) + (d + (e - d) * ax) * ay;
}

export type LensValues = { distorsion: number; aberracion: number; vineta: number };
export type PerspectiveValues = { giro: number; vertical: number; horizontal: number };

// Cómo queda el encuadre: de qué copia de lente sale la foto, dónde está esa
// copia dentro de la base (las copias están recortadas al centro), la
// transformación de la perspectiva y el recorte final.
export type Geometry = { image: number; ox: number; oy: number; fwd: Mat3 | null; inv: Mat3 | null; box: Box };

export function lensImage(header: LiveHeader, lens: LensValues | null): number {
  if (!lens || !header.lente) return header.base;
  const on = (v: number) => (v >= 0.5 ? 1 : 0);
  const v = header.lente.find((l) => l.distorsion === on(lens.distorsion) && l.aberracion === on(lens.aberracion) && l.vineta === on(lens.vineta));
  return v?.imagen ?? header.base;
}

export function geometryOf(pkg: LivePackage, lens: LensValues | null, persp: PerspectiveValues | null, radius: number): Geometry {
  const image = lensImage(pkg.header, lens);
  const f = pkg.files[image];
  const base = pkg.files[pkg.header.base];
  const plain: Geometry = {
    image,
    ox: Math.floor((base.width - f.width) / 2),
    oy: Math.floor((base.height - f.height) / 2),
    fwd: null,
    inv: null,
    box: { x0: 0, y0: 0, x1: f.width, y1: f.height },
  };
  if (!persp || noChange(persp, ['giro', 'vertical', 'horizontal'], 0.05)) return plain;
  const fwd = perspectiveMatrix(f.width, f.height, persp.giro, persp.vertical, persp.horizontal);
  const inv = invert3(fwd);
  const box = perspectiveBox(f.width, f.height, inv, radius);
  // Sin foto útil, la Mac saltea la perspectiva.
  return box ? { ...plain, fwd, inv, box } : plain;
}

/** La foto con el encuadre nuevo. */
export function warp(src: Raster, g: Geometry): Rgb {
  const w = g.box.x1 - g.box.x0;
  const h = g.box.y1 - g.box.y0;
  const d = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (!g.inv) {
        const j = ((y + g.box.y0) * src.w + x + g.box.x0) * 4;
        d[i] = src.rgba[j] / 255;
        d[i + 1] = src.rgba[j + 1] / 255;
        d[i + 2] = src.rgba[j + 2] / 255;
        continue;
      }
      const px = x + g.box.x0;
      const py = y + g.box.y0;
      const m = g.inv;
      const z = m[6] * px + m[7] * py + m[8];
      sampleRgb(src, (m[0] * px + m[1] * py + m[2]) / z, (m[3] * px + m[4] * py + m[5]) / z, d, i);
    }
  }
  return { w, h, d };
}

/**
 * La silueta de la Mac llevada al encuadre nuevo: cada píxel nuevo se busca
 * en la base y de ahí en la foto que tenía la Mac al quitar el fondo. Si
 * cambió la lente, se ignora cuánto mueve la lente los bordes.
 *
 * Los bordes que se recortan al corregir no son exactamente proporcionales en
 * la copia chica, así que la silueta se ubica por el centro, que es el mismo:
 * `full` es el tamaño de la foto de la Mac al quitar el fondo, a la escala de la copia.
 */
export function mapSilhouette(mask: Gray, mac: Geometry, now: Geometry, full: { w: number; h: number }): Gray {
  const w = now.box.x1 - now.box.x0;
  const h = now.box.y1 - now.box.y0;
  const sx = mask.w / full.w;
  const sy = mask.h / full.h;
  const cx = (mac.box.x0 + mac.box.x1) / 2 - full.w / 2;
  const cy = (mac.box.y0 + mac.box.y1) / 2 - full.h / 2;
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let px = x + now.box.x0;
      let py = y + now.box.y0;
      if (now.inv) [px, py] = project(now.inv, px, py);
      px += now.ox - mac.ox;
      py += now.oy - mac.oy;
      if (mac.fwd) [px, py] = project(mac.fwd, px, py);
      d[y * w + x] = sampleGray(mask, (px + 0.5 - cx) * sx - 0.5, (py + 0.5 - cy) * sy - 0.5);
    }
  }
  return { w, h, d };
}

// ───────────────────────────── Balance de blancos ─────────────────────────────

const STRIP = 0.08;

function median(values: Float64Array): number {
  const s = values.slice().sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** np.percentile con interpolación lineal. */
function percentile(values: Float64Array, p: number): number {
  const s = values.slice().sort();
  const pos = (p / 100) * (s.length - 1);
  const i = Math.floor(pos);
  return i + 1 < s.length ? s[i] + (pos - i) * (s[i + 1] - s[i]) : s[i];
}

/** muestra_de_fondo y medir del paso Blancos: cuánto multiplicar cada color para que el fondo quede gris. */
export function backgroundGains(img: Rgb): [number, number, number] {
  const { w, h, d } = img;
  const f = Math.max(2, Math.floor(Math.min(h, w) * STRIP));
  const step = Math.max(1, Math.floor(Math.min(h, w) / 600));
  // La franja de borde: arriba, abajo, izquierda y derecha.
  const bands = [
    [0, f, 0, w],
    [h - f, h, 0, w],
    [f, h - f, 0, f],
    [f, h - f, w - f, w],
  ];
  const span = (a: number, b: number) => Math.max(0, Math.ceil((b - a) / step));
  const total = bands.reduce((sum, [y0, y1, x0, x1]) => sum + span(y0, y1) * span(x0, x1), 0);
  const rgb = new Float64Array(total * 3);
  const { lin: LIN } = colorTables();
  let n = 0;
  for (const [y0, y1, x0, x1] of bands) {
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step, n++) {
        const i = (y * w + x) * 3;
        rgb[n * 3] = Math.fround(look(LIN, d[i]));
        rgb[n * 3 + 1] = Math.fround(look(LIN, d[i + 1]));
        rgb[n * 3 + 2] = Math.fround(look(LIN, d[i + 2]));
      }
    }
  }
  const lum = (k: number) => rgb[k * 3] * LUM[0] + rgb[k * 3 + 1] * LUM[1] + rgb[k * 3 + 2] * LUM[2];
  let keep: number[] = [];
  for (let k = 0; k < total; k++) if (lum(k) > 0.03 && lum(k) < 0.92) keep.push(k);
  if (keep.length >= 50) {
    // Sin los píxeles de más color: pueden ser reflejos de la pieza.
    const tint = Float64Array.from(keep, (k) => {
      const l = Math.max(lum(k), 1e-6);
      return Math.abs(rgb[k * 3] / l - 1) + Math.abs(rgb[k * 3 + 1] / l - 1) + Math.abs(rgb[k * 3 + 2] / l - 1);
    });
    const limit = percentile(tint, 70);
    keep = keep.filter((_, i) => tint[i] <= limit);
  } else {
    keep = Array.from({ length: total }, (_, k) => k);
  }
  const med = [0, 1, 2].map((c) => median(Float64Array.from(keep, (k) => rgb[k * 3 + c])));
  const gray = med[0] * LUM[0] + med[1] * LUM[1] + med[2] * LUM[2];
  return med.map((m) => Math.min(4, Math.max(0.25, gray / Math.max(m, 1e-6)))) as [number, number, number];
}

const K = 0.01;

/** ganancias: la corrección medida, con la intensidad y el ajuste fino pedidos, sin cambiar el brillo de un gris. */
export function whiteGains(values: Record<string, number>, measured: readonly number[]): [number, number, number] {
  const t = values.temperatura ?? 0;
  const tint = values.tinte ?? 0;
  const g = measured.map((m) => Math.exp((Math.log(m) * (values.intensidad ?? 0)) / 100));
  g[0] *= Math.exp(K * t) * Math.exp((K * tint) / 2);
  g[1] *= Math.exp(-K * tint);
  g[2] *= Math.exp(-K * t) * Math.exp((K * tint) / 2);
  const gray = g[0] * LUM[0] + g[1] * LUM[1] + g[2] * LUM[2];
  return [g[0] / gray, g[1] / gray, g[2] / gray];
}

// ───────────────────────────── Luces, sombras y claridad ─────────────────────────────

/** curva: abre las sombras y baja las luces sin dar vuelta el orden de los tonos. */
export function curve(l: number, shadows: number, highlights: number): number {
  const s = shadows / 100;
  const h = highlights / 100;
  // Con multiplicaciones: la potencia es mucho más lenta y esto corre en cada píxel.
  const m2 = (1 - l) * (1 - l);
  let v = l + s * 2.5 * l * m2 * m2;
  const v2 = v * v;
  v = v - h * 2.5 * v2 * v2 * (1 - v);
  return clip01(v);
}

const LEVELS = 256;
const STRENGTH = 0.4;

/** celdas_de: una celda cada 400 px de la foto en tamaño completo, entre 4 y 16. */
export const cellsFor = (h: number, w: number) => Math.max(4, Math.min(16, roundHalfEven(Math.max(h, w) / 400)));

const bounds = (n: number, cells: number) => Array.from({ length: cells + 1 }, (_, i) => Math.floor((i * n) / cells));

/** curvas_locales: una curva de tonos por celda, con el histograma recortado en `limit` veces el parejo. */
export function localCurves(l: Float32Array, w: number, h: number, limit: number, cells: number) {
  const by = bounds(h, cells);
  const bx = bounds(w, cells);
  const curves = new Float32Array(cells * cells * (LEVELS + 1));
  const hist = new Float64Array(LEVELS);
  const top = limit / LEVELS;
  for (let ty = 0; ty < cells; ty++) {
    for (let tx = 0; tx < cells; tx++) {
      hist.fill(0);
      for (let y = by[ty]; y < by[ty + 1]; y++) {
        for (let x = bx[tx]; x < bx[tx + 1]; x++) hist[Math.min(Math.floor(clip01(l[y * w + x]) * LEVELS), LEVELS - 1)]++;
      }
      const total = Math.max(hist.reduce((a, b) => a + b, 0), 1);
      let excess = 0;
      for (let k = 0; k < LEVELS; k++) {
        hist[k] /= total;
        if (hist[k] > top) {
          excess += hist[k] - top;
          hist[k] = top;
        }
      }
      const o = (ty * cells + tx) * (LEVELS + 1);
      let acc = 0;
      for (let k = 0; k < LEVELS; k++) {
        acc += hist[k] + excess / LEVELS;
        curves[o + k + 1] = acc;
      }
      for (let k = 1; k <= LEVELS; k++) curves[o + k] /= acc;
    }
  }
  const cy = by.slice(0, -1).map((b, i) => (b + by[i + 1]) / 2 / h);
  const cx = bx.slice(0, -1).map((b, i) => (b + bx[i + 1]) / 2 / w);
  return { curves, cy, cx, cells };
}

/** _vecinas: las dos celdas más cercanas de cada fila o columna y cuánto pesa la segunda. */
function neighbors(n: number, centers: number[]) {
  const i1 = new Int32Array(n);
  const i2 = new Int32Array(n);
  const wt = new Float32Array(n);
  const last = centers.length - 1;
  for (let j = 0; j < n; j++) {
    const p = (j + 0.5) / n;
    let a = 0;
    while (a < last && centers[a + 1] <= p) a++;
    const b = Math.min(a + 1, last);
    i1[j] = a;
    i2[j] = b;
    wt[j] = b > a ? clip01((p - centers[a]) / Math.max(centers[b] - centers[a], 1e-9)) : 0;
  }
  return { i1, i2, wt };
}

/** aplicar_curvas: cada píxel pasa por las curvas de las cuatro celdas más cercanas. */
export function applyCurves(l: Float32Array, w: number, h: number, c: ReturnType<typeof localCurves>): Float32Array {
  const { curves, cells } = c;
  const ny = neighbors(h, c.cy);
  const nx = neighbors(w, c.cx);
  const out = new Float32Array(w * h);
  const at = (ty: number, tx: number, k: number, f: number) => {
    const o = (ty * cells + tx) * (LEVELS + 1) + k;
    return curves[o] + f * (curves[o + 1] - curves[o]);
  };
  for (let y = 0; y < h; y++) {
    const y1 = ny.i1[y];
    const y2 = ny.i2[y];
    const wy = ny.wt[y];
    for (let x = 0; x < w; x++) {
      const pos = clip01(l[y * w + x]) * LEVELS;
      const k = Math.min(Math.floor(pos), LEVELS - 1);
      const f = pos - k;
      const x1 = nx.i1[x];
      const x2 = nx.i2[x];
      const wx = nx.wt[x];
      const top = at(y1, x1, k, f) * (1 - wx) + at(y1, x2, k, f) * wx;
      const bottom = at(y2, x1, k, f) * (1 - wx) + at(y2, x2, k, f) * wx;
      out[y * w + x] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

/** contraste_local: el realce de detalle, sobre una foto que ya está en el tamaño en que mide la Mac. */
export function localContrast(l: Float32Array, w: number, h: number, clarity: number, cells: number): Float32Array {
  if (clarity <= 0) return l;
  const enhanced = applyCurves(l, w, h, localCurves(l, w, h, 1 + clarity / 10, cells));
  const out = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) out[i] = clip01(l[i] + (clarity / 100) * STRENGTH * (enhanced[i] - l[i]));
  return out;
}

// ───────────────────────────── Blancos, luces y color de una pasada ─────────────────────────────

export type Tones = {
  white?: { values: Record<string, number>; gains: readonly number[] } | null;
  // `cells` sale del tamaño completo de la foto.
  lights?: { values: Record<string, number>; cells: number } | null;
  color?: Record<string, number> | null;
};

/**
 * Blancos.aplicar, Luces.aplicar y Color.aplicar, en ese orden y de una sola
 * pasada por la foto, que es mucho más rápido que tres. Entre un ajuste y el
 * otro la Mac deja la foto en sRGB entre 0 y 1: acá se lleva cada valor a ese
 * rango en el mismo punto.
 */
export function applyTones(img: Rgb, t: Tones): Rgb {
  const wv = t.white?.values;
  const gains = t.white && wv && !((wv.intensidad ?? 0) <= 0 && noChange(wv, ['temperatura', 'tinte'], 1e-6)) ? whiteGains(wv, t.white.gains) : null;
  const lv = t.lights && !noChange(t.lights.values, ['exposicion', 'sombras', 'luces', 'claridad'], 1e-4) ? t.lights.values : null;
  const cv = t.color && !noChange(t.color, ['saturacion', 'vivacidad'], 1e-4) ? t.color : null;
  if (!gains && !lv && !cv) return img;
  const { lin: LIN, srgb: SRGB } = colorTables();
  const n = img.w * img.h;
  const src = img.d;
  const lin = new Float32Array(n * 3);
  const y = lv ? new Float32Array(n) : null;
  const l = lv ? new Float32Array(n) : null;
  const exposure = lv ? 2 ** (lv.exposicion ?? 0) : 1;
  const shadows = lv?.sombras ?? 0;
  const highlights = lv?.luces ?? 0;
  for (let i = 0; i < n; i++) {
    let r = look(LIN, src[i * 3]);
    let g = look(LIN, src[i * 3 + 1]);
    let b = look(LIN, src[i * 3 + 2]);
    if (gains) {
      r = clip01(r * gains[0]);
      g = clip01(g * gains[1]);
      b = clip01(b * gains[2]);
    }
    if (lv) {
      r *= exposure;
      g *= exposure;
      b *= exposure;
      const yy = r * LUM[0] + g * LUM[1] + b * LUM[2];
      y![i] = yy;
      l![i] = curve(look(SRGB, yy), shadows, highlights);
    }
    lin[i * 3] = r;
    lin[i * 3 + 1] = g;
    lin[i * 3 + 2] = b;
  }
  const l2 = lv ? localContrast(l!, img.w, img.h, lv.claridad ?? 0, t.lights!.cells) : null;
  const sat = (cv?.saturacion ?? 0) / 100;
  const viv = (cv?.vivacidad ?? 0) / 100;
  const d = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let r = lin[i * 3];
    let g = lin[i * 3 + 1];
    let b = lin[i * 3 + 2];
    if (lv) {
      // Mismo color, otro brillo: los tres canales por la misma cantidad.
      const yy = y![i];
      const f = yy > 1e-6 ? look(LIN, l2![i]) / Math.max(yy, 1e-6) : 0;
      r = clip01(r * f);
      g = clip01(g * f);
      b = clip01(b * f);
    }
    if (cv) {
      // La vivacidad cuida los colores que ya están saturados en la foto que entra.
      const sr = look(SRGB, r);
      const sg = look(SRGB, g);
      const sb = look(SRGB, b);
      const max = Math.max(sr, sg, sb);
      const now = max > 1e-6 ? (max - Math.min(sr, sg, sb)) / max : 0;
      const yy = r * LUM[0] + g * LUM[1] + b * LUM[2];
      let factor = 1 + sat + viv * (1 - now);
      let nr = yy + (r - yy) * factor;
      let ng = yy + (g - yy) * factor;
      let nb = yy + (b - yy) * factor;
      // Si un color se iría de rango, se lo acerca al gris en lugar de cortarlo.
      if (Math.max(nr, ng, nb) > 1 || Math.min(nr, ng, nb) < 0) {
        factor = Math.min(factor, 1);
        nr = yy + (r - yy) * factor;
        ng = yy + (g - yy) * factor;
        nb = yy + (b - yy) * factor;
      }
      r = nr;
      g = ng;
      b = nb;
    }
    d[i * 3] = look(SRGB, r);
    d[i * 3 + 1] = look(SRGB, g);
    d[i * 3 + 2] = look(SRGB, b);
  }
  return { w: img.w, h: img.h, d };
}

/** Blancos.aplicar. */
export const applyWhite = (img: Rgb, values: Record<string, number>, gains: readonly number[]) => applyTones(img, { white: { values, gains } });
/** Luces.aplicar. */
export const applyLights = (img: Rgb, values: Record<string, number>, cells: number) => applyTones(img, { lights: { values, cells } });
/** Color.aplicar. */
export const applyColor = (img: Rgb, values: Record<string, number>) => applyTones(img, { color: values });

// ───────────────────────────── Fondo, recorte y exportar ─────────────────────────────

/** caja_de_la_pieza: lo que ocupa la silueta. */
export function pieceBox(a: Gray): Box | null {
  let x0 = a.w;
  let y0 = a.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (a.d[y * a.w + x] < 0.5) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** encuadre: el cuadrado con la pieza al centro y el mismo margen de cada lado. */
export function framing(b: Box, margin: number): { side: number; x0: number; y0: number } {
  const side = Math.ceil(Math.max(b.x1 - b.x0, b.y1 - b.y0) / (1 - (2 * margin) / 100));
  return { side, x0: roundHalfEven((b.x0 + b.x1) / 2 - side / 2), y0: roundHalfEven((b.y0 + b.y1) / 2 - side / 2) };
}

export function hexColor(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? 'FFFFFF';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** La foto como el JPG final: sobre el color de fondo y, si hay margen, en el cuadrado del recorte. */
export function compose(img: Rgb, alpha: Gray | null, margin: number | null, background: [number, number, number]): Rgb {
  if (!alpha) return img;
  const frame = margin === null ? null : (() => {
    const b = pieceBox(alpha);
    return b ? framing(b, margin) : null;
  })();
  const w = frame ? frame.side : img.w;
  const h = frame ? frame.side : img.h;
  const ox = frame ? frame.x0 : 0;
  const oy = frame ? frame.y0 : 0;
  const d = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const sx = x + ox;
      const sy = y + oy;
      // Lo que cae afuera de la foto es lienzo vacío.
      const a = sx >= 0 && sy >= 0 && sx < img.w && sy < img.h ? alpha.d[sy * img.w + sx] : 0;
      const j = (sy * img.w + sx) * 3;
      for (let c = 0; c < 3; c++) d[i + c] = (a > 0 ? img.d[j + c] * a : 0) + background[c] * (1 - a);
    }
  }
  return { w, h, d };
}

// ───────────────────────────── Copia a la mitad ─────────────────────────────

function halveRaster(img: Raster): Raster {
  const w = Math.max(1, img.w >> 1);
  const h = Math.max(1, img.h >> 1);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const p = img.rgba;
  for (let y = 0; y < h; y++) {
    const y1 = Math.min(2 * y + 1, img.h - 1);
    for (let x = 0; x < w; x++) {
      const x1 = Math.min(2 * x + 1, img.w - 1);
      const a = (2 * y * img.w + 2 * x) * 4;
      const b = (2 * y * img.w + x1) * 4;
      const c = (y1 * img.w + 2 * x) * 4;
      const e = (y1 * img.w + x1) * 4;
      const o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) rgba[o + k] = (p[a + k] + p[b + k] + p[c + k] + p[e + k]) / 4;
    }
  }
  return { w, h, rgba };
}

function halveGray(img: Gray): Gray {
  const w = Math.max(1, img.w >> 1);
  const h = Math.max(1, img.h >> 1);
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y1 = Math.min(2 * y + 1, img.h - 1);
    for (let x = 0; x < w; x++) {
      const x1 = Math.min(2 * x + 1, img.w - 1);
      d[y * w + x] = (img.d[2 * y * img.w + 2 * x] + img.d[2 * y * img.w + x1] + img.d[y1 * img.w + 2 * x] + img.d[y1 * img.w + x1]) / 4;
    }
  }
  return { w, h, d };
}

/**
 * Lo mismo a la mitad de tamaño: se dibuja cuatro veces más rápido. Sirve
 * mientras se mueve un valor; cuando se suelta, se dibuja en tamaño completo.
 */
export function halfSource(src: LiveSource): LiveSource {
  const images = src.images.map((i) => (i ? halveRaster(i) : null));
  const files = src.pkg.files.map((f, i) => ({ ...f, width: images[i]?.w ?? Math.max(1, f.width >> 1), height: images[i]?.h ?? Math.max(1, f.height >> 1) }));
  return { pkg: { header: src.pkg.header, files }, images, silhouette: src.silhouette ? halveGray(src.silhouette) : null };
}

// ───────────────────────────── Todo junto ─────────────────────────────

export type LivePartKey = 'lente' | 'perspectiva' | 'blancos' | 'luces' | 'color';
export type LiveEdits = Partial<Record<LivePartKey, { on: boolean; values: Record<string, number> }>>;
// Lo que hizo la Mac en cada ajuste.
export type MacPart = { paso: string; aplicado: boolean; valores: Record<string, number>; medidas: Record<string, unknown> };
// El paquete con sus imágenes ya leídas.
export type LiveSource = { pkg: LivePackage; images: (Raster | null)[]; silhouette: Gray | null };

export const LENS_NOTE =
  'Con otra corrección de lente, la silueta del fondo puede verse un poco corrida en los bordes. La Mac la rehace exacta al aplicar.';

const lensOf = (v: Record<string, number>): LensValues => ({ distorsion: v.distorsion ?? 0, aberracion: v.aberracion ?? 0, vineta: v.vineta ?? 0 });
const perspOf = (v: Record<string, number>): PerspectiveValues => ({ giro: v.giro ?? 0, vertical: v.vertical ?? 0, horizontal: v.horizontal ?? 0 });
const geometryKey = (g: Geometry) => JSON.stringify([g.image, g.fwd, g.box]);

/**
 * Arma la vista en vivo de un intento de la Mac. Devuelve una función que
 * recibe los valores de la pantalla y devuelve la foto. Guarda el último
 * encuadre: mover solo el color no vuelve a girar la foto.
 */
export function liveRenderer(src: LiveSource, mac: { parts: MacPart[]; background: string }) {
  const { pkg } = src;
  const base = pkg.files[pkg.header.base];
  const scale = base.width / pkg.header.original.ancho;
  const cut = pkg.header.silueta;
  const full = cut ? { w: cut.ancho_completo * scale, h: (cut.alto_completo * base.height) / pkg.header.original.alto } : null;
  // La Mac deja 4 píxeles de borde al girar; en la copia chica, a escala.
  const radius = Math.max(1, Math.round(4 * scale));
  const part = (paso: string) => mac.parts.find((p) => p.paso === paso);
  const applied = (paso: string) => {
    const p = part(paso);
    return p?.aplicado ? p.valores : null;
  };
  const macLens = applied('lente');
  const macPersp = applied('perspectiva');
  const macGeometry = geometryOf(pkg, macLens ? lensOf(macLens) : null, macPersp ? perspOf(macPersp) : null, radius);
  const silhouette = applied('fondo') ? src.silhouette : null;
  const crop = applied('recorte');
  const margin = crop && typeof crop.margen === 'number' ? crop.margen : null;
  const measured = part('blancos')?.medidas.ganancias;
  const macGains = Array.isArray(measured) && measured.length === 3 && measured.every((v) => typeof v === 'number' && v > 0) ? (measured as number[]) : null;
  const background = hexColor(mac.background);
  let last: { key: string; rgb: Rgb; alpha: Gray | null; same: boolean; gains: [number, number, number] | null } | null = null;

  return (edits: LiveEdits): { image: Rgb; notes: string[] } => {
    const on = (k: LivePartKey) => (edits[k]?.on ? edits[k].values : null);
    const lens = on('lente');
    const persp = on('perspectiva');
    const g = geometryOf(pkg, lens ? lensOf(lens) : null, persp ? perspOf(persp) : null, radius);
    const key = geometryKey(g);
    if (last?.key !== key) {
      const source = src.images[g.image];
      if (!source) throw new LiveError(BROKEN);
      last = {
        key,
        rgb: warp(source, g),
        alpha: silhouette && full ? mapSilhouette(silhouette, macGeometry, g, full) : null,
        same: key === geometryKey(macGeometry),
        gains: null,
      };
    }
    const notes: string[] = [];
    if (silhouette && g.image !== macGeometry.image) notes.push(LENS_NOTE);
    const img = last.rgb;
    const white = on('blancos');
    const lights = on('luces');
    const toned = applyTones(img, {
      // Con el mismo encuadre, la corrección que midió la Mac; si cambió, se mide de nuevo acá.
      white: white ? { values: white, gains: last.same && macGains ? macGains : (last.gains ??= backgroundGains(img)) } : null,
      lights: lights ? { values: lights, cells: cellsFor(img.h / scale, img.w / scale) } : null,
      color: on('color'),
    });
    return { image: compose(toned, last.alpha, margin, background), notes };
  };
}
