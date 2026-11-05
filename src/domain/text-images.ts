import { z } from 'zod';

// Imágenes con texto: una imagen de 1200 × 1200 por publicación que le da
// seguridad al comprador. Dice con qué vehículos o motores es compatible la
// pieza, con cuáles no y, si hay lugar, lo que tiene que saber antes de
// comprar. Este módulo no usa la base: el contenido, sus reglas y la versión.

export const PIECE_SIZE = 1200;

// Versión A: las dos columnas con 3 ítems o menos, y lleva el bloque de dudas.
// Versión B: alguna columna con más de 3, y la compatibilidad ocupa todo el alto.
export const MAX_ITEMS_A = 3;

export const DEFAULT_SEAL = 'COMPATIBLE';
export const DEFAULT_DOUBTS_TITLE = 'Lo que tenés que saber';

// Lo que conviene que mida cada texto para que entre bien. Se puede pasar: la pieza se achica sola.
export const TEXT_LIMITS = { type: 35, engine: 45, itemTitle: 26, itemDetail: 40, doubtTitle: 28, doubtAnswer: 70 } as const;

const text = (max: number) => z.string().trim().max(max, 'Es demasiado largo.');

export const pieceItemSchema = z.object({
  // Un vehículo nombra modelos y lleva el logo de su marca; un motor, el ícono de motor.
  tipo: z.enum(['vehiculo', 'motor']),
  // La clave de la marca en la base de marcas de vehículos. Solo para vehículos.
  marca: z.string().trim().max(60).nullish(),
  titulo: text(120),
  detalle: text(200).default(''),
});

export const pieceDoubtSchema = z.object({
  titulo: text(120),
  respuesta: text(300),
});

export const pieceSchema = z.object({
  TIPO_PRODUCTO: text(120).default(''),
  MOTOR: text(160).default(''),
  SELLO: text(40).default(DEFAULT_SEAL),
  compatible: z.array(pieceItemSchema).max(30, 'Son demasiados ítems.').default([]),
  no_compatible: z.array(pieceItemSchema).max(30, 'Son demasiados ítems.').default([]),
  TITULO_DUDAS: text(80).default(DEFAULT_DOUBTS_TITLE),
  dudas: z.array(pieceDoubtSchema).max(8, 'Son demasiadas dudas.').default([]),
});

export type PieceItem = z.infer<typeof pieceItemSchema>;
export type PieceDoubt = z.infer<typeof pieceDoubtSchema>;
export type PieceContent = z.infer<typeof pieceSchema>;
export type PieceVersion = 'A' | 'B';

export function emptyPiece(): PieceContent {
  return { TIPO_PRODUCTO: '', MOTOR: '', SELLO: DEFAULT_SEAL, compatible: [], no_compatible: [], TITULO_DUDAS: DEFAULT_DOUBTS_TITLE, dudas: [] };
}

/** El contenido guardado, o uno vacío si no sirve. */
export function parsePiece(raw: unknown): PieceContent {
  const r = pieceSchema.safeParse(raw ?? {});
  return r.success ? cleanPiece(r.data) : emptyPiece();
}

/** Sin marcas en los motores ni ítems o dudas vacíos. */
export function cleanPiece(c: PieceContent): PieceContent {
  const items = (list: PieceItem[]) =>
    list
      .filter((x) => x.titulo || x.detalle)
      .map((x): PieceItem => (x.tipo === 'motor' ? { tipo: 'motor', titulo: x.titulo, detalle: x.detalle } : { tipo: 'vehiculo', marca: x.marca || null, titulo: x.titulo, detalle: x.detalle }));
  return {
    ...c,
    SELLO: c.SELLO || DEFAULT_SEAL,
    TITULO_DUDAS: c.TITULO_DUDAS || DEFAULT_DOUBTS_TITLE,
    compatible: items(c.compatible),
    no_compatible: items(c.no_compatible),
    dudas: c.dudas.filter((d) => d.titulo || d.respuesta),
  };
}

/** La versión que corresponde, por la cantidad de ítems de cada columna. */
export function pieceVersion(c: Pick<PieceContent, 'compatible' | 'no_compatible'>): PieceVersion {
  return c.compatible.length > MAX_ITEMS_A || c.no_compatible.length > MAX_ITEMS_A ? 'B' : 'A';
}

