// Las fotos publicadas en Mercado Libre están en http2.mlstatic.com, en varios
// tamaños según la letra del final: -I chica, -O mediana, -F la más grande que
// guarda Mercado Libre. Para corregir se usa siempre la más grande.
//   https://http2.mlstatic.com/D_602711-MLA79386766431_092024-O.jpg
//   https://http2.mlstatic.com/D_NQ_NP_2X_602711-MLA79386766431_092024-F.webp

const PICTURE = /^(.*\/)(?:D_NQ_NP_(?:2X_)?|D_)([^/]+)-[A-Z]\.(?:jpe?g|webp|png)$/i;

export function mercadolibreFullSizePhoto(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.hostname !== 'mlstatic.com' && !u.hostname.endsWith('.mlstatic.com')) return null;
  const clean = `https://${u.hostname}${u.pathname}`;
  const m = clean.match(PICTURE);
  return m ? `${m[1]}D_${m[2]}-F.jpg` : clean;
}
