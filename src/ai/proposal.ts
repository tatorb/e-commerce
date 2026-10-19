import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { comboForAi, type ComboPart } from '@/domain/combos';
import { cleanText, type Compat, type ContentField, type ContentSnapshot, type IncomingContent } from '@/domain/content';
import { nameValueSchema } from '@/domain/name-value';
import type { ProposalDraft } from '@/domain/proposals';
import { PROPOSAL_MODEL } from './claude';
import { sendStructured, type StructuredResult } from './request';

export { ProposalError } from './request';

// Pedido a Claude de una propuesta de publicación. Trabaja con la ficha
// maestra y la publicación; del canal solo recibe el nombre y el largo máximo
// del título. Nunca se le mandan precios, visitas ni ventas.

export type ProposalInput = {
  accountName: string;
  channel: { name: string; titleMaxLength: number | null };
  rules: { name: string; description: string | null; checks: string; weight: number }[];
  missing: { name: string; detail: string | null }[];
  productName: string;
  content: ContentSnapshot;
  // Los productos del combo, o null si es un individual.
  combo: ComboPart[] | null;
  // Las otras publicaciones del mismo producto: comparten la ficha.
  otherPublications: { store: string; title: string | null }[];
  // De la última medición, solo lo que describe la publicación.
  listing: { photoCount: number | null; hasVideo: boolean | null; channelQuality: number | null; channelGoals: string | null };
};

// La respuesta no usa campos que puedan ser "null o un valor": la API tiene
// un límite bajo para ese tipo de campos y rechaza el pedido si se pasa. Un
// texto vacío o una lista vacía quiere decir "sin cambios", y un año 0, "no se
// sabe".

const textField = (what: string) =>
  z.object({
    value: z.string().describe(`${what} propuesto completo, o vacío si no hay nada que mejorar.`),
    reason: z.string().describe('Por qué cambia, en una oración simple. Vacío si no cambia.'),
    toConfirm: z.array(z.string()).describe('Qué hay que confirmar antes de publicar. Vacía si no hay nada.'),
  });

const listField = <T extends z.ZodType>(item: T, what: string) =>
  z.object({
    items: z.array(item).describe(`${what} completa propuesta, o vacía si no hay nada que mejorar.`),
    reason: z.string().describe('Por qué cambia, en una oración simple. Vacío si no cambia.'),
    toConfirm: z.array(z.string()).describe('Qué hay que confirmar antes de publicar. Vacía si no hay nada.'),
  });

export const proposalOutputSchema = z.object({
  summary: z.string().describe('Lo más importante que cambia, en dos oraciones como máximo.'),
  title: textField('Título'),
  description: textField('Descripción'),
  brand: textField('Marca del repuesto'),
  partNumber: textField('Número de pieza'),
  kitContents: textField('Contenido del kit'),
  warranty: textField('Garantía'),
  measures: listField(
    z.object({ sku: z.string().describe('Vacío si el producto no tiene SKU.'), measure: z.string() }),
    'Lista de medidas, una por SKU,',
  ),
  specs: listField(z.object({ name: z.string(), value: z.string() }), 'Ficha técnica'),
  compatibilities: listField(
    z.object({
      vehicleBrand: z.string().describe('Vacío si no se sabe.'),
      model: z.string().describe('Vacío si no se sabe.'),
      engine: z.string().describe('Vacío si no se sabe.'),
      yearFrom: z.number().int().describe('0 si no se sabe.'),
      yearTo: z.number().int().describe('0 si no se sabe.'),
      note: z.string().describe('Vacío si no hay nota.'),
    }),
    'Lista de compatibilidades',
  ),
});

export type ProposalOutput = z.infer<typeof proposalOutputSchema>;

