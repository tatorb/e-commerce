import { z } from 'zod';
import { competitorsSchema, MAX_COMPETITORS, saveCompetitors } from '@/domain/competitors';
import {
  addToPipeline,
  advanceStep,
  backStep,
  completePipeline,
  PIPELINE_REMOVALS,
  PIPELINE_REMOVAL_LABEL,
  PIPELINE_STEPS,
  PIPELINE_STEP_LABEL,
  pipelineLabel,
  removeFromPipeline,
} from '@/domain/pipeline';
import { productInfoSchema, updateProductInfo } from '@/domain/product-info';
import { MAX_COMBO_ITEMS, MAX_COMBO_QUANTITY, setComboItems, setProductKind } from '@/domain/combos';
import type { Prisma } from '@/generated/prisma/client';
import { loadCombo } from '@/lib/queries/combos';
import {
  addInsight,
  manufacturerSchema,
  markdownToRichText,
  MAX_INSIGHTS,
  questionsSchema,
  replaceInsights,
  updateResearch,
} from '@/domain/research';
import { titleRulesInputSchema } from '@/domain/title-rules';
import {
  approveTitle,
  decideLock,
  MAX_MAIN_SEARCHES,
  MAX_PAGES,
  MAX_PROPOSALS,
  savePosition,
  saveProposals,
  saveSeeds,
  saveSuggestions,
  setMainSearches,
  setWordStatus,
} from '@/domain/title-work';
import { checkTitle, parsePastedSuggestions, wordKey } from '@/domain/titles';
import { resolveExternalIds } from '@/lib/catalog';
import { loadCatalogData, saveCatalogData } from '@/lib/catalog-data';
import { loadTitleContext } from '@/lib/queries/title-step';
import { loadTitleRules } from '@/lib/title-rules';
import {
  McpToolError,
  accountArg,
  appLink,
  defineTool,
  publicationArg,
  resolveAccount,
  resolvePublication,
  type AccountRef,
  type McpContext,
} from './tool';
import { catalogForClaude } from './catalog';

// Las herramientas que cambian cosas. Usan la misma lógica que las pantallas,
// con las mismas reglas y avisos, y cada cambio queda a nombre de la persona
// que conectó a Claude.

const asEnum = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);
const labels = (entries: [string, string][]) => entries.map(([v, l]) => `${v} = ${l}`).join('; ');

const stepArg = asEnum(PIPELINE_STEPS).describe(
  `El paso en que está ahora la publicación, para no moverla dos veces: ${labels(PIPELINE_STEPS.map((s) => [s, PIPELINE_STEP_LABEL[s]]))}.`,
);

async function target(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const account = await resolveAccount(ctx.db, args.cuenta);
  const id = await resolvePublication(ctx.db, account.id, args.publicacion);
  return { account, id };
}

/** Cómo quedó la publicación después del cambio. */
async function stateOf(ctx: McpContext, account: AccountRef, id: string) {
  const p = await ctx.db.publication.findUniqueOrThrow({
    where: { id },
    select: { externalId: true, title: true, pipelineStatus: true, pipelineStep: true, pipelineRemoval: true },
  });
  return { codigo: p.externalId, titulo: p.title, pipeline: pipelineLabel(p), link_app: appLink(ctx, account, id) };
}

async function titleTarget(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const { account, id } = await target(ctx, args);
  const tc = await loadTitleContext(ctx.db, account.id, id);
  if (!tc) throw new McpToolError('La publicación no está en la cuenta.');
  return { account, id, tc };
}

// ───────────────────────────── Pipeline ─────────────────────────────

