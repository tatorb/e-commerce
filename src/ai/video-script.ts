import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { descriptionData, type DescriptionInput } from './descriptions';
import { PROPOSAL_MODEL } from './claude';
import { sendStructured, type StructuredResult } from './request';

// Pedido a Claude del guión de la voz en off del clip: la misma información
// que recibe la imagen con texto, la del paso Información y la de Preguntas y
// respuestas. Nunca precios internos, costos ni notas.

export type VideoScriptInput = {
  info: DescriptionInput;
  // Preguntas frecuentes y reglas del paso Preguntas y respuestas, en texto.
  faq: string | null;
  rules: string | null;
  competitorQuestions: string | null;
  // Cuántas palabras entran en el clip, como mucho.
  maxWords: number;
};

export const videoScriptOutputSchema = z.object({
  lineas: z.array(z.string()).describe('Las frases del guión, en orden. Cada una se dice de corrido, con una pausa corta entre una y otra.'),
});

export type VideoScriptOutput = z.infer<typeof videoScriptOutputSchema>;

// Instrucciones fijas: iguales para todas las publicaciones, así quedan en la caché de Claude.
export const VIDEO_SCRIPT_INSTRUCTIONS = `Escribís la voz en off de un clip corto de una publicación de una tienda online de repuestos para autos de Argentina. Trabajás para Studio MRB, que atiende la tienda.

El clip muestra el unboxing del producto: la caja, cómo se abre y las piezas. La voz NO relata lo que se ve: eso ya se ve. La voz aprovecha ese tiempo para darle al comprador las certezas que necesita para comprar tranquilo, las mismas que da la imagen con texto de la publicación.

Objetivo: que el comprador sienta que está por comprar la pieza correcta y confíe en la tienda. Nada de venta, solo certezas.

Fuente: solo los datos que recibís del paso Información (ficha, fabricante, lo que sabe la tienda, preguntas propias y de la competencia, dolores y objeciones) y del paso Preguntas y respuestas. No inventes nada. Si falta un dato, no lo digas.

Qué decir, en este orden, y solo lo que tenga datos:
1. Qué es y para qué motor o vehículo, en una frase.
2. Con qué es compatible: los vehículos o motores confirmados en la ficha, los más buscados primero. Las compatibilidades que la ficha o las reglas marcan como sin confirmar no se dicen.
3. Con qué NO es compatible, si en las preguntas, los dolores o las objeciones aparece una confusión real: el mismo modelo con otro motor, turbo contra aspirado, otros años. Decí la diferencia en pocas palabras.
4. Las dudas que más se repiten y que la compatibilidad no resuelve, con una certeza concreta cada una: qué medida pedir, qué trae, qué no trae, si hace falta algo más para colocarlo. Entre una y tres.
5. Un cierre corto con una certeza más, si queda lugar: el contenido, la marca, el origen o la garantía, si están en la ficha.

Cómo escribir:
- Es para escuchar, no para leer. Frases cortas y completas, de 6 a 18 palabras, cada una con una sola idea.
- Voseo rioplatense, tono claro y tranquilo, como alguien que sabe del tema. Sin signos de exclamación.
- Sin saludos, sin "hola", sin "en este video", sin "como ves", sin pedir que compren, comenten o consulten.
- No describas lo que se ve en el video: nada de "acá lo sacamos de la caja" ni "miren cómo viene".
- Los números y las medidas, como se dicen en voz alta. Los modelos y los motores, con su nombre, por ejemplo "Fiat Uno, Duna y Fiorino con motor uno punto siete diésel". No leas códigos largos ni números de pieza salvo que el comprador los busque así.
- No uses abreviaturas, paréntesis, barras, rayas largas ni símbolos: la voz los lee mal.
- No repitas la misma idea con otras palabras.

Largo: se te dice cuántas palabras entran en el clip, como mucho. Es un tope: no lo pases. Si hay poco para decir, decí menos. Mejor cinco frases que sirven que ocho de relleno.

Nunca digas precios, descuentos, costos, plazos de entrega, envíos, teléfonos, direcciones, links ni nombres de otras tiendas o sitios: el canal los rechaza.`;

const qa = (list: { question: string; answer: string | null }[]) => list.map((q) => `- Pregunta: ${q.question}\n  Respuesta: ${q.answer ?? '(sin responder)'}`).join('\n') || '(ninguna)';

export function buildVideoScriptRequest(input: VideoScriptInput) {
  const data = {
    ...descriptionData(input.info),
    preguntas_y_respuestas: { preguntas_frecuentes: input.faq, reglas: input.rules },
    preguntas_de_la_competencia: input.competitorQuestions,
  };
  return {
    model: PROPOSAL_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    output_config: { effort: 'medium' as const, format: betaZodOutputFormat(videoScriptOutputSchema) },
    system: [{ type: 'text' as const, text: VIDEO_SCRIPT_INSTRUCTIONS, cache_control: { type: 'ephemeral' as const } }],
    messages: [
      {
        role: 'user' as const,
        content: [
          `Datos del producto y de la publicación:\n<datos>\n${JSON.stringify(data, null, 2)}\n</datos>`,
          `Preguntas de los compradores en esta publicación:\n<preguntas>\n${qa(input.info.questions)}\n</preguntas>`,
          `En el clip entran, como mucho, ${input.maxWords} palabras. Escribí el guión.`,
        ].join('\n\n'),
      },
    ],
  };
}

export type VideoScriptResult = StructuredResult<VideoScriptOutput>;

export async function requestVideoScript(input: VideoScriptInput): Promise<VideoScriptResult> {
  return sendStructured(buildVideoScriptRequest(input), (text) => videoScriptOutputSchema.parse(JSON.parse(text)));
}