// Instrucciones fijas: iguales para todas las publicaciones, así quedan en la
// caché de Claude y las tandas salen más baratas.
export const PROPOSAL_INSTRUCTIONS = `Sos especialista en publicaciones de repuestos para autos en tiendas online de Argentina. Trabajás para Studio MRB, que mejora las publicaciones de sus clientes.

Vas a recibir lo que la app sabe hoy de una publicación y de su producto, el estándar de publicación de la cuenta y lo que esa publicación no cumple. Tu tarea es proponer una versión mejor, campo por campo, para que cumpla el estándar y el comprador pueda decidir sin tener que preguntar.

Regla principal: no inventes datos técnicos.
- Usá solo información que esté en los datos que recibís. Podés reordenar, corregir la redacción, unificar formatos y llevar datos de un campo a otro. Por ejemplo, la marca, el modelo y el motor que aparecen en el título pueden pasar a compatibilidades.
- Nunca agregues medidas, materiales, años, modelos, motores, garantías ni contenidos de kit que no surjan de los datos.
- Si un dato hace falta y no está, no lo completes. Agregalo a "toConfirm" de ese campo con una frase corta que diga qué hay que confirmar. Si el dato tiene que aparecer dentro de un texto, escribí [A CONFIRMAR: qué falta] en ese lugar.
- Si deducís algo muy probable pero no seguro, por ejemplo que "0.50" en un cojinete es 0,50 mm, proponelo y agregá a "toConfirm" qué hay que verificar.

La ficha es del producto:
- La marca, el número de pieza, la ficha técnica, las medidas y las compatibilidades son del producto. Si recibís "otras_publicaciones_del_producto", esas publicaciones usan la misma ficha, y cada una puede apuntar a otro vehículo o a otra presentación.
- Por eso, en las listas no saques filas solo porque no aparecen en el título de esta publicación: sumá o corregí lo que haga falta y dejá lo demás. El título y la descripción sí son solo de esta publicación.

Combos:
- Si "individual_o_combo" dice Combo, la publicación vende juntos los productos de "productos_del_combo", con su cantidad.
- El título y la descripción tienen que dejar claro que trae varios productos y cuáles.
- En contenido del kit podés listar los productos del combo con su cantidad.
- La marca y el número de pieza de un componente no son los del combo: no los copies al combo.

Cómo responder cada campo:
- Si no tenés nada que mejorar, devolvé value vacío o items como lista vacía, reason vacío y toConfirm vacía.
- Si proponés un cambio, devolvé el valor completo, no solo la parte que cambia.
- "reason" es una oración simple que explica por qué cambia.

Título:
- Respetá el largo máximo del canal.
- Orden sugerido: tipo de producto, marca y modelos del vehículo, motor y el dato clave, como la medida. La marca del repuesto solo si suma.
- Sin palabras de promoción, sin mayúsculas sostenidas, sin signos de exclamación, sin SKU y sin repetir palabras.

Descripción:
- Texto plano, sin HTML, sin emojis, sin links, sin datos de contacto, sin precios ni promociones.
- Primero una línea que diga qué es y para qué vehículos. Después, en este orden y solo si hay datos: Compatibilidad, Datos técnicos, Contenido del kit, Medidas y Garantía. Cada sección con su nombre en una línea y debajo una línea por dato, empezando con un guion.
- Si el estándar pide un mínimo de caracteres, cumplilo con información útil, nunca con relleno.

Ficha técnica: un dato por fila, con nombre corto y valor con unidad. Usá nombres consistentes, como "Diámetro", "Material" o "Cantidad de piezas".
Compatibilidades: una fila por vehículo, con marca, modelo y motor por separado. Los años solo si figuran en los datos. Si no, dejalos en 0 y pedí confirmarlos.
Medidas: una por SKU, con unidad en mm o pulgadas, o "STD". Si la medida actual no tiene unidad, proponé la más probable y pedí confirmarla.
Marca del repuesto, número de pieza, contenido del kit y garantía: solo si surgen de los datos.
Fotos y video: no los podés generar. No los menciones en la propuesta.

Escribí en castellano de Argentina, claro y profesional, sin exagerar. No uses el guion largo.`;

/** Lo que cambia por cuenta y canal: el estándar y el largo del título. */
function standardBlock(input: ProposalInput): string {
  const lines = [
    `Cuenta: ${input.accountName}. Canal: ${input.channel.name}.`,
    input.channel.titleMaxLength
      ? `Largo máximo del título en este canal: ${input.channel.titleMaxLength} caracteres.`
      : 'Este canal no tiene un largo máximo de título.',
    '',
    'Estándar de publicación de la cuenta para este canal:',
    ...input.rules.map(
      (r) => `- ${r.name} (peso ${r.weight}). Revisa: ${r.checks}.${r.description ? ` ${r.description}` : ''}`,
    ),
  ];
  return lines.join('\n');
}