const addToPipelineTool = defineTool({
  name: 'add_to_pipeline',
  title: 'Agregar al pipeline',
  description:
    'Agrega publicaciones al pipeline. Entran en Información; una descartada retoma el paso donde estaba. Si alguna es del mismo producto o tiene el mismo título que otra que ya está, no agrega nada y devuelve las repetidas: preguntale a la persona y, si quiere, volvé a llamar con agregar_repetidas.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(50)
      .describe('Ids, códigos del canal o links de las publicaciones, hasta 50.'),
    agregar_repetidas: z.boolean().optional().describe('Agrega aunque haya repetidas. Solo si la persona lo confirmó.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx.db, args.cuenta);
    const ids: string[] = [];
    const notFound: string[] = [];
    const invalid: string[] = [];
    for (const ref of args.publicaciones) {
      const text = ref.trim();
      const byId = await ctx.db.publication.findFirst({ where: { id: text, product: { accountId: account.id } }, select: { id: true } });
      if (byId) {
        if (!ids.includes(byId.id)) ids.push(byId.id);
        continue;
      }
      const r = await resolveExternalIds(ctx.db, account.id, text);
      for (const id of r.ids) if (!ids.includes(id)) ids.push(id);
      notFound.push(...r.notFound);
      invalid.push(...r.invalid);
    }
    const extra = {
      ...(notFound.length > 0 ? { no_estan_en_el_catalogo: notFound } : {}),
      ...(invalid.length > 0 ? { no_se_entienden: invalid } : {}),
    };
    if (ids.length === 0) throw new McpToolError(`No encontré ninguna de esas publicaciones en el Catálogo. ${JSON.stringify(extra)}`);
    const r = await ctx.db.$transaction((tx) =>
      addToPipeline(tx, { accountId: account.id, publicationIds: ids, userId: ctx.userId, force: args.agregar_repetidas === true }),
    );
    if (!r.ok) {
      return {
        listo: false,
        aviso: 'No se agregó nada: hay repetidas. Preguntale a la persona si las agrega igual.',
        repetidas: r.duplicates.map((d) => ({
          codigo: d.externalId,
          titulo: d.title,
          motivo: d.reason === 'product' ? 'Es del mismo producto que otra' : 'Tiene el mismo título que otra',
          la_otra: { codigo: d.other.externalId, titulo: d.other.title, ya_en_el_pipeline: d.other.inPipeline },
        })),
        ...extra,
      };
    }
    return {
      listo: true,
      agregadas: r.added,
      retomadas: r.resumed,
      ya_estaban: r.alreadyIn,
      sin_codigo_del_canal: r.withoutId,
      ...extra,
    };
  },
});

const moveStepTool = defineTool({
  name: 'move_pipeline_step',
  title: 'Mover de paso',
  description:
    'Avanza una publicación al paso siguiente, la vuelve al anterior o, en el último paso, la marca como corregida. Hay que decir en qué paso está ahora: si cambió mientras tanto, no se mueve.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    desde_paso: stepArg,
    accion: z
      .enum(['avanzar', 'volver', 'marcar_corregida'])
      .describe('avanzar = al paso siguiente; volver = al anterior; marcar_corregida = solo en el último paso, termina el pipeline.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const move = { publicationId: id, expected: args.desde_paso, userId: ctx.userId };
    await ctx.db.$transaction(async (tx) => {
      if (args.accion === 'avanzar') await advanceStep(tx, move);
      else if (args.accion === 'volver') await backStep(tx, move);
      else await completePipeline(tx, move);
    });
    return { listo: true, ...(await stateOf(ctx, account, id)) };
  },
});

const removeTool = defineTool({
  name: 'remove_from_pipeline',
  title: 'Sacar del pipeline',
  description:
    'Saca una publicación del pipeline con un motivo. No borra nada: si se vuelve a agregar, retoma en el mismo paso. Confirmalo con la persona antes.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    desde_paso: stepArg,
    motivo: asEnum(PIPELINE_REMOVALS).describe(`Motivo: ${labels(PIPELINE_REMOVALS.map((r) => [r, PIPELINE_REMOVAL_LABEL[r]]))}.`),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    await ctx.db.$transaction((tx) =>
      removeFromPipeline(tx, { publicationId: id, expected: args.desde_paso, userId: ctx.userId, reason: args.motivo }),
    );
    return { listo: true, ...(await stateOf(ctx, account, id)) };
  },
});

// ───────────────────────────── Información ─────────────────────────────

/**
 * Un producto de la cuenta por número de pieza, SKU, código de publicación o
 * id; si no, por nombre. Si coincide con varios, pide algo más preciso.
 */
async function findProduct(tx: Prisma.TransactionClient, accountId: string, ref: string) {
  const term = ref.trim();
  if (!term) throw new McpToolError('Falta el producto.');
  const equals = { equals: term, mode: 'insensitive' as const };
  const select = { id: true, name: true, partNumber: true } as const;
  const exact = await tx.product.findMany({
    where: {
      accountId,
      OR: [{ id: term }, { partNumber: equals }, { variants: { some: { sku: equals } } }, { publications: { some: { externalId: equals } } }],
    },
    select,
    take: 6,
  });
  const found = exact.length > 0 ? exact : await tx.product.findMany({ where: { accountId, name: { contains: term, mode: 'insensitive' } }, select, take: 6 });
  if (found.length === 1) return found[0];
  if (found.length === 0) throw new McpToolError(`No encontré el producto «${term}» en la cuenta.`);
  const names = found.slice(0, 5).map((p) => `${p.name}${p.partNumber ? ` (${p.partNumber})` : ''}`);
  throw new McpToolError(`«${term}» coincide con varios productos: ${names.join('; ')}. Usá el número de pieza o un SKU.`);
}

