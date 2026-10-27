import { z } from 'zod';
import { todayIn } from '@/domain/applications';
import { COMPETITOR_SELECT, competitorsSchema, INSTALLMENT_OPTIONS, MAX_COMPETITORS, saveCompetitors, storedCompetitor } from '@/domain/competitors';
import {
  addToPipeline,
  advanceStep,
  backStep,
  completePipeline,
  jumpToStep,
  PIPELINE_REMOVALS,
  PIPELINE_REMOVAL_LABEL,
  PIPELINE_STEPS,
  PIPELINE_STEP_LABEL,
  pipelineLabel,
  PipelineError,
  removeFromPipeline,
} from '@/domain/pipeline';
import { productInfoSchema, updateProductInfo } from '@/domain/product-info';
import { TRAIN_BOT } from '@/domain/access';
import { MediaError } from '@/lib/media';
import { VideoError } from '@/lib/videos';
import { copyMedia } from './media-tools';
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
  ResearchError,
  saveQuestions,
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
import { createPipelinePublication } from '@/domain/pipeline-publications';
import { savePublicationCode } from '@/lib/publication-code';
import { QaError, saveQaTexts } from '@/lib/publication-qa';
import { loadCatalogData, saveCatalogData } from '@/lib/catalog-data';
import { loadTitleContext } from '@/lib/queries/title-step';
import { loadTitleRules } from '@/lib/title-rules';
import { mergeSpecs, MAX_SPECS } from '@/domain/technical-sheet';
import { parseNameValueList } from '@/domain/name-value';
import { writeContentField } from '@/domain/content';
import { technicalSheetState } from '@/lib/technical-sheet';
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
  const account = await resolveAccount(ctx, args.cuenta);
  const id = await resolvePublication(ctx, account.id, args.publicacion);
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
  section: ['publicaciones', 'pipeline'],
  title: 'Agregar al pipeline',
  description:
    'Agrega publicaciones al pipeline, estén publicadas o no. Entran en Información; una descartada retoma el paso donde estaba. Si alguna es del mismo producto o tiene el mismo título que otra del pipeline, entra igual y vuelve un aviso: contáselo a la persona.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(50)
      .describe('Ids, códigos del canal o links de las publicaciones, hasta 50. Las que no están publicadas se buscan por id.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
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
    if (ids.length === 0) throw new McpToolError(`No encontré ninguna de esas publicaciones en la cuenta. ${JSON.stringify(extra)}`);
    const r = await ctx.db.$transaction((tx) => addToPipeline(tx, { accountId: account.id, publicationIds: ids, userId: ctx.userId }));
    return {
      listo: true,
      agregadas: r.added,
      retomadas: r.resumed,
      ya_estaban: r.alreadyIn,
      ...(r.related.length > 0
        ? {
            avisos: r.related.map((d) => ({
              codigo: d.externalId,
              titulo: d.title,
              motivo: d.reason === 'product' ? 'Es del mismo producto que otra' : 'Tiene el mismo título que otra',
              la_otra: { codigo: d.other.externalId, titulo: d.other.title, ya_en_el_pipeline: d.other.inPipeline },
            })),
          }
        : {}),
      ...extra,
    };
  },
});

const moveStepTool = defineTool({
  name: 'move_pipeline_step',
  section: 'pipeline',
  title: 'Mover de paso',
  description:
    'Avanza una publicación al paso siguiente, la vuelve al anterior, la lleva a cualquier paso saltando los del medio o, en el último paso, la marca como corregida. Los pasos son una guía: no hace falta terminar uno para pasar a otro. Hay que decir en qué paso está ahora: si cambió mientras tanto, no se mueve.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    desde_paso: stepArg,
    accion: z
      .enum(['avanzar', 'volver', 'mover', 'marcar_corregida'])
      .describe(
        'avanzar = al paso siguiente; volver = al anterior; mover = al paso de a_paso, saltando los del medio; marcar_corregida = solo en el último paso, termina el pipeline.',
      ),
    a_paso: asEnum(PIPELINE_STEPS).optional().describe('Solo con mover: el paso al que va.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const move = { publicationId: id, expected: args.desde_paso, userId: ctx.userId };
    await ctx.db.$transaction(async (tx) => {
      if (args.accion === 'avanzar') await advanceStep(tx, move);
      else if (args.accion === 'volver') await backStep(tx, move);
      else if (args.accion === 'mover') {
        if (!args.a_paso) throw new PipelineError('Para mover, decí a qué paso con a_paso.');
        await jumpToStep(tx, { ...move, to: args.a_paso });
      }
      else await completePipeline(tx, move);
    });
    return { listo: true, ...(await stateOf(ctx, account, id)) };
  },
});

