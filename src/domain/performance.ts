// Rendimiento de publicaciones: el semáforo de cada una según sus visitas y
// sus ventas del período. Los números de las reglas están acá, en un solo
// lugar. No sabe nada de la base de datos ni de los canales.

/** Los números del semáforo. Cambiarlos acá cambia toda la pantalla. */
export const LIGHT_RULES = {
  // Menos de esto, rojo: casi nadie la ve.
  fewVisits: 10,
  // Desde esto y sin ventas, naranja: la ven y no la compran.
  manyVisits: 50,
  // Conversión desde la que es verde, en %.
  goodConversionPct: 1,
};

export const PERIODS = [7, 15, 30, 60, 90] as const;
export type Period = (typeof PERIODS)[number];

export type Light = 'red' | 'orange' | 'yellow' | 'green' | 'gray';

export const LIGHT_ORDER: Light[] = ['red', 'orange', 'yellow', 'gray', 'green'];

export const LIGHT_LABEL: Record<Light, string> = {
  red: 'Rojo',
  orange: 'Naranja',
  yellow: 'Amarillo',
  green: 'Verde',
  gray: 'Gris',
};

/** Qué significa cada color y qué revisar, para el cartel al pasar el mouse. */
export function lightHelp(light: Light, r = LIGHT_RULES): string {
  switch (light) {
    case 'red':
      return `Menos de ${r.fewVisits} visitas y sin ventas: casi nadie la ve. Revisar el título y la ficha.`;
    case 'orange':
      return `${r.manyVisits} visitas o más y ninguna venta: la ven pero no la compran. Revisar las fotos y la descripción.`;
    case 'yellow':
      return `Vende, pero convierte menos de ${r.goodConversionPct} %. Revisar precio, fotos y descripción.`;
    case 'green':
      return `Convierte ${r.goodConversionPct} % o más: está funcionando.`;
    case 'gray':
      return `Entre ${r.fewVisits} y ${r.manyVisits - 1} visitas y sin ventas: pocos datos todavía.`;
  }
}

/** La conversión en %, con un decimal. Null sin visitas. */
export function conversionPct(visits: number | null, sales: number): number | null {
  if (!visits || visits <= 0) return null;
  return Math.round((sales / visits) * 1000) / 10;
}

/**
 * El color de una publicación. Si vendió, manda la conversión: verde desde el
 * mínimo, amarillo por debajo. Sin ventas, mandan las visitas.
 */
export function lightOf(visits: number | null, sales: number, r = LIGHT_RULES): Light {
  if (sales > 0) {
    const pct = visits && visits > 0 ? (sales / visits) * 100 : Infinity;
    return pct >= r.goodConversionPct ? 'green' : 'yellow';
  }
  const v = visits ?? 0;
  if (v < r.fewVisits) return 'red';
  if (v >= r.manyVisits) return 'orange';
  return 'gray';
}

/** Lo que se cambió el día de la última corrección, en palabras. */
export const CORRECTION_FIELD_LABEL: Record<string, string> = {
  title: 'título',
  description: 'descripción',
  photos: 'fotos',
  attributes: 'datos de catálogo',
  price: 'precio',
  installments: 'cuotas',
  discount: 'descuento',
  campaign: 'campaña',
  publication: 'publicación creada',
};

/** Los datos que cuentan como corrección. La cantidad, el estado y lo que llega solo del canal no. */
export const CORRECTION_FIELDS = Object.keys(CORRECTION_FIELD_LABEL);

/** "título, fotos y precio". */
export function correctionText(fields: string[]): string {
  const words = CORRECTION_FIELDS.filter((f) => fields.includes(f)).map((f) => CORRECTION_FIELD_LABEL[f]);
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} y ${words.at(-1)}`;
}