/** Las claves de las marcas que usa la pieza, sin repetir. */
export function usedBrands(c: Pick<PieceContent, 'compatible' | 'no_compatible'>): string[] {
  return [...new Set([...c.compatible, ...c.no_compatible].flatMap((x) => (x.tipo === 'vehiculo' && x.marca ? [x.marca] : [])))].sort();
}

/** Lo que falta para poder generar el PNG. Vacío si está todo. La foto no hace falta: sin foto, ese lugar queda vacío. */
export function pieceMissing(c: PieceContent): string[] {
  return [
    ...(!c.TIPO_PRODUCTO ? ['Falta el tipo de producto.'] : []),
    ...(!c.MOTOR ? ['Falta el motor.'] : []),
    ...(c.compatible.length === 0 ? ['Falta al menos un ítem en Compatible con.'] : []),
    ...(c.compatible.concat(c.no_compatible).some((x) => !x.titulo) ? ['Hay un ítem sin título.'] : []),
  ];
}

/** Los textos más largos de lo que conviene: es solo un aviso, la pieza se achica sola. */
export function pieceLengthNotes(c: PieceContent): string[] {
  const out: string[] = [];
  const check = (value: string, max: number, what: string) => {
    if (value.length > max) out.push(`${what} tiene ${value.length} caracteres; conviene hasta ${max}.`);
  };
  check(c.TIPO_PRODUCTO, TEXT_LIMITS.type, 'El tipo de producto');
  check(c.MOTOR, TEXT_LIMITS.engine, 'El motor');
  for (const x of [...c.compatible, ...c.no_compatible]) {
    check(x.titulo, TEXT_LIMITS.itemTitle, `«${x.titulo}»`);
    check(x.detalle, TEXT_LIMITS.itemDetail, `El detalle de «${x.titulo}»`);
  }
  for (const d of c.dudas) {
    check(d.titulo, TEXT_LIMITS.doubtTitle, `La duda «${d.titulo}»`);
    check(d.respuesta, TEXT_LIMITS.doubtAnswer, `La respuesta de «${d.titulo}»`);
  }
  return out;
}

// ───────────────────────────── Marcas de vehículos ─────────────────────────────

export type BrandRef = { key: string; name: string; aliases: string[] };

/** Un nombre como se compara: sin mayúsculas, tildes, espacios ni guiones. */
export function brandText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** La clave de una marca de la base por su clave, nombre o alias. Null si no está. */
export function brandKeyOf(value: string | null | undefined, brands: BrandRef[]): string | null {
  const t = brandText(value);
  if (!t) return null;
  return brands.find((b) => brandText(b.key) === t || brandText(b.name) === t || b.aliases.some((a) => brandText(a) === t))?.key ?? null;
}

/** La clave para una marca nueva: "Mercedes-Benz" es mercedes-benz. */
export function newBrandKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const brandInput = z.object({
  name: z.string().trim().min(1, 'Poné el nombre de la marca.').max(60, 'El nombre es muy largo.'),
  // Separados por coma.
  aliases: z.array(z.string().trim().min(1).max(60)).max(20, 'Son demasiados alias.').default([]),
});

/** Los alias escritos con comas, sin repetir y sin el nombre. */
export function parseAliases(raw: string, name: string): string[] {
  const seen = new Set<string>([brandText(name)]);
  return raw
    .split(',')
    .map((a) => a.trim())
    .filter((a) => {
      const t = brandText(a);
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

// Los logos: el archivo oficial, sin que la app lo dibuje.
export const LOGO_TYPES: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png' };
export const LOGO_MAX_BYTES = 1024 * 1024;

/** El tipo de un logo por su nombre, o por qué no sirve. */
export function logoType(file: { name: string; size: number }): { ok: true; type: string } | { ok: false; error: string } {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const type = LOGO_TYPES[ext];
  if (!type) return { ok: false, error: 'El logo tiene que ser un SVG o un PNG transparente.' };
  if (!(file.size > 0) || file.size > LOGO_MAX_BYTES) return { ok: false, error: 'El logo pesa más de 1 MB.' };
  return { ok: true, type };
}