const createPublicationTool = defineTool({
  name: 'create_publication',
  section: ['pipeline', 'publicaciones'],
  title: 'Crear una publicación nueva',
  description:
    'Crea una publicación nueva, todavía sin publicar en el canal, y la deja en el pipeline en Información. Es de un producto que ya está (producto) o de uno nuevo con ficha corta (producto_nuevo), uno de los dos. Antes de crearla, mostrale a la persona qué vas a crear y esperá que confirme. Cuando ya esté publicada, su código se carga con update_publication.',
  input: z.object({
    cuenta: accountArg,
    producto: z
      .string()
      .optional()
      .describe('El producto que ya está: número de pieza, SKU, código de una de sus publicaciones, id o nombre.'),
    producto_nuevo: z
      .object({
        nombre: z.string().describe('El nombre del producto: lo que es y su código, por ejemplo "Subconjunto SP-413". No es el título de la publicación.'),
        tipo: z.string().optional().describe('Tipo de producto, por ejemplo "Kit de embrague".'),
        individual_o_combo: z.enum(['individual', 'combo']).optional().describe('Sin mandar, individual.'),
      })
      .optional()
      .describe('Ficha corta para un producto que todavía no está en la app. Lo demás se completa después en Información.'),
    tienda: z.string().optional().describe('El nombre de la tienda. Si la cuenta tiene una sola, se puede omitir.'),
    titulo: z
      .string()
      .optional()
      .describe('El título de la publicación, si ya lo tiene. Se chequea igual que con check_title y no se crea si tiene errores. Es de la publicación: no es el nombre del producto.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    if (Boolean(args.producto?.trim()) === Boolean(args.producto_nuevo)) {
      throw new McpToolError('Mandá producto o producto_nuevo, uno de los dos.');
    }
    const stores = await ctx.db.store.findMany({
      where: { accountId: account.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, channel: { select: { id: true, kind: true, name: true } } },
    });
    const wanted = args.tienda?.trim().toLowerCase();
    const store = wanted ? stores.find((s) => s.name.toLowerCase() === wanted) : stores.length === 1 ? stores[0] : undefined;
    if (!store) {
      throw new McpToolError(
        wanted
          ? `No encontré la tienda «${args.tienda}». Las tiendas son: ${stores.map((s) => s.name).join(', ')}.`
          : `La cuenta tiene varias tiendas: decime en cuál (${stores.map((s) => s.name).join(', ')}).`,
      );
    }
    const title = args.titulo?.trim() || null;
    let titleWarnings: string[] = [];
    if (title) {
      const { rules } = await loadTitleRules(ctx.db, account.id, store.channel);
      const check = checkTitle(title, rules);
      if (check.errors.length > 0) throw new McpToolError(`El título tiene errores: ${check.errors.join(' ')} No se creó la publicación.`);
      titleWarnings = check.warnings;
    }
    const nuevo = args.producto_nuevo;
    const r = await ctx.db.$transaction(async (tx) =>
      createPipelinePublication(tx, {
        accountId: account.id,
        storeId: store.id,
        productId: args.producto ? (await findProduct(tx, account.id, args.producto)).id : null,
        newProduct: nuevo
          ? { name: nuevo.nombre, productType: nuevo.tipo ?? '', kind: nuevo.individual_o_combo === 'combo' ? 'COMBO' : 'INDIVIDUAL' }
          : null,
        title,
        userId: ctx.userId,
      }),
    );
    const product = await ctx.db.product.findUniqueOrThrow({ where: { id: r.productId }, select: { name: true } });
    return {
      listo: true,
      producto: product.name,
      tienda: store.name,
      ...(await stateOf(ctx, account, r.publicationId)),
      ...(titleWarnings.length > 0 ? { avisos_del_titulo: titleWarnings } : {}),
      ...(r.related.length > 0
        ? { aviso: `El producto ya tiene ${r.related.length === 1 ? 'otra publicación' : `${r.related.length} publicaciones`} en el pipeline.` }
        : {}),
    };
  },
});

const updatePublicationTool = defineTool({
  name: 'update_publication',
  section: ['publicaciones', 'pipeline'],
  title: 'Cargar el código de una publicación',
  description:
    'Carga el código del canal de una publicación que ya se publicó: pegá el código o el link, la app lo limpia y arma el link. Si estaba sin publicar, pasa a activa. Si ya tenía un código, confirmalo con la persona antes de cambiarlo.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    codigo: z.string().min(1).describe('El código o el link de la publicación en el canal.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const r = await savePublicationCode(ctx.db, { accountId: account.id, publicationId: id, raw: args.codigo });
    if (!r.ok) throw new McpToolError(r.error);
    return { listo: true, ...(await stateOf(ctx, account, id)), link_canal: r.url };
  },
});

