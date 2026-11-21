// Los tipos de lectura.js, para las pruebas de la app. Chrome no usa este archivo.
type Articulo = Record<string, unknown>;
type Catalogo = { claves: Set<string>; marcas: Set<string>; cruces: Map<number, unknown> };
export function normalizar(s: unknown): string;
export function codigoSinMedida(codigo: unknown, medidaNombre: unknown): string;
export function stockDe(articulo: Articulo): { cordoba: number; santaFe: number };
export function costoDe(articulo: Articulo): { costo: number | null; sospechoso: boolean };
export function paraLaApp(articulo: Articulo, conCosto: boolean): Record<string, unknown>;
export function clasificar(articulo: Articulo, catalogo: Catalogo): 'candidato' | 'sin_producto' | null;
export function sinPrecios(v: unknown): unknown;
export function fichaPermitida(respuesta: unknown): Record<string, unknown> | null;
export function camposDe(respuesta: unknown): string[];
export function faltaFicha(enviado: { detalle?: unknown; bocas?: unknown }, cruce: { ignorado?: boolean; ficha_leida?: string | null; detalle?: unknown; bocas?: unknown } | undefined, cadaDias: number, ahora: number): 0 | 1 | 2;
export function tandas<T extends { codigo: string; medida?: string | null }>(articulos: T[], tamano: number, tope: number): T[][];
export function proximaHora(hora: string, ahora: number): number;