const optionalText = (what: string) => z.string().optional().describe(`${what}. Vacío lo borra; sin mandar, queda como está.`);

const updateProductInfoTool = defineTool({
  name: 'update_product_info',
  title: 'Corregir la ficha',
  description:
    'Corrige la ficha del producto de una publicación: tipo, marca, número de pieza, línea, origen, medidas y compatibilidades. También si es individual o combo, y los productos del combo: un combo se arma solo con productos individuales, y un producto que está dentro de un combo no puede ser combo. La ficha es la fuente de verdad y la comparten todas las publicaciones del producto. Lo que no se manda queda como está; las listas reemplazan la lista entera. Usá solo datos que te dio la persona o que están en la ficha, nunca supuestos.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    tipo: optionalText('Tipo de producto, por ejemplo "Kit de embrague"'),
    marca: optionalText('Marca del repuesto'),
    numero_de_pieza: optionalText('Número de pieza u OEM'),
    linea: optionalText('Línea, por ejemplo "Liviano nafta"'),
    origen: optionalText('País de origen, por ejemplo "Argentina"'),
    medidas: z
      .array(z.object({ medida: z.string().optional(), sku: z.string().optional() }))
      .max(100)
      .optional()
      .describe('Las medidas con su SKU, por ejemplo STD, 0.25 o 0.50. Reemplaza la lista entera.'),
    compatibilidades: z
      .array(
        z.object({
          marca: z.string().optional(),
          modelo: z.string().optional(),
          motor: z.string().optional(),
          cilindrada: z.string().optional().describe('Sin mandar, sale del motor.'),
          combustible: z.string().optional().describe('Sin mandar, sale del motor.'),
          desde: z.number().int().nullable().optional().describe('Año desde.'),
          hasta: z.number().int().nullable().optional().describe('Año hasta.'),
          nota: z.string().optional(),
        }),
      )
      .max(500)
      .optional()
      .describe('Las compatibilidades con vehículos. Reemplaza la lista entera.'),
    individual_o_combo: z
      .enum(['individual', 'combo'])
      .optional()
      .describe('Individual se vende tal cual; combo se arma con productos individuales. Pasar un combo a individual borra su lista de productos.'),
    productos_del_combo: z
      .array(
        z.object({
          producto: z.string().describe('El producto individual: su número de pieza, un SKU, el código de una de sus publicaciones o el nombre.'),
          cantidad: z.number().int().min(1).max(MAX_COMBO_QUANTITY),
        }),
      )
      .max(MAX_COMBO_ITEMS)
      .optional()
      .describe('Solo para combos. Reemplaza la lista entera, en este orden.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const pub = await ctx.db.publication.findUniqueOrThrow({
      where: { id },
      select: {
        productId: true,
        product: {
          select: {
            productType: true,
            brand: true,
            partNumber: true,
            line: true,
            origin: true,
            variants: { orderBy: { position: 'asc' }, select: { id: true, measure: true, sku: true } },
            compatibilities: {
              orderBy: { position: 'asc' },
              select: {
                vehicleBrand: true,
                model: true,
                engine: true,
                displacement: true,
                fuel: true,
                yearFrom: true,
                yearTo: true,
                note: true,
              },
            },
          },
        },
      },
    });
    const p = pub.product;
    const pick = (sent: string | undefined, current: string | null) => (sent === undefined ? (current ?? '') : sent);
    const filled = (values: unknown[]) => values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');

    // Cada medida que llega conserva la que ya estaba con el mismo SKU o la misma medida.
    const used = new Set<string>();
    const variants = args.medidas
      ? args.medidas
          .filter((v) => filled([v.medida, v.sku]))
          .map((v) => {
            const same = (a: string | null, b: string | undefined) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
            const match =
              p.variants.find((x) => !used.has(x.id) && same(x.sku, v.sku)) ??
              p.variants.find((x) => !used.has(x.id) && !v.sku && same(x.measure, v.medida));
            if (match) used.add(match.id);
            return { id: match?.id ?? null, measure: v.medida ?? '', sku: v.sku ?? '' };
          })
      : p.variants.map((v) => ({ id: v.id, measure: v.measure ?? '', sku: v.sku ?? '' }));
    const compatibilities = args.compatibilidades
      ? args.compatibilidades
          .filter((c) => filled([c.marca, c.modelo, c.motor, c.cilindrada, c.combustible, c.desde, c.hasta, c.nota]))
          .map((c) => ({
            vehicleBrand: c.marca ?? '',
            model: c.modelo ?? '',
            engine: c.motor ?? '',
            displacement: c.cilindrada,
            fuel: c.combustible,
            yearFrom: c.desde ?? null,
            yearTo: c.hasta ?? null,
            note: c.nota ?? '',
          }))
      : p.compatibilities.map((c) => ({
          vehicleBrand: c.vehicleBrand ?? '',
          model: c.model ?? '',
          engine: c.engine ?? '',
          displacement: c.displacement ?? undefined,
          fuel: c.fuel ?? undefined,
          yearFrom: c.yearFrom,
          yearTo: c.yearTo,
          note: c.note ?? '',
        }));

    const parsed = productInfoSchema.safeParse({
      productType: pick(args.tipo, p.productType),
      brand: pick(args.marca, p.brand),
      partNumber: pick(args.numero_de_pieza, p.partNumber),
      line: pick(args.linea, p.line),
      origin: pick(args.origen, p.origin),
      variants,
      compatibilities,
    });
    if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    await ctx.db.$transaction(async (tx) => {
      await updateProductInfo(tx, { accountId: account.id, productId: pub.productId, data: parsed.data });
      if (args.individual_o_combo) {
        await setProductKind(tx, { accountId: account.id, productId: pub.productId, kind: args.individual_o_combo === 'combo' ? 'COMBO' : 'INDIVIDUAL' });
      }
      if (args.productos_del_combo) {
        const items = [];
        for (const item of args.productos_del_combo) {
          const product = await findProduct(tx, account.id, item.producto);
          items.push({ productId: product.id, quantity: item.cantidad });
        }
        await setComboItems(tx, { accountId: account.id, comboId: pub.productId, items });
      }
    });
    const combo = await loadCombo(ctx.db, pub.productId);
    return {
      listo: true,
      mensaje: 'Guardado en la ficha.',
      ...(combo?.kind === 'COMBO'
        ? { productos_del_combo: combo.items.map((i) => ({ nombre: i.name, cantidad: i.quantity, numero_de_pieza: i.partNumber })) }
        : {}),
      link_app: appLink(ctx, account, id),
    };
  },
});