const removeTool = defineTool({
  name: 'remove_from_pipeline',
  section: ['publicaciones', 'pipeline'],
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
  section: ['productos', 'pipeline'],
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
  section: 'pipeline',
  title: 'Cargar la competencia',
  description: `Guarda las publicaciones de la competencia que más venden; conviene al menos 3 y no hay un tope práctico. Sus títulos suman palabras al mapa del paso Título, y su precio, descuento, cuotas y envío sirven para comparar precios. Reemplaza la lista entera; una lista vacía la borra, y lo que no mandes de una publicación queda vacío. Solo publicaciones y precios reales que te pasó la persona o que viste en el canal. Si mandás el precio sin la fecha, queda con la fecha de hoy.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    competencia: z
      .array(
        z.object({
          titulo: z.string().min(1),
          link: z.string().optional(),
          vendidos: z.number().int().min(0).nullable().optional(),
          vendedor: z.string().optional().describe('El nombre del vendedor.'),
          marca: z
            .string()
            .optional()
            .describe('La marca del producto que vende, por ejemplo Persan o Mahle. Sin ella, comparar el precio dice poco: si no está en el título o en la publicación, dejala vacía.'),
          precio_de_lista: z.number().positive().nullable().optional().describe('El precio antes de cualquier descuento, en pesos.'),
          descuento_pct: z.number().min(0).max(99).optional().describe('El descuento activo en %, por ejemplo 15. 0 si no tiene.'),
          cuotas_sin_interes: z
            .number()
            .int()
            .optional()
            .describe(`Cuántas cuotas sin interés ofrece: ${INSTALLMENT_OPTIONS.join(', ')}. 0 es sin cuotas.`),
          envio_gratis: z.boolean().optional(),
          relevado: z.string().optional().describe('El día en que se miró el precio, como 2026-10-23.'),
          notas: z.string().optional().describe('Otras promociones, combos u observaciones.'),
        }),
      )
      .max(MAX_COMPETITORS),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const parsed = competitorsSchema.safeParse(
      args.competencia.map((c) => ({
        title: c.titulo,
        url: c.link ?? '',
        soldQuantity: c.vendidos ?? null,
        sellerName: c.vendedor,
        brand: c.marca,
        listPrice: c.precio_de_lista,
        discountPct: c.descuento_pct,
        installments: c.cuotas_sin_interes,
        freeShipping: c.envio_gratis,
        surveyedAt: c.relevado,
        notes: c.notas,
      })),
    );
    if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    await ctx.db.$transaction((tx) => saveCompetitors(tx, id, parsed.data, todayIn(account.timezone)));
    return { listo: true, guardadas: parsed.data.length, link_app: appLink(ctx, account, id) };
  },
});

// ───────────────────────────── Investigación del producto ─────────────────────────────

async function productTarget(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const { account, id } = await target(ctx, args);
  const pub = await ctx.db.publication.findUniqueOrThrow({
    where: { id },
    select: { productId: true, ownQuestions: true, product: { select: { research: true } } },
  });
  return { account, id, productId: pub.productId, ownQuestions: pub.ownQuestions, research: pub.product.research };
}

const keepOr = (sent: string | undefined, current: string | null | undefined) => (sent === undefined ? (current ?? '') : sent);

const saveManufacturerTool = defineTool({
  name: 'save_manufacturer_info',
  section: ['pipeline', 'productos'],
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
  section: ['pipeline', 'productos'],
  title: 'Guardar las aclaraciones para las imágenes',
  description:
    'Guarda las aclaraciones para las imágenes del producto: modelos compatibles, confusiones habituales y lo que tiene que quedar claro. Son del producto: las comparten todas sus publicaciones. Reemplaza el texto entero. Se escribe en Markdown simple: **negrita**, _cursiva_, listas con "- " o "1. ". Usá solo datos de la ficha o que te dio la persona.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, texto: z.string().describe('Vacío lo borra.') }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId } = await productTarget(ctx, args);
    await updateResearch(ctx.db, { productId, userId: ctx.userId, data: { clarifications: markdownToRichText(args.texto) } });
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const saveKnowledgeTool = defineTool({
  name: 'save_store_knowledge',
  section: ['pipeline', 'productos'],
  title: 'Guardar lo que sabe la tienda del producto',
  description:
    'Guarda lo que sabe la tienda del producto: contexto, preguntas frecuentes, condiciones que pueden surgir y sus aclaraciones. Es del producto: lo comparten todas sus publicaciones, y lo usan las respuestas a los compradores y la descripción. Reemplaza el texto entero: si querés sumar algo, leé antes lo que hay con get_publication. Se escribe en Markdown simple: **negrita**, _cursiva_, listas con "- " o "1. ". Usá solo lo que te dijo la persona.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, texto: z.string().max(50_000).describe('Vacío lo borra.') }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId } = await productTarget(ctx, args);
    await updateResearch(ctx.db, { productId, userId: ctx.userId, data: { storeKnowledge: markdownToRichText(args.texto) } });
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const savePublicationQaTool = defineTool({
  name: 'save_publication_qa',
  section: TRAIN_BOT,
  title: 'Guardar las preguntas frecuentes y las reglas de la publicación',
  description:
    'Guarda el paso Preguntas y respuestas de la publicación: las preguntas frecuentes con la respuesta de la tienda, y las reglas de cuándo responde Claude y cuándo una persona. Son de esta publicación, no del producto, y las lee la IA que responde a los compradores. Lo que no se manda queda como está; vacío lo borra. Reemplaza cada texto entero: si querés sumar algo, leé antes lo que hay con get_publication. Se escribe en Markdown simple: **negrita**, _cursiva_, listas con "- " o "1. ". Usá solo lo que te dijo la persona. Si Claude responde solo se prende y se apaga desde la app.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    preguntas_frecuentes: z.string().max(50_000).optional().describe('Cada pregunta con su respuesta.'),
    reglas: z.string().max(50_000).optional().describe('Qué preguntas responde Claude y cuáles deja para una persona.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    if (args.preguntas_frecuentes === undefined && args.reglas === undefined) throw new McpToolError('Mandá las preguntas frecuentes, las reglas o las dos.');
    const html = (md: string | undefined) => (md === undefined ? undefined : (markdownToRichText(md) ?? ''));
    try {
      await saveQaTexts(ctx.db, { accountId: account.id, publicationId: id, faq: html(args.preguntas_frecuentes), rules: html(args.reglas) });
    } catch (e) {
      if (e instanceof QaError || e instanceof ResearchError) throw new McpToolError(e.message);
      throw e;
    }
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const saveQuestionsTool = defineTool({
  name: 'save_buyer_questions',
  section: ['pipeline', 'productos'],
  title: 'Guardar las preguntas de los compradores',
  description:
    'Guarda las preguntas de los compradores que te pegó la persona, tal como vienen. Las de la publicación propia quedan solo en esta publicación; las de la competencia son del producto y las comparten todas sus publicaciones. Lo que no se manda queda como está; vacío lo borra.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    propia: z.string().optional().describe('Las preguntas que recibió esta publicación.'),
    competencia: z.string().optional().describe('Las preguntas de las publicaciones de la competencia.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId, ownQuestions, research: r } = await productTarget(ctx, args);
    const parsed = questionsSchema.safeParse({
      own: keepOr(args.propia, ownQuestions),
      competitors: keepOr(args.competencia, r?.competitorQuestions),
    });
    if (!parsed.success) throw new McpToolError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
    await ctx.db.$transaction((tx) =>
      saveQuestions(tx, { productId, publicationId: id, userId: ctx.userId, own: parsed.data.own, competitors: parsed.data.competitors }),
    );
    return { listo: true, link_app: appLink(ctx, account, id) };
  },
});

const KIND = { dolores: 'PAIN', objeciones: 'OBJECTION' } as const;

const saveInsightsTool = defineTool({
  name: 'save_buyer_insights',
  section: ['pipeline', 'productos'],
  title: 'Guardar dolores u objeciones',
  description: `Agrega a la lista de dolores o de objeciones de los compradores, o la reemplaza entera, hasta ${MAX_INSIGHTS} por lista. Son del producto: las comparten todas sus publicaciones. Cada ítem es una frase corta. Tienen que salir de las preguntas guardadas o de lo que te dijo la persona, no de suposiciones. Para reemplazar, confirmalo con la persona antes.`,
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
  section: ['pipeline', 'publicaciones'],
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
      .describe('Para cambiar la categoría: su código o su nombre. null vuelve a la que le toca por el tipo de producto. Si el tipo no tiene una, hay que elegirla antes de cargar los campos.'),
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

// ───────────────────────────── Ficha técnica y contenido del kit ─────────────────────────────

async function sheetResult(ctx: McpContext, account: AccountRef, productId: string, publicationId: string) {
  const state = await technicalSheetState(ctx.db, account.id, productId);
  return {
    ficha_tecnica: state.specs.map((s) => ({ nombre: s.name, valor: s.value })),
    datos_cargados: state.specs.length,
    ...(state.minimum !== null ? { minimo_del_estandar: state.minimum } : {}),
    campos_esperados_por_el_tipo:
      state.expected.length > 0
        ? state.expected
        : state.family
          ? `El tipo de producto «${state.family}» no tiene campos esperados en los canales de la cuenta.`
          : 'El producto no tiene tipo cargado: sin tipo no hay campos esperados.',
    link_app: appLink(ctx, account, publicationId),
  };
}

const saveTechnicalSheetTool = defineTool({
  name: 'save_technical_sheet',
  section: ['productos', 'pipeline'],
  title: 'Cargar la ficha técnica',
  description: `Carga o corrige la ficha técnica del producto: datos técnicos como nombre y valor con su unidad, por ejemplo «Diámetro del cilindro: 83,00 mm». Es la que cuenta en el puntaje como «Ficha técnica completa». Es del producto: la comparten todas sus publicaciones. completar cambia los datos que tienen el mismo nombre y suma los nuevos; un valor vacío borra ese dato. reemplazar cambia la ficha técnica entera: confirmalo con la persona antes. Hasta ${MAX_SPECS} datos. Usá solo datos de la ficha, del fabricante o que te dio la persona, nunca supuestos, calculados ni de memoria. La respuesta trae los campos esperados para la familia del producto en cada canal y cuáles faltan.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    accion: z
      .enum(['completar', 'reemplazar'])
      .default('completar')
      .describe('completar cambia o suma dato por dato; reemplazar cambia la ficha técnica entera.'),
    datos: z
      .array(
        z.object({
          nombre: z.string().min(1).describe('Por ejemplo "Diámetro del cilindro".'),
          valor: z.string().nullable().describe('Con su unidad, por ejemplo "83,00 mm". Vacío o null borra ese dato.'),
        }),
      )
      .max(MAX_SPECS),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId } = await productTarget(ctx, args);
    if (args.accion === 'completar' && args.datos.length === 0) throw new McpToolError('Mandá al menos un dato.');
    await ctx.db.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { specs: true } });
      const specs = mergeSpecs(
        parseNameValueList(product.specs),
        args.datos.map((d) => ({ name: d.nombre, value: d.valor })),
        args.accion === 'reemplazar' ? 'replace' : 'merge',
      );
      await writeContentField(tx, { productId, publicationId: null }, 'specs', specs);
    });
    return { listo: true, ...(await sheetResult(ctx, account, productId, id)) };
  },
});

