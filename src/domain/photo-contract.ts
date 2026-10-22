import { z } from 'zod';
import type { PhotoSettingsValues } from './photo-settings';

// Lo que se dicen la app y el trabajador de imágenes. El trabajador pregunta
// por trabajo, avisa que sigue vivo y entrega el resultado; la app nunca le
// habla a la Mac. Del otro lado está trabajador-imagenes/mrb_imagenes/app.py,
// y los ejemplos de trabajador-imagenes/contrato/ los prueban los dos.

// Sube cuando cambia la forma de los mensajes: un trabajador viejo recibe un
// aviso para actualizarse en lugar de un error raro. El 3 suma el paquete para
// editar en vivo y el 4, el ajuste Sombra. Un trabajador anterior sigue
// andando, sin lo que todavía no sabe hacer.
export const PHOTO_PROTOCOLS = [2, 3, 4] as const;
export type PhotoProtocol = (typeof PHOTO_PROTOCOLS)[number];
export const PHOTO_PROTOCOL: PhotoProtocol = 4;
export const LIVE_PROTOCOL: PhotoProtocol = 3;
// Desde qué protocolo sabe hacer el trabajador cada ajuste nuevo.
export const PART_PROTOCOL: Record<string, PhotoProtocol> = { sombra: 4 };

// Cómo bajar o subir un archivo: la app arma el pedido completo, así el
// trabajador no depende de cómo funciona el depósito por dentro.
export type Transfer = { url: string; metodo: 'GET' | 'PUT'; encabezados: Record<string, string> };

export const UPLOAD_KINDS = ['antes', 'vista', 'mascara', 'png', 'jpg', 'vivo'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

// Un ajuste ya hecho de un paso aprobado: con qué valores, o si no se aplicó.
export type RecipePart = { paso: string; valores: Record<string, number>; aplicado: boolean };

export type RecipeEntry = {
  id: string;
  grupo: string;
  indice: number;
  partes: RecipePart[];
  ajustes: PhotoSettingsValues;
};

// Lo que pidió la persona al rehacer un paso: los valores de cada ajuste y los
// que apagó. Un ajuste sin valores pedidos lo propone Claude.
export type StepRequest = { valores: Record<string, Record<string, number>>; apagados: string[] };

export type Job = {
  id: string;
  turno: number;
  foto: string;
  // El paso y sus ajustes, en orden.
  grupo: string;
  indice: number;
  pasos: string[];
  // Qué es la pieza, para que Claude tenga contexto. Nunca precios.
  producto: string | null;
  ajustes: PhotoSettingsValues;
  pedidos: StepRequest | null;
  original: { nombre: string; tipo: string; bajar: Transfer };
  // Los pasos anteriores, para rehacer la foto desde el original si la Mac ya no la tiene.
  receta: RecipeEntry[];
  subidas: Partial<Record<UploadKind, Transfer>>;
};

export type NextResponse = { trabajo: Job | null; volver_en: number };

const protocol = z.union(
  PHOTO_PROTOCOLS.map((p) => z.literal(p)),
  { error: 'El trabajador de imágenes está desactualizado: hay que actualizarlo.' },
);

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

// Lo que pasó en cada ajuste del paso.
export const partSchema = z.object({
  paso: shortText(40),
  // Si se aplicó. No se aplica si la persona lo apagó o si no corresponde.
  aplicado: z.boolean(),
  // Por qué no se pudo aplicar, por ejemplo una foto sin datos de lente.
  no_aplica: shortText(1000).nullable(),
  propuesta: proposalSchema.nullable(),
  valores: numbers,
  medidas: z.record(z.string(), z.unknown()),
  parametros: z.array(paramSchema).max(40),
  nota: shortText(4000).nullable(),
  uso_claude: z.record(z.string(), z.unknown()).nullable(),
  segundos: z.number().nonnegative(),
});
export type StepPart = z.infer<typeof partSchema>;

const doneSchema = z.object({
  protocolo: protocol,
  id: shortText(60),
  turno: z.number().int(),
  ok: z.literal(true),
  partes: z.array(partSchema).min(1).max(10),
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