const saveCompetitorsTool = defineTool({
  name: 'save_competitors',
  title: 'Cargar la competencia',
  description: `Guarda las publicaciones de la competencia que más venden; conviene al menos 3 y no hay un tope práctico. Sus títulos suman palabras al mapa del paso Título. Reemplaza la lista entera; una lista vacía la borra. Solo publicaciones reales que te pasó la persona o que vio en el canal.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    competencia: z
      .array(
        z.object({
          titulo: z.string().min(1),
          link: z.string().optional(),
          vendidos: z.number().int().min(0).nullable().optional(),
        }),
      )
      .max(MAX_COMPETITORS),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const parsed = competitorsSchema.safeParse(
      args.competencia.map((c) => ({ title: c.titulo, url: c.link ?? '', soldQuantity: c.vendidos ?? null })),
    );
    if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    await ctx.db.$transaction((tx) => saveCompetitors(tx, id, parsed.data));
    return { listo: true, guardadas: parsed.data.length, link_app: appLink(ctx, account, id) };
  },
});

// ───────────────────────────── Investigación del producto ─────────────────────────────

async function productTarget(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const { account, id } = await target(ctx, args);
  const pub = await ctx.db.publication.findUniqueOrThrow({
    where: { id },
    select: { productId: true, product: { select: { research: true } } },
  });
  return { account, id, productId: pub.productId, research: pub.product.research };
}

const keepOr = (sent: string | undefined, current: string | null | undefined) => (sent === undefined ? (current ?? '') : sent);

const saveManufacturerTool = defineTool({
  name: 'save_manufacturer_info',
  title: 'Guardar lo del fabricante',
  description:
    'Guarda el sitio del fabricante, la página del producto y el texto del fabricante, en la investigación del producto. Lo comparten todas sus publicaciones. Lo que no se manda queda como está; vacío lo borra. Solo datos reales que te pasó la persona; nunca precios ni costos del proveedor. Los archivos se suben desde la app.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    sitio: z.string().optional().describe('El sitio del fabricante, con https://.'),
    pagina_del_producto: z.string().optional().describe('La página de este producto en el sitio del fabricante, con https://.'),
    texto: z.string().optional().describe('Lo que dice el fabricante: descripción, ficha técnica.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId, research: r } = await productTarget(ctx, args);
    const parsed = manufacturerSchema.safeParse({
      site: keepOr(args.sitio, r?.manufacturerSite),
      productUrl: keepOr(args.pagina_del_producto, r?.manufacturerProductUrl),
      text: keepOr(args.texto, r?.manufacturerText),
    });
    if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    const { site, productUrl, text } = parsed.data;
    await updateResearch(ctx.db, {
      productId,
      userId: ctx.userId,
      data: { manufacturerSite: site, manufacturerProductUrl: productUrl, manufacturerText: text },
    });
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const saveClarificationsTool = defineTool({
  name: 'save_image_clarifications',
  title: 'Guardar las aclaraciones para las imágenes',
  description:
    'Guarda las aclaraciones para las imágenes del producto: modelos compatibles, confusiones habituales y lo que tiene que quedar claro. Reemplaza el texto entero. Se escribe en Markdown simple: **negrita**, _cursiva_, listas con "- " o "1. ". Usá solo datos de la ficha o que te dio la persona.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, texto: z.string().describe('Vacío lo borra.') }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId } = await productTarget(ctx, args);
    await updateResearch(ctx.db, { productId, userId: ctx.userId, data: { clarifications: markdownToRichText(args.texto) } });
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const saveQuestionsTool = defineTool({
  name: 'save_buyer_questions',
  title: 'Guardar las preguntas de los compradores',
  description:
    'Guarda las preguntas de los compradores que te pegó la persona: las de la publicación propia y las de la competencia, tal como vienen. Lo que no se manda queda como está; vacío lo borra.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    propia: z.string().optional().describe('Las preguntas de la publicación propia.'),
    competencia: z.string().optional().describe('Las preguntas de las publicaciones de la competencia.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId, research: r } = await productTarget(ctx, args);
    const parsed = questionsSchema.safeParse({
      own: keepOr(args.propia, r?.ownQuestions),
      competitors: keepOr(args.competencia, r?.competitorQuestions),
    });
    if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    await updateResearch(ctx.db, {
      productId,
      userId: ctx.userId,
      data: { ownQuestions: parsed.data.own, competitorQuestions: parsed.data.competitors },
    });
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const KIND = { dolores: 'PAIN', objeciones: 'OBJECTION' } as const;

const saveInsightsTool = defineTool({
  name: 'save_buyer_insights',
  title: 'Guardar dolores u objeciones',
  description: `Agrega a la lista de dolores o de objeciones de los compradores, o la reemplaza entera, hasta ${MAX_INSIGHTS} por lista. Cada ítem es una frase corta. Tienen que salir de las preguntas guardadas o de lo que te dijo la persona, no de suposiciones. Para reemplazar, confirmalo con la persona antes.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    lista: z.enum(['dolores', 'objeciones']),
    accion: z.enum(['agregar', 'reemplazar']).describe('agregar suma al final; reemplazar cambia la lista entera, y una lista vacía la borra.'),
    items: z.array(z.string()).max(MAX_INSIGHTS),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId } = await productTarget(ctx, args);
    const kind = KIND[args.lista];
    if (args.accion === 'reemplazar') {
      await ctx.db.$transaction((tx) => replaceInsights(tx, { productId, kind, texts: args.items }));
    } else {
      if (args.items.length === 0) throw new McpToolError('Falta al menos un ítem.');
      await ctx.db.$transaction(async (tx) => {
        for (const text of args.items) await addInsight(tx, { productId, kind, text });
      });
    }
    const list = await ctx.db.buyerInsight.findMany({ where: { productId, kind }, orderBy: { position: 'asc' }, select: { text: true } });
    return { listo: true, [args.lista]: list.map((i) => i.text), link_app: appLink(ctx, account, id) };
  },
});

