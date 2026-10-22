import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyColor,
  applyLights,
  applyTones,
  applyWhite,
  backgroundGains,
  cellsFor,
  curve,
  framing,
  geometryOf,
  halfSource,
  invert3,
  LENS_NOTE,
  LiveError,
  liveRenderer,
  mapSilhouette,
  perspectiveBox,
  perspectiveMatrix,
  pieceBox,
  readLivePackage,
  roundHalfEven,
  shadowLayer,
  whiteGains,
  type Gray,
  type LiveHeader,
  type LivePackage,
  type Raster,
  type Rgb,
} from '@/domain/photo-live';

// Los números de referencia los saca la Mac con sus propias cuentas:
// trabajador-imagenes/tests/armar_referencia_vivo.py.
const ref = JSON.parse(readFileSync(new URL('./fixtures/photo-live-reference.json', import.meta.url), 'utf8'));

const photo = (): Rgb => ({ w: ref.ancho, h: ref.alto, d: Float32Array.from(ref.foto) });

function maxDiff(a: ArrayLike<number>, b: number[]): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// Cuánto se puede alejar un píxel de lo que hace la Mac: menos de medio tono de 255.
const TONE = 2e-3;

describe('editar en vivo: las mismas cuentas que la Mac', () => {
  it('balance de blancos: mide el fondo y corrige igual', () => {
    const { ganancias_medidas: measured, valores, ganancias, resultado } = ref.blancos;
    expect(maxDiff(backgroundGains(photo()), measured)).toBeLessThan(1e-3);
    expect(maxDiff(whiteGains(valores, measured), ganancias)).toBeLessThan(1e-5);
    expect(maxDiff(applyWhite(photo(), valores, measured).d, resultado)).toBeLessThan(TONE);
    // En cero no toca la foto.
    const p = photo();
    expect(applyWhite(p, { intensidad: 0, temperatura: 0, tinte: 0 }, measured)).toBe(p);
  });

  it('luces, sombras y claridad', () => {
    expect(maxDiff(Float32Array.from(ref.curva.tonos, (t: number) => curve(t, ref.curva.sombras, ref.curva.luces)), ref.curva.resultado)).toBeLessThan(1e-5);
    for (const { valores, resultado } of ref.luces) {
      expect(maxDiff(applyLights(photo(), valores, cellsFor(ref.alto, ref.ancho)).d, resultado)).toBeLessThan(TONE);
    }
  });

  it('color, también cuando un color se iría de rango', () => {
    for (const { valores, resultado } of ref.color) expect(maxDiff(applyColor(photo(), valores).d, resultado)).toBeLessThan(TONE);
  });

  it('blancos, luces y color de una pasada dan lo mismo que de a uno en la Mac', () => {
    const { valores, resultado } = ref.juntos;
    const out = applyTones(photo(), {
      white: { values: valores.blancos, gains: ref.blancos.ganancias_medidas },
      lights: { values: valores.luces, cells: cellsFor(ref.alto, ref.ancho) },
      color: valores.color,
    });
    expect(maxDiff(out.d, resultado)).toBeLessThan(TONE);
  });

  it('perspectiva: la misma transformación y el mismo recorte sin esquinas vacías', () => {
    for (const { ancho, alto, valores, matriz, caja } of ref.perspectiva) {
      const m = perspectiveMatrix(ancho, alto, valores.giro, valores.vertical, valores.horizontal);
      expect(maxDiff(m, matriz)).toBeLessThan(1e-6);
      const box = perspectiveBox(ancho, alto, invert3(m), 4);
      expect(box).not.toBeNull();
      expect(maxDiff([box!.x0, box!.y0, box!.x1, box!.y1], caja)).toBeLessThanOrEqual(1);
    }
  });

  it('recorte: la caja de la pieza y el cuadrado con margen parejo', () => {
    const { ancho, alto, alfa, margen, caja, lado, x0, y0 } = ref.recorte;
    const box = pieceBox({ w: ancho, h: alto, d: Float32Array.from(alfa) });
    expect([box!.x0, box!.y0, box!.x1, box!.y1]).toEqual(caja);
    expect(framing(box!, margen)).toEqual({ side: lado, x0, y0 });
    expect(pieceBox({ w: 2, h: 2, d: new Float32Array(4) })).toBeNull();
  });

  it('sombra: el mismo degradado que dibuja la Mac', () => {
    for (const { ancho, alto, alfa, valores, resultado } of ref.sombra) {
      const s = shadowLayer({ w: ancho, h: alto, d: Float32Array.from(alfa) }, valores);
      expect(maxDiff(s.d, resultado)).toBeLessThan(1e-4);
    }
    // Más grande que 512 px: se dibuja achicada y se agranda, como en la Mac.
    const { valores, paso, resultado } = ref.sombra_grande;
    const grande = { w: 600, h: 450, d: new Float32Array(600 * 450) };
    for (let y = 0; y < 450; y++) {
      for (let x = 0; x < 600; x++) {
        const inside = ((x - 300) / 160) ** 2 + ((y - 200) / 110) ** 2 <= 1 || (y >= 300 && y < 340 && x >= 120 && x < 480);
        grande.d[y * 600 + x] = inside ? 1 : 0;
      }
    }
    const s = shadowLayer(grande, valores);
    const sampled: number[] = [];
    for (let y = 0; y < 450; y += paso) for (let x = 0; x < 600; x += paso) sampled.push(s.d[y * 600 + x]);
    expect(maxDiff(sampled, resultado)).toBeLessThan(5e-3);
  });

  it('redondea como Python', () => {
    expect([roundHalfEven(2.5), roundHalfEven(3.5), roundHalfEven(-2.5), roundHalfEven(2.4)]).toEqual([2, 4, -2, 2]);
    expect(cellsFor(4200, 3000)).toBe(10);
  });
});

