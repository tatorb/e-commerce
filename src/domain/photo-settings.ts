import { z } from 'zod';

// Los valores de la línea de imágenes de una cuenta, que se editan en Ajustes,
// Imágenes. Van al trabajador tal cual, con sus nombres
// (trabajador-imagenes/mrb_imagenes/ajustes.py), y los valores por defecto
// son los mismos. Ningún valor, ni el de Claude ni el de una persona, pasa su
// tope: el trabajador los limita.

export type PhotoCapKey =
  | 'giro'
  | 'perspectiva'
  | 'blancos'
  | 'temperatura'
  | 'exposicion'
  | 'sombras'
  | 'luces'
  | 'claridad'
  | 'saturacion'
  | 'vivacidad'
  | 'sombra';

export type PhotoSettingsValues = {
  // Margen alrededor de la pieza, en % del lado del cuadrado final.
  margen: number;
  // Color de fondo del JPG final, #RRGGBB.
  fondo: string;
  calidad_jpg: number;
  // Si las fotos nuevas llevan sombra. En cada foto se puede prender o apagar.
  con_sombra: boolean;
  topes: Record<PhotoCapKey, number>;
};

export const PHOTO_CAPS: { key: PhotoCapKey; label: string; unit: string; help: string; default: number; step: number }[] = [
  { key: 'giro', label: 'Giro', unit: '°', help: 'Cuánto se puede girar la foto para enderezarla.', default: 10, step: 0.5 },
  { key: 'perspectiva', label: 'Perspectiva', unit: '%', help: 'Cuánto se pueden enderezar las líneas que convergen.', default: 15, step: 1 },
  { key: 'blancos', label: 'Balance de blancos', unit: '%', help: 'Qué parte de la corrección medida se puede aplicar.', default: 100, step: 5 },
  { key: 'temperatura', label: 'Temperatura y tinte', unit: '', help: 'El ajuste fino de tono cálido o frío y de tinte.', default: 30, step: 1 },
  { key: 'exposicion', label: 'Exposición', unit: ' pasos', help: 'Cuánto se puede aclarar u oscurecer toda la foto.', default: 1, step: 0.1 },
  { key: 'sombras', label: 'Sombras', unit: '', help: 'Cuánto se pueden abrir las zonas oscuras.', default: 60, step: 1 },
  { key: 'luces', label: 'Luces', unit: '', help: 'Cuánto se pueden recuperar las zonas muy claras.', default: 60, step: 1 },
  { key: 'claridad', label: 'Claridad', unit: '', help: 'El realce del contraste local, que hace leer los detalles.', default: 40, step: 1 },
  { key: 'saturacion', label: 'Saturación', unit: '%', help: 'Cuánto se puede subir o bajar la intensidad de los colores.', default: 30, step: 1 },
  { key: 'vivacidad', label: 'Vivacidad', unit: '', help: 'Como la saturación, pero cuida los colores que ya son intensos.', default: 30, step: 1 },
  { key: 'sombra', label: 'Sombra de la pieza', unit: '%', help: 'Qué tan oscura puede ser la sombra que se agrega debajo de la pieza.', default: 40, step: 1 },
];

export const MARGIN_RANGE = { min: 2, max: 25 };
// Como el paso Exportar: con menos de 80 se notan los bloques del JPG.
export const JPG_QUALITY_RANGE = { min: 80, max: 100 };

export const DEFAULT_PHOTO_SETTINGS: PhotoSettingsValues = {
  margen: 8,
  fondo: '#FFFFFF',
  calidad_jpg: 95,
  con_sombra: true,
  topes: Object.fromEntries(PHOTO_CAPS.map((c) => [c.key, c.default])) as Record<PhotoCapKey, number>,
};

// Un tope nunca puede pasar el doble del valor por defecto, que es el máximo técnico del paso.
export const capMax = (key: PhotoCapKey) => PHOTO_CAPS.find((c) => c.key === key)!.default * 2;

const COLOR = /^#[0-9a-fA-F]{6}$/;

const numberish = (min: number, max: number, message: string) =>
  z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return n;
  });

export const photoSettingsSchema = z.object({
  margen: numberish(MARGIN_RANGE.min, MARGIN_RANGE.max, `El margen va de ${MARGIN_RANGE.min} a ${MARGIN_RANGE.max} %.`),
  fondo: z
    .string()
    .trim()
    .regex(COLOR, 'El color de fondo tiene que ser como #FFFFFF.')
    .transform((v) => v.toUpperCase()),
  calidad_jpg: numberish(
    JPG_QUALITY_RANGE.min,
    JPG_QUALITY_RANGE.max,
    `La calidad del JPG va de ${JPG_QUALITY_RANGE.min} a ${JPG_QUALITY_RANGE.max}.`,
  ).transform((n) => Math.round(n)),
  con_sombra: z.boolean().default(true),
  topes: z.object(
    Object.fromEntries(
      PHOTO_CAPS.map((c) => [c.key, numberish(0, capMax(c.key), `${c.label}: el tope va de 0 a ${capMax(c.key)}.`)]),
    ) as Record<PhotoCapKey, ReturnType<typeof numberish>>,
  ),
});

export type PhotoSettingsInput = z.input<typeof photoSettingsSchema>;

/** Lee lo guardado en la base: lo que falta o no vale toma el valor por defecto. */
export function parsePhotoSettings(raw: unknown): PhotoSettingsValues {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  const topes = r.topes && typeof r.topes === 'object' ? (r.topes as Record<string, unknown>) : {};
  return {
    margen: num(r.margen, MARGIN_RANGE.min, MARGIN_RANGE.max, DEFAULT_PHOTO_SETTINGS.margen),
    fondo: typeof r.fondo === 'string' && COLOR.test(r.fondo) ? r.fondo.toUpperCase() : DEFAULT_PHOTO_SETTINGS.fondo,
    calidad_jpg: Math.round(num(r.calidad_jpg, JPG_QUALITY_RANGE.min, JPG_QUALITY_RANGE.max, DEFAULT_PHOTO_SETTINGS.calidad_jpg)),
    con_sombra: typeof r.con_sombra === 'boolean' ? r.con_sombra : DEFAULT_PHOTO_SETTINGS.con_sombra,
    topes: Object.fromEntries(PHOTO_CAPS.map((c) => [c.key, num(topes[c.key], 0, capMax(c.key), c.default)])) as Record<
      PhotoCapKey,
      number
    >,
  };
}