// ───────────────────────────── Datos de catálogo ─────────────────────────────

const saveCatalogTool = defineTool({
  name: 'save_catalog_data',
  title: 'Guardar los datos de catálogo',
  description:
    'Carga los datos de catálogo de la publicación: los campos del formulario del canal para su categoría, por ejemplo "Tipo de embrague" o "Incluye disco". Antes miralos en get_publication, en datos_de_catalogo: cada campo dice su tipo, sus opciones y lo cargado. Los de tipo opción y sí o no solo aceptan sus opciones; los de texto aceptan cualquier texto y sus sugerencias son las que usa el canal. Marca, número de pieza y origen salen de la ficha: se cambian con update_product_info. Lo que no se manda queda como está; null o vacío lo borra. Usá solo datos de la ficha, del fabricante o que te dio la persona, nunca supuestos.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    categoria: z
      .string()
      .nullable()
      .optional()
      .describe('Para cambiar la categoría: su código o su nombre. null vuelve a la que le toca por la familia. Si la familia no tiene una, hay que elegirla antes de cargar los campos.'),
    valores: z
      .record(z.string(), z.union([z.string(), z.array(z.string()), z.null()]))
      .optional()
      .describe('Por campo, con su código (por ejemplo CLUTCH_TYPE) o su nombre: el valor. Los de varios valores aceptan una lista. Los números con unidad van con la unidad, por ejemplo "76.5 mm".'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const values = args.valores ?? {};
    if (args.categoria === undefined && Object.keys(values).length === 0) {
      throw new McpToolError('Mandá una categoría o al menos un valor.');
    }
    await saveCatalogData(ctx.db, { publicationId: id, category: args.categoria, values });
    return { listo: true, datos_de_catalogo: catalogForClaude(await loadCatalogData(ctx.db, id)), link_app: appLink(ctx, account, id) };
  },
});