// Un paquete armado a mano, como lo arma la Mac.
function packageBytes(header: object, body: number[]): ArrayBuffer {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(12 + json.length + body.length);
  out.set(new TextEncoder().encode('MRBVIVO1'));
  new DataView(out.buffer).setUint32(8, json.length, true);
  out.set(json, 12);
  out.set(body, 12 + json.length);
  return out.buffer;
}

describe('el paquete para editar en vivo', () => {
  const header = {
    version: 1,
    original: { ancho: 4000, alto: 3000 },
    base: 0,
    lente: null,
    silueta: { imagen: 1, ancho_completo: 3900, alto_completo: 2900 },
    imagenes: [
      { tipo: 'image/jpeg', inicio: 0, largo: 3, ancho: 1200, alto: 900 },
      { tipo: 'image/png', inicio: 3, largo: 2, ancho: 1170, alto: 870 },
    ],
  };

  it('lee el encabezado y separa las imágenes', () => {
    const pkg = readLivePackage(packageBytes(header, [1, 2, 3, 9, 9]));
    expect(pkg.header.silueta?.ancho_completo).toBe(3900);
    expect([...pkg.files[0].bytes]).toEqual([1, 2, 3]);
    expect([...pkg.files[1].bytes]).toEqual([9, 9]);
    expect(pkg.files[1]).toMatchObject({ type: 'image/png', width: 1170, height: 870 });
  });

  it('rechaza un paquete roto', () => {
    expect(() => readLivePackage(new ArrayBuffer(4))).toThrow(LiveError);
    expect(() => readLivePackage(packageBytes(header, [1, 2]))).toThrow(LiveError);
    expect(() => readLivePackage(packageBytes({ ...header, base: 5 }, [1, 2, 3, 9, 9]))).toThrow(LiveError);
    expect(() => readLivePackage(packageBytes({ ...header, version: 2 }, [1, 2, 3, 9, 9]))).toThrow(LiveError);
  });
});

