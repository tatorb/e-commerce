import { z } from 'zod';
import type { PhotoSettingsValues } from './photo-settings';

// Lo que se dicen la app y el trabajador de imágenes. El trabajador pregunta
// por trabajo, avisa que sigue vivo y entrega el resultado; la app nunca le
// habla a la Mac. Del otro lado está trabajador-imagenes/mrb_imagenes/app.py,
// y los ejemplos de trabajador-imagenes/contrato/ los prueban los dos.

// Sube cuando cambia la forma de los mensajes: un trabajador viejo recibe un
// aviso para actualizarse en lugar de un error raro.
export const PHOTO_PROTOCOL = 1;

// Cómo bajar o subir un archivo: la app arma el pedido completo, así el
// trabajador no depende de cómo funciona el depósito por dentro.
export type Transfer = { url: string; metodo: 'GET' | 'PUT'; encabezados: Record<string, string> };

export const UPLOAD_KINDS = ['antes', 'vista', 'mascara', 'png', 'jpg'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export type RecipeEntry = {
  id: string;
  paso: string;
  indice: number;
  valores: Record<string, number>;
  salteado: boolean;
  ajustes: PhotoSettingsValues;
};

export type Job = {
  id: string;
  turno: number;
  foto: string;
  paso: string;
  indice: number;
  // Qué es la pieza, para que Claude tenga contexto. Nunca precios.
  producto: string | null;
  ajustes: PhotoSettingsValues;
  // Los valores que pidió la persona al rehacer. Sin pedido, propone Claude.
  pedidos: Record<string, number> | null;
  original: { nombre: string; tipo: string; bajar: Transfer };
  // Los pasos anteriores, para rehacer la foto desde el original si la Mac ya no la tiene.
  receta: RecipeEntry[];
  subidas: Partial<Record<UploadKind, Transfer>>;
};

export type NextResponse = { trabajo: Job | null; volver_en: number };

const protocol = z.literal(PHOTO_PROTOCOL, {
  error: 'El trabajador de imágenes está desactualizado: hay que actualizarlo.',
});

const shortText = (max: number) => z.string().max(max);
const numbers = z.record(z.string().max(60), z.number());

export const nextRequestSchema = z.object({
  protocolo: protocol,
  version: shortText(40).optional(),
  // Lo que cuenta el trabajador de sí mismo, para mostrar en la app.
  info: z
    .object({
      modelo_fondo: shortText(80).nullish(),
      memoria_gb: z.number().nullish(),
      sistema: shortText(120).nullish(),
      aviso: shortText(500).nullish(),
    })
    .partial()
    .nullish(),
});

export const heartbeatSchema = z.object({ protocolo: protocol, id: shortText(60), turno: z.number().int() });

export const paramSchema = z.object({
  clave: shortText(60),
  etiqueta: shortText(120),
  ayuda: shortText(500),
  minimo: z.number(),
  maximo: z.number(),
  defecto: z.number(),
  paso: z.number(),
  unidad: shortText(20),
  tipo: z.enum(['numero', 'si_no']),
});
export type StepParam = z.infer<typeof paramSchema>;

export const proposalSchema = z.object({
  valores: numbers,
  razon: shortText(2000),
  // claude, medido (Claude no respondió) o simulado.
  origen: shortText(20),
  aviso: shortText(2000).nullish(),
});
export type StepProposal = z.infer<typeof proposalSchema>;

const doneSchema = z.object({
  protocolo: protocol,
  id: shortText(60),
  turno: z.number().int(),
  ok: z.literal(true),
  propuesta: proposalSchema.nullable(),
  valores: numbers,
  medidas: z.record(z.string(), z.unknown()),
  parametros: z.array(paramSchema).max(40),
  nota: shortText(4000).nullable(),
  // Por qué no se pudo aplicar el paso: queda salteado solo.
  no_aplica: shortText(1000).nullable(),
  uso_claude: z.record(z.string(), z.unknown()).nullable(),
  segundos: z.number().nonnegative(),
  archivos: z.array(z.enum(UPLOAD_KINDS)).max(UPLOAD_KINDS.length),
  // Solo en el primer paso: cómo es el original ya preparado.
  original: z
    .object({
      ancho: z.number().int().positive(),
      alto: z.number().int().positive(),
      camara: z.record(z.string(), z.unknown()).nullable(),
    })
    .nullable(),
});

const failedSchema = z.object({
  protocolo: protocol,
  id: shortText(60),
  turno: z.number().int(),
  ok: z.literal(false),
  error: shortText(4000),
});

export const resultSchema = z.discriminatedUnion('ok', [doneSchema, failedSchema]);
export type WorkerResult = z.infer<typeof resultSchema>;
export type WorkerDone = z.infer<typeof doneSchema>;