// ───────────────────────────── Título ─────────────────────────────

const saveSeedsTool = defineTool({
  name: 'save_title_seeds',
  title: 'Guardar semillas',
  description:
    'Guarda las semillas del paso Título: lo que se escribe en el buscador del canal para ver qué completa. Reemplaza las que había, hasta 20.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, semillas: z.array(z.string()).min(1).max(20) }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const seeds = await ctx.db.$transaction((tx) => saveSeeds(tx, id, args.semillas));
    return { listo: true, semillas: seeds, link_app: appLink(ctx, account, id) };
  },
});

const saveSuggestionsTool = defineTool({
  name: 'save_search_suggestions',
  title: 'Guardar sugerencias del buscador',
  description:
    'Guarda lo que completó el buscador del canal para una semilla, con la fecha de hoy. Solo sugerencias reales que la persona copió del buscador: nunca inventadas ni supuestas. Sirven para todas las publicaciones de la cuenta con la misma semilla.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    semilla: z.string().min(1).describe('La semilla, por ejemplo "kit embrague gol".'),
    se_escribio: z.string().optional().describe('Lo que se escribió en el buscador, si fue la semilla más una letra. Sin mandar, es la semilla.'),
    sugerencias: z.array(z.string()).min(1).max(200).describe('Las sugerencias, en el orden del buscador.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { store: { select: { channelId: true } } } });
    const suggestions = parsePastedSuggestions(args.sugerencias.join('\n'));
    if (suggestions.length === 0) throw new McpToolError('Falta al menos una sugerencia.');
    const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    await saveSuggestions(ctx.db, {
      accountId: account.id,
      channelId: pub.store.channelId,
      seed: clean(args.semilla),
      query: clean(args.se_escribio ?? args.semilla),
      suggestions,
      source: 'MANUAL',
      publicationId: id,
    });
    return { listo: true, guardadas: suggestions.length, link_app: appLink(ctx, account, id) };
  },
});

const STATUS = { usar: 'use', descartar: 'discard', sin_marcar: null } as const;

const setWordsTool = defineTool({
  name: 'set_title_words',
  title: 'Tildar palabras',
  description:
    'Marca palabras del mapa de palabras del paso Título como para usar o para descartar, o les saca la marca. Solo palabras que están en el mapa (get_title_workspace).',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    palabras: z.array(z.string().min(1)).min(1).max(100),
    estado: z.enum(['usar', 'descartar', 'sin_marcar']),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id, tc } = await titleTarget(ctx, args);
    const inMap = new Map(tc.words.map((w) => [w.key, w.word]));
    const found = args.palabras.filter((w) => inMap.has(wordKey(w)));
    const missing = args.palabras.filter((w) => !inMap.has(wordKey(w)));
    if (found.length === 0) throw new McpToolError(`Ninguna de esas palabras está en el mapa: ${missing.join(', ')}.`);
    await ctx.db.$transaction(async (tx) => {
      for (const w of found) await setWordStatus(tx, id, w, STATUS[args.estado]);
    });
    return {
      listo: true,
      marcadas: found.map((w) => inMap.get(wordKey(w))),
      ...(missing.length > 0 ? { no_estan_en_el_mapa: missing } : {}),
      link_app: appLink(ctx, account, id),
    };
  },
});