describe('la vista en vivo armada', () => {
  // Una base de 120 × 90 con una pieza oscura al centro, y su silueta.
  const W = 120;
  const H = 90;
  // Gris claro (217 de 255) con una pieza oscura (77).
  const raster = (w: number, h: number): Raster => ({ w, h, rgba: new Uint8ClampedArray(w * h * 4).fill(217) });
  const LIGHT = 217 / 255;
  const DARK = 77 / 255;
  const base = raster(W, H);
  const silhouette: Gray = { w: W, h: H, d: new Float32Array(W * H) };
  for (let y = 30; y < 60; y++) {
    for (let x = 40; x < 80; x++) {
      base.rgba.fill(77, (y * W + x) * 4, (y * W + x) * 4 + 3);
      silhouette.d[y * W + x] = 1;
    }
  }
  // La copia con la deformación corregida: recortada al centro.
  const lensCopy = raster(110, 82);
  const header: LiveHeader = {
    version: 1,
    original: { ancho: 1200, alto: 900 },
    base: 0,
    lente: [0, 1].flatMap((d) =>
      [0, 1].flatMap((a) => [0, 1].map((v) => ({ distorsion: d as 0 | 1, aberracion: a as 0 | 1, vineta: v as 0 | 1, imagen: d ? 2 : 0 }))),
    ),
    silueta: { imagen: 1, ancho_completo: 1200, alto_completo: 900 },
    imagenes: [
      { tipo: 'image/jpeg', inicio: 0, largo: 1, ancho: W, alto: H },
      { tipo: 'image/png', inicio: 1, largo: 1, ancho: W, alto: H },
      { tipo: 'image/jpeg', inicio: 2, largo: 1, ancho: 110, alto: 82 },
    ],
  };
  const pkg: LivePackage = {
    header,
    files: header.imagenes.map((i) => ({ type: i.tipo, bytes: new Uint8Array(1), width: i.ancho, height: i.alto })),
  };
  const src = { pkg, images: [base, null, lensCopy], silhouette };
  const mac = (extra: { paso: string; aplicado: boolean; valores: Record<string, number> }[] = []) => ({
    background: '#FFFFFF',
    parts: [
      { paso: 'lente', aplicado: false, valores: {}, medidas: {} },
      { paso: 'perspectiva', aplicado: true, valores: { giro: 0, vertical: 0, horizontal: 0 }, medidas: {} },
      { paso: 'fondo', aplicado: true, valores: {}, medidas: {} },
      { paso: 'recorte', aplicado: true, valores: { margen: 10 }, medidas: {} },
      ...extra.map((e) => ({ ...e, medidas: {} })),
    ],
  });

  it('con los valores de la Mac: la pieza centrada en un cuadrado, sobre blanco', () => {
    const { image, notes } = liveRenderer(src, mac())({});
    // La pieza mide 40 de ancho: con 10 % de margen de cada lado, el cuadrado mide 50.
    expect([image.w, image.h]).toEqual([50, 50]);
    expect(image.d[0]).toBeCloseTo(1, 5);
    expect(image.d[(25 * 50 + 25) * 3]).toBeCloseTo(DARK, 5);
    expect(notes).toEqual([]);
  });

  it('al girar, la silueta sigue a la pieza', () => {
    const render = liveRenderer(src, mac());
    const { image } = render({ perspectiva: { on: true, values: { giro: 10, vertical: 0, horizontal: 0 } } });
    // Girada, la pieza ocupa más: el cuadrado crece, y el centro sigue siendo pieza.
    expect(image.w).toBeGreaterThan(50);
    const c = Math.floor(image.w / 2);
    expect(image.d[(c * image.w + c) * 3]).toBeCloseTo(DARK, 2);
  });

  it('sin girar, la silueta movida es la misma', () => {
    const g = geometryOf(pkg, null, null, 1);
    const moved = mapSilhouette(silhouette, g, g, { w: W, h: H });
    expect(maxDiff(moved.d, [...silhouette.d])).toBeLessThan(1e-6);
  });

  it('la silueta se ubica por el centro aunque la copia chica haya quedado más recortada', () => {
    // La Mac quitó el fondo en una foto de 120 × 90; acá el encuadre quedó de 116 × 86, con el mismo centro.
    const g = { ...geometryOf(pkg, null, null, 1), box: { x0: 2, y0: 2, x1: 118, y1: 88 } };
    const moved = mapSilhouette(silhouette, g, g, { w: W, h: H });
    expect([moved.w, moved.h]).toEqual([116, 86]);
    // La pieza (40 a 80 en la foto de la Mac) queda de 38 a 78: corrida, no estirada.
    const row = Array.from({ length: 116 }, (_, x) => moved.d[43 * 116 + x]);
    expect([row.indexOf(1), row.lastIndexOf(1)]).toEqual([38, 77]);
  });

  it('con otra corrección de lente usa la copia de la Mac y lo avisa', () => {
    const { image, notes } = liveRenderer(src, mac())({ lente: { on: true, values: { distorsion: 1, aberracion: 0, vineta: 0 } } });
    expect(notes).toEqual([LENS_NOTE]);
    // La silueta se corre lo que se recortó la copia: la pieza sigue al centro.
    expect([image.w, image.h]).toEqual([50, 50]);
  });

  it('la copia a la mitad da la misma foto, más chica', () => {
    const full = liveRenderer(src, mac())({}).image;
    const half = liveRenderer(halfSource(src), mac())({}).image;
    expect([half.w, half.h]).toEqual([25, 25]);
    expect(half.d[(12 * 25 + 12) * 3]).toBeCloseTo(full.d[(25 * 50 + 25) * 3], 5);
  });

  it('la sombra oscurece el fondo debajo de la pieza y no la pieza', () => {
    const render = liveRenderer(src, mac());
    const sin = render({}).image;
    const con = render({ sombra: { on: true, values: { intensidad: 30, direccion: 0, distancia: 15, suavidad: 40 } } }).image;
    expect([con.w, con.h]).toEqual([sin.w, sin.h]);
    // Justo debajo de la pieza, más oscuro; la pieza y lo de arriba, igual.
    const at = (img: Rgb, x: number, y: number) => img.d[(y * img.w + x) * 3];
    expect(at(con, 25, 41)).toBeLessThan(at(sin, 25, 41) - 0.02);
    expect(at(con, 25, 25)).toBeCloseTo(at(sin, 25, 25), 6);
    expect(at(con, 25, 1)).toBeCloseTo(1, 2);
  });

  it('sin quitar el fondo, se ve la foto entera', () => {
    const parts = mac().parts.map((p) => (p.paso === 'fondo' ? { ...p, aplicado: false } : p));
    const { image } = liveRenderer(src, { ...mac(), parts })({ luces: { on: true, values: { exposicion: 0.5, sombras: 0, luces: 0, claridad: 0 } } });
    expect([image.w, image.h]).toEqual([W, H]);
    // Más exposición, más clara.
    expect(image.d[0]).toBeGreaterThan(LIGHT);
  });
});