/** Los datos de la publicación, sin IDs internos, precios ni métricas de venta. */
export function publicationData(input: ProposalInput) {
  const c = input.content;
  return {
    producto: input.productName,
    ...comboForAi(input.combo),
    otras_publicaciones_del_producto: input.otherPublications.map((p) => ({ tienda: p.store, titulo: p.title })),
    titulo: c.title,
    descripcion: c.description,
    marca_del_repuesto: c.brand,
    numero_de_pieza: c.partNumber,
    tipo_de_producto: c.productType,
    sistema_del_motor: c.engineSystem,
    linea: c.line,
    origen: c.origin,
    garantia: c.warranty,
    contenido_del_kit: c.kitContents,
    medidas: c.measures.map((m) => ({ sku: m.sku, medida: m.measure })),
    ficha_tecnica: c.specs,
    compatibilidades: c.compatibilities,
    fotos: c.photos.length > 0 ? c.photos.length : input.listing.photoCount,
    tiene_video: c.videos.length > 0 ? true : input.listing.hasVideo,
    segun_el_canal: {
      calidad: input.listing.channelQuality,
      objetivos: input.listing.channelGoals,
    },
  };
}

export function buildProposalRequest(input: ProposalInput) {
  const missing =
    input.missing.length === 0
      ? 'Cumple todas las reglas del estándar. Mejorá lo que haga falta sin inventar.'
      : input.missing.map((m) => `- ${m.name}${m.detail ? `: ${m.detail}` : ''}`).join('\n');
  return {
    model: PROPOSAL_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    // Si Claude rechaza el pedido, el servicio lo reintenta con el modelo que recomienda.
    fallbacks: 'default' as const,
    output_config: { effort: 'medium' as const, format: betaZodOutputFormat(proposalOutputSchema) },
    system: [
      { type: 'text' as const, text: PROPOSAL_INSTRUCTIONS },
      { type: 'text' as const, text: standardBlock(input), cache_control: { type: 'ephemeral' as const } },
    ],
    messages: [
      {
        role: 'user' as const,
        content: `Datos que la app tiene hoy de la publicación:\n<datos>\n${JSON.stringify(publicationData(input), null, 2)}\n</datos>\n\nLo que no cumple del estándar:\n${missing}\n\nProponé la versión mejorada.`,
      },
    ],
  };
}

const year = (n: number): number | null => (Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null);

/** Traduce la respuesta de Claude a campos de la app. Lo que viene vacío o mal formado se descarta. */
export function toDraft(output: ProposalOutput): ProposalDraft {
  const content: IncomingContent = {};
  const notes: ProposalDraft['notes'] = {};
  const note = (field: ContentField, p: { reason: string; toConfirm: string[] }) => {
    notes[field] = { reason: p.reason.trim(), toConfirm: p.toConfirm.map((t) => t.trim()).filter(Boolean) };
  };

  for (const field of ['title', 'description', 'brand', 'partNumber', 'kitContents', 'warranty'] as const) {
    const p = output[field];
    note(field, p);
    const value = cleanText(p.value);
    if (value) content[field] = value;
  }

  note('measures', output.measures);
  const measures = output.measures.items
    .map((m) => ({ sku: cleanText(m.sku), measure: cleanText(m.measure) ?? '' }))
    .filter((m) => m.measure !== '');
  if (measures.length > 0) content.measures = measures;

  note('specs', output.specs);
  const specs = output.specs.items.flatMap((s) => {
    const parsed = nameValueSchema.safeParse({ name: s.name, value: s.value });
    return parsed.success && parsed.data.name && parsed.data.value ? [parsed.data] : [];
  });
  if (specs.length > 0) content.specs = specs;

  note('compatibilities', output.compatibilities);
  const compatibilities = output.compatibilities.items
    .map(
      (c): Compat => ({
        vehicleBrand: cleanText(c.vehicleBrand),
        model: cleanText(c.model),
        engine: cleanText(c.engine),
        yearFrom: year(c.yearFrom),
        yearTo: year(c.yearTo),
        note: cleanText(c.note),
      }),
    )
    .filter((c) => c.vehicleBrand || c.model || c.engine || c.note);
  if (compatibilities.length > 0) content.compatibilities = compatibilities;

  return { summary: output.summary.trim(), content, notes };
}

export type ProposalResult = StructuredResult<ProposalOutput>;

/** Pide la propuesta y devuelve la respuesta ya validada. Los errores salen como ProposalError con un mensaje para la pantalla. */
export async function requestProposal(input: ProposalInput): Promise<ProposalResult> {
  return sendStructured(buildProposalRequest(input), (text) => proposalOutputSchema.parse(JSON.parse(text)));
}
