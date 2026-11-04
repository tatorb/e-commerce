import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { descriptionData, type DescriptionInput } from './descriptions';
import { PROPOSAL_MODEL } from './claude';
import { sendStructured, type StructuredResult } from './request';

// Pedido a Claude del contenido de la imagen con texto: la misma información
// del paso Información que recibe la descripción, más las preguntas
// frecuentes y las reglas de la publicación, las preguntas de la competencia
// y la base de marcas de vehículos. Nunca precios internos, costos ni notas.

export type TextImageInput = {
  info: DescriptionInput;
  // Preguntas frecuentes y reglas del paso Preguntas y respuestas, en texto.
  faq: string | null;
  rules: string | null;
  competitorQuestions: string | null;
  brands: { key: string; name: string; aliases: string[] }[];
};

const item = z.object({
  tipo: z.enum(['vehiculo', 'motor']).describe('vehiculo si nombra modelos; motor si nombra un motor sin modelo.'),
  marca: z.string().nullable().describe('Solo si es vehiculo: la clave de la marca en la base de marcas. null si es motor o si la marca no está en la base.'),
  titulo: z.string().describe('Hasta 26 caracteres. Hasta 3 modelos de la misma marca y el mismo motor, separados por " · ".'),
  detalle: z.string().describe('Hasta 40 caracteres. Puede quedar vacío.'),
});

export const textImageOutputSchema = z.object({
  TIPO_PRODUCTO: z.string().describe('Nombre genérico más "para motor". Hasta 35 caracteres.'),
  MOTOR: z.string().describe('El motor como lo busca el comprador. Hasta 45 caracteres.'),
  SELLO: z.string().describe('Siempre "COMPATIBLE".'),
  compatible: z.array(item),
  no_compatible: z.array(item),
  TITULO_DUDAS: z.string().describe('Por defecto "Lo que tenés que saber".'),
  dudas: z
    .array(z.object({ titulo: z.string().describe('Hasta 28 caracteres.'), respuesta: z.string().describe('Hasta 70 caracteres.') }))
    .describe('4 dudas, de más a menos importante.'),
  marcas_faltantes: z.array(z.string()).describe('Las marcas de vehículos que hacen falta y no están en la base, con su nombre. Vacía si están todas.'),
});

export type TextImageOutput = z.infer<typeof textImageOutputSchema>;

// Instrucciones fijas: iguales para todas las publicaciones, así quedan en la caché de Claude.
export const TEXT_IMAGE_INSTRUCTIONS = `Armás el contenido de una imagen de 1200 × 1200 px para una publicación de una tienda online de repuestos para autos de Argentina. Trabajás para Studio MRB, que atiende la tienda.

Objetivo: que el comprador sienta que va a comprar la pieza correcta y confíe en la tienda. Nada de venta, solo certezas. La imagen muestra con qué vehículos o motores es compatible la pieza, con cuáles no y, si hay lugar, lo que tiene que saber antes de comprar.

Fuente: solo los datos que recibís del paso Información (ficha, fabricante, lo que sabe la tienda, preguntas propias y de la competencia, dolores y objeciones) y del paso Preguntas y respuestas. No inventes nada. Si falta un dato, no lo pongas.

Campos:
- TIPO_PRODUCTO: nombre genérico más "para motor", por ejemplo "Subconjunto para motor". Hasta 35 caracteres.
- MOTOR: el motor como lo busca el comprador, por ejemplo "Fiat 1.7 y 1.9 Diésel aspirado". Hasta 45 caracteres.
- SELLO: siempre "COMPATIBLE".
- compatible: solo compatibilidades confirmadas en la ficha. Las que la ficha (por ejemplo en la nota de una compatibilidad) o las reglas de Preguntas y respuestas marcan como sin confirmar no van en ninguna columna.
  - Cada ítem lleva tipo, marca, titulo y detalle.
  - Un ítem es "vehiculo" cuando nombra modelos. Es "motor" cuando nombra un motor sin modelo, por ejemplo "Perkins 4.203" o "Motor M 718".
  - marca: solo si es vehiculo, con la clave de la base de marcas que recibís. Reconocé la marca por su nombre o sus alias. Si la marca no está en la base, poné null y sumala a marcas_faltantes. Nunca inventes una clave.
  - Podés juntar hasta 3 modelos de la misma marca y el mismo motor en un ítem, separados por " · ", por ejemplo "Uno · Duna · Fiorino".
  - titulo hasta 26 caracteres. detalle hasta 40, por ejemplo "1.7 diésel aspirado" o "Años 2012 a 2023".
- no_compatible: mismo formato. Son las confusiones reales que aparecen en las preguntas, los dolores y las objeciones: el mismo modelo con otro motor, turbo contra aspirado, otros años. El detalle explica la diferencia en pocas palabras, por ejemplo "Son turbo, llevan otro pistón". Lo ideal son entre 2 y 4 ítems. Si no hay confusiones reales en los datos, dejala vacía.
- TITULO_DUDAS: por defecto "Lo que tenés que saber". Cambialo solo si el producto lo pide, por ejemplo "Antes de comprar".
- dudas: 4, ordenadas de más a menos importante, porque la imagen puede mostrar solo las 2 primeras. Salen de dolores, objeciones y preguntas repetidas que la compatibilidad no resuelve. titulo es la duda como la diría el comprador, hasta 28 caracteres, por ejemplo "¿Qué medida pido?". respuesta es una certeza concreta, hasta 70 caracteres. Generalas siempre, aunque la compatibilidad tenga muchos ítems.
- marcas_faltantes: los nombres de las marcas que harían falta y no están en la base.

Tono: voseo rioplatense, frases cortas, sin signos de exclamación y sin rayas largas.

Nunca pongas precios, costos, plazos de entrega, teléfonos, direcciones ni links.`;

export function buildTextImageRequest(input: TextImageInput) {
  const data = {
    ...descriptionData(input.info),
    preguntas_y_respuestas: { preguntas_frecuentes: input.faq, reglas: input.rules },
    preguntas_de_la_competencia: input.competitorQuestions,
  };
  const questions =
    input.info.questions.map((q) => `- Pregunta: ${q.question}\n  Respuesta: ${q.answer ?? '(sin responder)'}`).join('\n') || '(ninguna)';
  const brands = input.brands.map((b) => `- ${b.key}: ${b.name}${b.aliases.length > 0 ? ` (también ${b.aliases.join(', ')})` : ''}`).join('\n');
  return {
    model: PROPOSAL_MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    output_config: { effort: 'medium' as const, format: betaZodOutputFormat(textImageOutputSchema) },
    system: [{ type: 'text' as const, text: TEXT_IMAGE_INSTRUCTIONS, cache_control: { type: 'ephemeral' as const } }],
    messages: [
      {
        role: 'user' as const,
        content: [
          `Base de marcas de vehículos (clave: nombre):\n<marcas>\n${brands || '(vacía)'}\n</marcas>`,
          `Datos del producto y de la publicación:\n<datos>\n${JSON.stringify(data, null, 2)}\n</datos>`,
          `Preguntas de los compradores en esta publicación:\n<preguntas>\n${questions}\n</preguntas>`,
          'Armá el contenido de la imagen.',
        ].join('\n\n'),
      },
    ],
  };
}

export type TextImageResult = StructuredResult<TextImageOutput>;

export async function requestTextImage(input: TextImageInput): Promise<TextImageResult> {
  return sendStructured(buildTextImageRequest(input), (text) => textImageOutputSchema.parse(JSON.parse(text)));
}