const setMainSearchesTool = defineTool({
  name: 'set_main_searches',
  title: 'Elegir búsquedas principales',
  description: `Elige las búsquedas principales del paso Título, hasta ${MAX_MAIN_SEARCHES}: las que se usan para medir la posición antes y después. Reemplaza las que había.`,
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, busquedas: z.array(z.string()).max(MAX_MAIN_SEARCHES) }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const searches = await ctx.db.$transaction((tx) => setMainSearches(tx, id, args.busquedas));
    return { listo: true, busquedas_principales: searches, link_app: appLink(ctx, account, id) };
  },
});

const savePositionTool = defineTool({
  name: 'save_search_position',
  title: 'Cargar una posición',
  description: `Guarda en qué página y posición aparece la publicación al buscar algo, con la fecha de hoy. Sin página: no aparece en las primeras ${MAX_PAGES}. Solo datos reales que te pasó la persona.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    busqueda: z.string().min(1),
    pagina: z.number().int().min(1).max(MAX_PAGES).nullable().describe(`De 1 a ${MAX_PAGES}, o null si no aparece.`),
    posicion: z.number().int().min(1).max(100).nullable().optional().describe('La posición dentro de la página.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    await savePosition(ctx.db, { publicationId: id, query: args.busqueda, page: args.pagina, position: args.posicion ?? null, source: 'MANUAL' });
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const decideLockTool = defineTool({
  name: 'decide_title_lock',
  title: 'Decidir sobre el título bloqueado',
  description:
    'Para un título bloqueado por ventas, en el paso Título: mantener el título (completa el paso sin cambios y pasa a Imágenes) o probar el título nuevo en la copia con cuotas (sigue en el paso). deshacer quita la decisión de probar en la copia. Confirmalo con la persona antes.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    decision: z.enum(['mantener', 'probar_en_copia', 'deshacer']),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const decision = args.decision === 'mantener' ? 'KEEP' : args.decision === 'probar_en_copia' ? 'TRY_IN_COPY' : null;
    await ctx.db.$transaction((tx) => decideLock(tx, { publicationId: id, decision, userId: ctx.userId }));
    return { listo: true, ...(await stateOf(ctx, account, id)) };
  },
});

const saveProposalsTool = defineTool({
  name: 'save_title_proposals',
  title: 'Guardar propuestas de título',
  description: `Guarda hasta ${MAX_PROPOSALS} propuestas de título con su motivo, para que la persona las vea y elija en el paso Título de la app. Reemplazan las que había. Chequealas antes con check_title.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    propuestas: z
      .array(z.object({ titulo: z.string().min(1), motivo: z.string().describe('Por qué este título, en una frase.') }))
      .min(1)
      .max(MAX_PROPOSALS),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id, tc } = await titleTarget(ctx, args);
    const saved = await ctx.db.$transaction((tx) =>
      saveProposals(
        tx,
        id,
        args.propuestas.map((p) => ({ title: p.titulo, reason: p.motivo })),
      ),
    );
    const usable = tc.words.filter((w) => w.status === 'use').map((w) => w.word);
    return {
      listo: true,
      propuestas: saved.map((p) => {
        const check = checkTitle(p.title, tc.rules, usable.length > 0 ? { usableWords: usable } : {});
        return { titulo: p.title, se_puede_aprobar: check.errors.length === 0, errores: check.errors, avisos: check.warnings };
      }),
      link_app: appLink(ctx, account, id),
    };
  },
});

const approveTitleTool = defineTool({
  name: 'approve_title',
  title: 'Aprobar el título',
  description:
    'Aprueba el título en el paso Título: lo escribe en la publicación (o lo deja para la copia con cuotas si se decidió así) y pasa a Imágenes. No deja aprobar un título con errores, ni uno bloqueado sin decidir antes. Confirmalo con la persona antes.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    titulo: z.string().min(1),
    propuesta_elegida: z.string().optional().describe('La propuesta guardada de la que sale el título, si salió de una.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, tc } = await titleTarget(ctx, args);
    const r = await ctx.db.$transaction((tx) =>
      approveTitle(tx, {
        publicationId: id,
        title: args.titulo,
        aiTitle: args.propuesta_elegida ?? null,
        locked: tc.titleLock.locked,
        rules: tc.rules,
        userId: ctx.userId,
      }),
    );
    return {
      listo: true,
      mensaje: r.outcome === 'COPY' ? 'Título guardado para la copia con cuotas.' : 'Título aprobado y escrito en la publicación.',
      ...(await stateOf(ctx, account, id)),
    };
  },
});

