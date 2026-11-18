// La medida de un video. Un producto con varias medidas (estándar, 0,60...)
// puede tener un video por medida: la etiqueta de la caja muestra la medida.
// La medida sale de tres lugares, el primero que haya:
//   1. la eligió una persona en el paso Videos;
//   2. se grabó con su medida en Registro de productos;
//   3. el nombre del archivo trae el SKU de la medida, por ejemplo SP-449-060.MP4.

export type MeasureLike = { key: string; label: string; sku: string | null };

// Las partes de un texto, sin ceros a la izquierda en los números: así
// SP-449-060 y SP-449-60 son lo mismo, y SP-449-00 no se confunde con ellos.
function parts(text: string): string[] {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? String(Number(p)) : p));
}

function contains(name: string[], sku: string[]): boolean {
  if (sku.length === 0 || sku.length > name.length) return false;
  for (let i = 0; i + sku.length <= name.length; i++) if (sku.every((p, j) => name[i + j] === p)) return true;
  return false;
}

/**
 * La medida que dice el nombre del archivo, si trae el SKU de una sola medida.
 * Si el nombre trae el de varias, gana el más largo; si empatan, ninguna.
 */
export function measureFromName(fileName: string, measures: MeasureLike[]): MeasureLike | null {
  if (measures.length < 2) return null;
  const name = parts(fileName.replace(/\.[A-Za-z0-9]{2,4}$/, ''));
  const hits = measures
    .map((m) => ({ m, sku: m.sku ? parts(m.sku) : [] }))
    // Un SKU de una sola parte, como "60", aparece en cualquier nombre: no alcanza.
    .filter((h) => h.sku.length >= 2 && contains(name, h.sku))
    .sort((a, b) => b.sku.length - a.sku.length);
  if (hits.length === 0) return null;
  if (hits.length > 1 && hits[1].sku.length === hits[0].sku.length) return null;
  return hits[0].m;
}
