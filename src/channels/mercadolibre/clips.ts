import type { ClipRules } from '@/domain/videos';

// Los clips de Mercado Libre: videos cortos verticales que se ven en la
// publicación y en el feed de videos. Mercado Libre no deja subirlos por API:
// se suben a mano desde la cuenta del vendedor y pasan por una revisión.
// Las medidas salen de lo que publican Mercado Libre y las herramientas para
// vendedores; el peso máximo no está del todo claro, así que se toma el más
// citado. El clip es uno por publicación: se ve en todas sus medidas.
export const MERCADOLIBRE_CLIPS: ClipRules = {
  name: 'clip',
  minSeconds: 10,
  maxSeconds: 60,
  maxBytes: 280 * 1024 ** 2,
  minSize: { short: 360, long: 640 },
  idealSize: { short: 720, long: 1280 },
  ratio: { width: 9, height: 16 },
  formats: ['mp4', 'mov', 'mpeg', 'mpg', 'avi'],
  guide: [
    'Bajá el video desde el Drive. En la Mac ya está en la carpeta del producto.',
    'En Mercado Libre, entrá a Publicaciones y buscá la publicación por su código.',
    'En el menú de opciones de la publicación, tocá Subir video y elegí el archivo.',
    'Mercado Libre lo revisa antes de mostrarlo. Puede tardar unas horas.',
    'Volvé acá y tocá Ya lo subí, así queda anotado.',
  ],
  perVariant: false,
};