const MAX_KIT = 5000;

const saveKitContentsTool = defineTool({
  name: 'save_kit_contents',
  section: ['productos', 'pipeline'],
  title: 'Cargar el contenido del kit',
  description: `Carga qué trae la caja del producto, por ejemplo «4 pistones, 4 juegos de aros, 4 pernos, 8 seguros». Es la que cuenta en el puntaje como «Contenido del kit declarado». Es del producto: la comparten todas sus publicaciones. Reemplaza el texto entero; vacío lo borra. Usá solo datos confirmados: de la ficha, del fabricante o que te dio la persona, nunca supuestos.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    contenido: z.string().max(MAX_KIT).describe('Qué trae la caja, con cantidades. Vacío lo borra.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, productId } = await productTarget(ctx, args);
    const text = args.contenido.replace(/\r\n?/g, '\n').trim();
    await ctx.db.$transaction((tx) => writeContentField(tx, { productId, publicationId: null }, 'kitContents', text || null));
    return { listo: true, contenido_del_kit: text || null, link_app: appLink(ctx, account, id) };
  },
});

// ───────────────────────────── Título ─────────────────────────────

const saveSeedsTool = defineTool({
  name: 'save_title_seeds',
  section: 'pipeline',
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
  section: 'pipeline',
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
  section: 'pipeline',
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
  section: 'pipeline',
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
  section: 'pipeline',
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
  section: 'pipeline',
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
  section: 'pipeline',
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
  section: 'pipeline',
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

const setTitleTool = defineTool({
  name: 'set_publication_title',
  section: ['pipeline', 'publicaciones'],
  title: 'Poner el título sin aprobarlo',
  description:
    'Pone o corrige el título de una publicación sin aprobarlo y sin mover el paso del pipeline: sirve para cargar un título provisorio o corregir uno. Usa el mismo chequeo que check_title (largo, signos y palabras no permitidas) y no guarda un título con errores. El título es de la publicación, no el nombre del producto. Si la publicación tiene ventas, el canal no deja cambiar el título: eso se decide en el paso Título. Para aprobarlo y pasar a Imágenes, usá approve_title.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    titulo: z.string().min(1).describe('El título nuevo.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id, tc } = await titleTarget(ctx, args);
    const title = args.titulo.trim();
    if (tc.titleLock.locked && tc.publication.title?.trim()) {
      throw new McpToolError(
        'El título está bloqueado porque la publicación tiene ventas: el canal no deja cambiarlo. Para probar uno nuevo, decidí en el paso Título si se prueba en la copia con cuotas (decide_title_lock).',
      );
    }
    const usable = tc.words.filter((w) => w.status === 'use').map((w) => w.word);
    const check = checkTitle(title, tc.rules, usable.length > 0 ? { usableWords: usable } : {});
    if (check.errors.length > 0) throw new McpToolError(`No se guardó: ${check.errors.join(' ')}`);
    const before = tc.publication.title;
    await ctx.db.$transaction((tx) => writeContentField(tx, { productId: tc.publication.productId, publicationId: id }, 'title', title));
    return {
      listo: true,
      antes: before,
      ...(await stateOf(ctx, account, id)),
      caracteres: check.length,
      ...(check.warnings.length > 0 ? { avisos: check.warnings } : {}),
    };
  },
});

// ───────────────────────────── Copiar entre publicaciones ─────────────────────────────

const COPYABLE = {
  competencia: 'la competencia',
  preguntas_propias: 'las preguntas propias',
  busquedas_principales: 'las búsquedas principales',
  semillas: 'las semillas',
  fotos: 'las fotos elegidas, en su orden y con sus medidas',
  clips: 'los clips',
} as const;
type Copyable = keyof typeof COPYABLE;

const copyResearchTool = defineTool({
  name: 'copy_publication_data',
  section: ['pipeline', 'publicaciones'],
  title: 'Copiar datos de otra publicación del mismo producto',
  description: `Copia a una publicación los datos que son de cada publicación desde otra del mismo producto, eligiendo qué copiar: ${Object.entries(COPYABLE)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ')}. Lo que se copia reemplaza lo que tenía la de destino; lo que la de origen no tiene no se toca. Las fotos del canal de la otra solo se copian si esta también las tiene; las corregidas y las del producto, siempre. Las fotos quedan en el borrador hasta que se suben. La ficha y la investigación del producto no hace falta copiarlas: ya las comparten. Confirmalo con la persona antes.`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg.describe('La publicación a la que se copia: su id, su código en el canal o su link.'),
    desde: z.string().min(1).describe('La publicación de la que se copia, del mismo producto: su id, su código en el canal o su link.'),
    copiar: z
      .array(z.enum(Object.keys(COPYABLE) as [Copyable, ...Copyable[]]))
      .min(1)
      .describe('Qué copiar.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const fromId = await resolvePublication(ctx, account.id, args.desde);
    if (fromId === id) throw new McpToolError('La publicación de origen y la de destino son la misma.');
    const select = {
      productId: true,
      title: true,
      externalId: true,
      ownQuestions: true,
      competitors: { orderBy: { position: 'asc' as const }, select: COMPETITOR_SELECT },
      titleWork: { select: { seeds: true, mainSearches: true } },
    };
    const [from, to] = await Promise.all([
      ctx.db.publication.findUniqueOrThrow({ where: { id: fromId }, select }),
      ctx.db.publication.findUniqueOrThrow({ where: { id }, select }),
    ]);
    if (from.productId !== to.productId) throw new McpToolError('Solo se copia entre publicaciones del mismo producto.');

    const wanted = [...new Set(args.copiar)];
    const copied: Record<string, unknown> = {};
    const skipped: string[] = [];
    const seeds = Array.isArray(from.titleWork?.seeds) ? (from.titleWork.seeds as string[]) : null;
    const searches = Array.isArray(from.titleWork?.mainSearches) ? (from.titleWork.mainSearches as string[]) : [];
    await ctx.db.$transaction(async (tx) => {
      for (const what of wanted) {
        // Las fotos y los clips se copian después, con las reglas de Organización de multimedia.
        if (what === 'fotos' || what === 'clips') continue;
        if (what === 'competencia') {
          if (from.competitors.length === 0) skipped.push(COPYABLE[what]);
          else {
            await saveCompetitors(tx, id, from.competitors.map(storedCompetitor));
            copied.competencia = from.competitors.length;
          }
        } else if (what === 'preguntas_propias') {
          if (!from.ownQuestions?.trim()) skipped.push(COPYABLE[what]);
          else {
            await tx.publication.update({ where: { id }, data: { ownQuestions: from.ownQuestions } });
            copied.preguntas_propias = true;
          }
        } else if (what === 'busquedas_principales') {
          if (searches.length === 0) skipped.push(COPYABLE[what]);
          else copied.busquedas_principales = await setMainSearches(tx, id, searches);
        } else if (!seeds || seeds.length === 0) {
          skipped.push(COPYABLE[what]);
        } else {
          copied.semillas = await saveSeeds(tx, id, seeds);
        }
      }
    });
    if (wanted.includes('fotos') || wanted.includes('clips')) {
      try {
        const media = await copyMedia(ctx.db, {
          accountId: account.id,
          fromId,
          toId: id,
          photos: wanted.includes('fotos'),
          clips: wanted.includes('clips'),
          userId: ctx.userId,
        });
        if (media.fotos) copied.fotos = media.fotos;
        else if (wanted.includes('fotos')) skipped.push(COPYABLE.fotos);
        if (media.fotos_que_no_estan_en_esta) copied.fotos_del_canal_de_la_otra_que_esta_no_tiene = media.fotos_que_no_estan_en_esta;
        if (media.clips) copied.clips = media.clips;
        else if (wanted.includes('clips')) skipped.push(COPYABLE.clips);
      } catch (e) {
        if (e instanceof MediaError || e instanceof VideoError) throw new McpToolError(e.message);
        throw e;
      }
    }
    return {
      listo: Object.keys(copied).length > 0,
      desde: { codigo: from.externalId, titulo: from.title },
      copiado: copied,
      ...(skipped.length > 0 ? { no_se_copio_porque_la_de_origen_no_tiene: skipped } : {}),
      link_app: appLink(ctx, account, id),
    };
  },
});

// ───────────────────────────── Reglas de título ─────────────────────────────

const updateTitleRulesTool = defineTool({
  name: 'update_title_rules',
  section: 'reglas',
  title: 'Editar las reglas de título',
  description:
    'Edita las reglas de título de la cuenta para un canal: largo máximo, signos y palabras no permitidas, y la estructura sugerida por tipo de producto. Lo que no se manda queda como está; las listas reemplazan la lista entera. restablecer vuelve a las reglas del canal. Confirmalo con la persona antes.',
  input: z.object({
    cuenta: accountArg,
    canal: z.string().optional().describe('El canal, por ejemplo "Mercado Libre". Si la cuenta tiene uno solo, se puede omitir.'),
    largo_maximo: z.number().int().nullable().optional().describe('Entre 10 y 500, o null para sin límite.'),
    signos_no_permitidos: z.string().optional().describe('Todos juntos, por ejemplo "!¡*$".'),
    palabras_no_permitidas: z.array(z.string()).max(300).optional(),
    estructuras: z
      .array(z.object({ tipo_de_producto: z.string().describe('Vacío vale para todos los tipos.'), estructura: z.string() }))
      .max(100)
      .optional(),
    restablecer: z.boolean().optional().describe('Borra las reglas de la cuenta y vuelve a las del canal.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
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
        structures: args.estructuras ? args.estructuras.map((s) => ({ family: s.tipo_de_producto, structure: s.estructura })) : rules.structures,
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
        estructuras: rules.structures.map((s) => ({ tipo_de_producto: s.family, estructura: s.structure })),
        son_de_la_cuenta: custom,
      },
    };
  },
});

export const WRITE_TOOLS = [
  addToPipelineTool,
  createPublicationTool,
  updatePublicationTool,
  moveStepTool,
  removeTool,
  updateProductInfoTool,
  saveCompetitorsTool,
  saveManufacturerTool,
  saveClarificationsTool,
  saveKnowledgeTool,
  savePublicationQaTool,
  saveQuestionsTool,
  saveInsightsTool,
  saveCatalogTool,
  saveTechnicalSheetTool,
  saveKitContentsTool,
  saveSeedsTool,
  saveSuggestionsTool,
  setWordsTool,
  setMainSearchesTool,
  savePositionTool,
  decideLockTool,
  saveProposalsTool,
  approveTitleTool,
  setTitleTool,
  copyResearchTool,
  updateTitleRulesTool,
];
