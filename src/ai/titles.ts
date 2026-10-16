import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { TitleRules } from '@/domain/title-rules';
import { PROPOSAL_MODEL } from './claude';
import { sendStructured, type StructuredResult } from './request';

// Pedido a Claude de 3 títulos para una publicación. Recibe solo lo que hace
// falta para escribir el título: datos de la ficha, las palabras elegidas, las
// búsquedas sugeridas y los títulos de la competencia. Nunca precios, visitas
// ni ventas. El chequeo de reglas y de búsquedas lo hace la app, no la IA.

export type TitleInput = {
  channelName: string;
  rules: TitleRules;
  structure: string | null;
  product: {
    productType: string | null;
    brand: string | null;
    partNumber: string | null;
    line: string | null;
    compatibilities: {
      vehicleBrand: string | null;
      model: string | null;
      engine: string | null;
      displacement: string | null;
      fuel: string | null;
      yearFrom: number | null;
      yearTo: number | null;
    }[];
  };
  currentTitle: string | null;
  // Tildadas, en el orden en que aparecen en las sugerencias.
  words: string[];
  // Búsquedas sugeridas por el buscador del canal, en su orden.
  suggestions: string[];
  competitorTitles: string[];
};

export const titleOutputSchema = z.object({
  proposals: z
    .array(
      z.object({
        title: z.string().describe('El título completo.'),
        reason: z.string().describe('Qué búsquedas prioriza y por qué, en una oración simple.'),
      }),
    )
    .describe('Exactamente 3 títulos distintos entre sí.'),
});

export type TitleOutput = z.infer<typeof titleOutputSchema>;

export const TITLE_INSTRUCTIONS = `Sos especialista en títulos de publicaciones de repuestos para autos en tiendas online de Argentina. Trabajás para Studio MRB.

Vas a recibir los datos de un producto, las palabras que la persona eligió para el título, las búsquedas que sugiere el buscador del canal y títulos de la competencia que venden mucho. Proponé 3 títulos distintos.

Reglas:
- Usá solo las palabras elegidas. Podés sumar únicamente conectores como "de", "para", "con" o "y" si hacen falta para que se lea bien.
- Ordená las palabras como aparecen en las búsquedas sugeridas: lo que la gente escribe primero va primero.
- Escribí cada palabra como la escribe la gente en las búsquedas, con mayúscula inicial en cada palabra.
- Cada título tiene que cubrir la mayor cantidad posible de búsquedas sugeridas, sin repetir palabras.
- Respetá el largo máximo, los signos y las palabras no permitidas que se indican.
- Seguí la estructura sugerida si hay una.
- No inventes datos: si una palabra elegida contradice los datos del producto, dejala afuera.
- Los 3 títulos tienen que ser distintos entre sí: por ejemplo, uno que priorice el modelo, otro el motor y otro la marca del vehículo.

Escribí en castellano de Argentina. No uses el guion largo.`;

function rulesBlock(input: TitleInput): string {
  const r = input.rules;
  return [
    `Canal: ${input.channelName}.`,
    r.maxLength ? `Largo máximo: ${r.maxLength} caracteres, contando espacios.` : 'Sin largo máximo.',
    r.forbiddenChars ? `Signos no permitidos: ${[...r.forbiddenChars].join(' ')}` : 'Sin signos prohibidos.',
    r.forbiddenWords.length > 0 ? `Palabras no permitidas: ${r.forbiddenWords.join(', ')}.` : 'Sin palabras prohibidas.',
    input.structure ? `Estructura sugerida: ${input.structure}.` : 'Sin estructura sugerida.',
  ].join('\n');
}

export function titleData(input: TitleInput) {
  const p = input.product;
  return {
    tipo_de_producto: p.productType,
    marca_del_repuesto: p.brand,
    numero_de_pieza: p.partNumber,
    linea: p.line,
    compatibilidades: p.compatibilities.map((c) => ({
      marca: c.vehicleBrand,
      modelo: c.model,
      motor: c.engine,
      cilindrada: c.displacement,
      combustible: c.fuel,
      desde: c.yearFrom,
      hasta: c.yearTo,
    })),
    titulo_actual: input.currentTitle,
    palabras_elegidas: input.words,
    busquedas_sugeridas: input.suggestions.slice(0, 120),
    titulos_de_la_competencia: input.competitorTitles,
  };
}

export function buildTitleRequest(input: TitleInput) {
  return {
    model: PROPOSAL_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    output_config: { effort: 'medium' as const, format: betaZodOutputFormat(titleOutputSchema) },
    system: [
      { type: 'text' as const, text: TITLE_INSTRUCTIONS, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: rulesBlock(input) },
    ],
    messages: [
      {
        role: 'user' as const,
        content: `Datos para el título:\n<datos>\n${JSON.stringify(titleData(input), null, 2)}\n</datos>\n\nProponé los 3 títulos.`,
      },
    ],
  };
}

export type TitleResult = StructuredResult<TitleOutput>;

export async function requestTitles(input: TitleInput): Promise<TitleResult> {
  return sendStructured(buildTitleRequest(input), (text) => titleOutputSchema.parse(JSON.parse(text)));
}

/** Los títulos limpios, sin vacíos ni repetidos, hasta 3. */
export function cleanTitleProposals(output: TitleOutput): { title: string; reason: string }[] {
  const out: { title: string; reason: string }[] = [];
  for (const p of output.proposals) {
    const title = p.title.replace(/\s+/g, ' ').trim();
    if (title && !out.some((o) => o.title.toLowerCase() === title.toLowerCase())) out.push({ title, reason: p.reason.trim() });
  }
  return out.slice(0, 3);
}