// ───────────────────────────── Reglas de título ─────────────────────────────

const updateTitleRulesTool = defineTool({
  name: 'update_title_rules',
  title: 'Editar las reglas de título',
  description:
    'Edita las reglas de título de la cuenta para un canal: largo máximo, signos y palabras no permitidas, y la estructura sugerida por familia. Lo que no se manda queda como está; las listas reemplazan la lista entera. restablecer vuelve a las reglas del canal. Confirmalo con la persona antes.',
  input: z.object({
    cuenta: accountArg,
    canal: z.string().optional().describe('El canal, por ejemplo "Mercado Libre". Si la cuenta tiene uno solo, se puede omitir.'),
    largo_maximo: z.number().int().nullable().optional().describe('Entre 10 y 500, o null para sin límite.'),
    signos_no_permitidos: z.string().optional().describe('Todos juntos, por ejemplo "!¡*$".'),
    palabras_no_permitidas: z.array(z.string()).max(300).optional(),
    estructuras: z
      .array(z.object({ familia: z.string().describe('Vacía vale para todas las familias.'), estructura: z.string() }))
      .max(100)
      .optional(),
    restablecer: z.boolean().optional().describe('Borra las reglas de la cuenta y vuelve a las del canal.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx.db, args.cuenta);
    const stores = await ctx.db.store.findMany({
      where: { accountId: account.id },
      select: { channel: { select: { id: true, kind: true, name: true } } },
    });
    const channels = [...new Map(stores.map((s) => [s.channel.id, s.channel])).values()];
    const wanted = args.canal?.trim().toLowerCase();
    const channel = wanted
      ? channels.find((c) => c.name.toLowerCase() === wanted || c.kind.toLowerCase() === wanted)
      : channels.length === 1
        ? channels[0]
        : undefined;
    if (!channel) throw new McpToolError(`Decí de qué canal. La cuenta tiene: ${channels.map((c) => c.name).join(', ') || 'ninguno'}.`);

    if (args.restablecer) {
      await ctx.db.titleRuleSet.deleteMany({ where: { accountId: account.id, channelId: channel.id } });
    } else {
      const { rules } = await loadTitleRules(ctx.db, account.id, channel);
      const parsed = titleRulesInputSchema.safeParse({
        maxLength: args.largo_maximo === undefined ? rules.maxLength : args.largo_maximo,
        forbiddenChars: args.signos_no_permitidos ?? rules.forbiddenChars,
        forbiddenWords: args.palabras_no_permitidas ?? rules.forbiddenWords,
        structures: args.estructuras ? args.estructuras.map((s) => ({ family: s.familia, structure: s.estructura })) : rules.structures,
      });
      if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
      const data = { ...parsed.data, updatedById: ctx.userId };
      await ctx.db.titleRuleSet.upsert({
        where: { accountId_channelId: { accountId: account.id, channelId: channel.id } },
        update: data,
        create: { ...data, accountId: account.id, channelId: channel.id },
      });
    }
    const { rules, custom } = await loadTitleRules(ctx.db, account.id, channel);
    return {
      listo: true,
      canal: channel.name,
      reglas: {
        largo_maximo: rules.maxLength,
        signos_no_permitidos: rules.forbiddenChars,
        palabras_no_permitidas: rules.forbiddenWords,
        estructuras: rules.structures.map((s) => ({ familia: s.family, estructura: s.structure })),
        son_de_la_cuenta: custom,
      },
    };
  },
});

export const WRITE_TOOLS = [
  addToPipelineTool,
  moveStepTool,
  removeTool,
  updateProductInfoTool,
  saveCompetitorsTool,
  saveManufacturerTool,
  saveClarificationsTool,
  saveQuestionsTool,
  saveInsightsTool,
  saveCatalogTool,
  saveSeedsTool,
  saveSuggestionsTool,
  setWordsTool,
  setMainSearchesTool,
  savePositionTool,
  decideLockTool,
  saveProposalsTool,
  approveTitleTool,
  updateTitleRulesTool,
];
