import { z } from 'zod';
import { CHANNEL_STATUS_LABEL } from '@/domain/channel-status';
import { COMPETITOR_SELECT, offerOf, offerPrices, storedCompetitor } from '@/domain/competitors';
import { LATEST_MEASUREMENTS, METRICS, formatMetric, isMetricKey, latestMetrics, type Metrics } from '@/domain/measurements';
import { parseNameValueList, type NameValue } from '@/domain/name-value';
import {
  PIPELINE_EXIT_LABEL,
  PIPELINE_REMOVAL_LABEL,
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABEL,
  PIPELINE_STEPS,
  PIPELINE_STEP_LABEL,
  pipelineLabel,
} from '@/domain/pipeline';
import { richTextToMarkdown, withoutPrices } from '@/domain/research';
import { titleLockText, type TitleLock } from '@/domain/title-lock';
import { structureFor } from '@/domain/title-rules';
import { checkTitle, titleCoverage } from '@/domain/titles';
import type { PipelineStep } from '@/generated/prisma/enums';
import {
  BANDS,
  CHANNEL_STATUSES,
  LOCK_OPTIONS,
  SALES_OPTIONS,
  SORTS,
  VISIT_RANGES,
  encodeFamily,
  filterPublications,
  parsePublicationSearch,
} from '@/lib/queries/catalog-filters';
import { listBoard, listPipelineMovements } from '@/lib/queries/pipeline';
import { listScoredPublications, type ScoredPublication } from '@/lib/queries/scoring';
import { KIND_OPTIONS, parseKinds } from '@/lib/queries/catalog-filters';
import { fileHref } from '@/lib/file-rules';
import { loadResearch } from '@/lib/queries/research';
import { loadCombo } from '@/lib/queries/combos';
import { comboForAi, comboParts, PRODUCT_KIND_LABEL } from '@/domain/combos';
import { loadCatalogData } from '@/lib/catalog-data';
import { catalogForClaude } from './catalog';
import { loadTitleContext, RECEIVED_QUESTIONS } from '@/lib/queries/title-step';
import {
  McpToolError,
  accountArg,
  appLink,
  daysSince,
  defineTool,
  publicationArg,
  resolveAccount,
  resolvePublication,
  when,
  type AccountRef,
  type McpContext,
} from './tool';

// Las herramientas que solo leen. Son una capa fina sobre las mismas
// consultas que usan las pantallas. Nunca devuelven precios ni nada de las
// conexiones con los canales.

const LOCK_DECISION_LABEL = { KEEP: 'Mantener el título', TRY_IN_COPY: 'Probar el título nuevo en la copia con cuotas' };
const WORD_STATUS_LABEL = { use: 'usar', discard: 'descartar' } as const;
const MAX_WORDS = 150;

// Por las dudas: ningún dato con nombre de precio o costo sale de la app.
const CONFIDENTIAL = /precio|costo|price|cost|proveedor|supplier/i;
const safeList = (list: NameValue[]) => list.filter((nv) => !CONFIDENTIAL.test(nv.name));

const labels = (entries: [string, string][]) => entries.map(([v, l]) => `${v} = ${l}`).join('; ');

// Una publicación de la competencia, con su precio final y el valor de la cuota si tiene precio.
function competitorOut(c: Parameters<typeof storedCompetitor>[0]) {
  const row = storedCompetitor(c);
  const offer = offerOf(c);
  const prices = offer ? offerPrices(offer, 0) : null;
  return {
    titulo: row.title,
    vendidos: row.soldQuantity,
    link: row.url,
    vendedor: row.sellerName,
    precio_de_lista: row.listPrice,
    descuento_pct: row.discountPct,
    cuotas_sin_interes: row.installments,
    envio_gratis: row.freeShipping,
    relevado: row.surveyedAt,
    notas: row.notes,
    precio_final: prices ? Math.round(prices.finalPrice * 100) / 100 : null,
    valor_cuota: prices?.installmentValue ? Math.round(prices.installmentValue * 100) / 100 : null,
  };
}
const asEnum = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

function lockValue(lock: TitleLock) {
  return {
    bloqueado: lock.locked === null ? 'sin dato' : lock.locked ? 'sí' : 'no',
    texto: titleLockText(lock),
  };
}

/** Lo que se muestra de una publicación en las listas. */
function summary(ctx: McpContext, account: AccountRef, p: ScoredPublication) {
  return {
    id: p.id,
    codigo: p.externalId,
    titulo: p.title,
    tienda: `${p.channelName} · ${p.storeName}`,
    individual_o_combo: PRODUCT_KIND_LABEL[p.kind],
    familia: p.family,
    puntaje: p.score,
    visitas_90d: p.visits,
    ventas_90d: p.sales,
    titulo_bloqueado: lockValue(p.titleLock).bloqueado,
    pipeline: pipelineLabel(p),
    estado_en_canal: CHANNEL_STATUS_LABEL[p.channelStatus],
    link_canal: p.url,
    link_app: appLink(ctx, account, p.id),
  };
}

function metricsOf(metrics: Metrics): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (isMetricKey(key) && value !== undefined) out[METRICS[key].label] = formatMetric(key, value);
  }
  return out;
}

// ───────────────────────────── Cuentas ─────────────────────────────

const listAccounts = defineTool({
  name: 'list_accounts',
  title: 'Ver cuentas',
  description:
    'Lista las cuentas de clientes, con sus tiendas y cuántas publicaciones hay en cada estado y paso del pipeline. Conviene usarla primero para saber el código de cada cuenta.',
  input: z.object({}),
  readOnly: true,
  async run(ctx) {
    const [user, accounts] = await Promise.all([
      ctx.db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
      ctx.db.account.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, slug: true, name: true, stores: { select: { name: true, channel: { select: { name: true } } } } },
      }),
    ]);
    const cuentas = await Promise.all(
      accounts.map(async (a) => {
        const [byStatus, byStep] = await Promise.all([
          ctx.db.publication.groupBy({ by: ['pipelineStatus'], where: { product: { accountId: a.id } }, _count: true }),
          ctx.db.publication.groupBy({
            by: ['pipelineStep'],
            where: { product: { accountId: a.id }, pipelineStatus: 'IN_PIPELINE' },
            _count: true,
          }),
        ]);
        const status = new Map(byStatus.map((r) => [r.pipelineStatus, r._count]));
        const step = new Map(byStep.map((r) => [r.pipelineStep, r._count]));
        return {
          cuenta: a.slug,
          nombre: a.name,
          tiendas: a.stores.map((s) => `${s.channel.name} · ${s.name}`),
          publicaciones: byStatus.reduce((n, r) => n + r._count, 0),
          pipeline: Object.fromEntries(PIPELINE_STATUSES.map((s) => [PIPELINE_STATUS_LABEL[s], status.get(s) ?? 0])),
          en_cada_paso: Object.fromEntries(PIPELINE_STEPS.map((s) => [PIPELINE_STEP_LABEL[s], step.get(s) ?? 0])),
        };
      }),
    );
    return { conectado_como: user?.name ?? null, cuentas };
  },
});

// ───────────────────────────── Publicaciones ─────────────────────────────

const searchCatalog = defineTool({
  name: 'search_catalog',
  title: 'Buscar en Publicaciones',
  description:
    'Busca en la lista de Publicaciones de una cuenta, con los mismos filtros de la pantalla. Devuelve título, código, si es individual o combo, familia, puntaje, visitas y ventas de 90 días, si el título está bloqueado y el estado en el pipeline. Los filtros con varios valores aceptan cualquiera de ellos.',
  input: z.object({
    cuenta: accountArg,
    texto: z.string().optional().describe('Busca en el título, el código del canal y los SKU.'),
    pipeline: z
      .array(asEnum(PIPELINE_STATUSES))
      .optional()
      .describe(`Estado en el pipeline: ${labels(PIPELINE_STATUSES.map((s) => [s, PIPELINE_STATUS_LABEL[s]]))}.`),
    paso: z
      .array(asEnum(PIPELINE_STEPS))
      .optional()
      .describe(`Paso, para las que están en el pipeline: ${labels(PIPELINE_STEPS.map((s) => [s, PIPELINE_STEP_LABEL[s]]))}.`),
    individual_o_combo: z
      .array(asEnum(KIND_OPTIONS.map((o) => o.value)))
      .optional()
      .describe('individual = productos individuales; combo = combos armados con productos individuales.'),
    familia: z
      .array(z.string())
      .optional()
      .describe('Familia de producto, por ejemplo "Kit de embrague". Si no coincide exacto, busca las familias que la contienen.'),
    visitas: z
      .array(asEnum(VISIT_RANGES.map((r) => r.value)))
      .optional()
      .describe(`Visitas en 90 días: ${labels(VISIT_RANGES.map((r) => [r.value, r.label]))}.`),
    ventas: z
      .array(asEnum(SALES_OPTIONS.map((o) => o.value)))
      .optional()
      .describe(`Ventas en 90 días: ${labels(SALES_OPTIONS.map((o) => [o.value, o.label]))}.`),
    bloqueado: z
      .array(asEnum(LOCK_OPTIONS.map((o) => o.value)))
      .optional()
      .describe(`Título bloqueado por ventas: ${labels(LOCK_OPTIONS.map((o) => [o.value, o.label]))}.`),
    puntaje: asEnum(BANDS.filter((b) => b.value).map((b) => b.value))
      .optional()
      .describe(`Rango de puntaje: ${labels(BANDS.filter((b) => b.value).map((b) => [b.value, b.label]))}.`),
    estado_en_canal: z
      .array(asEnum(CHANNEL_STATUSES))
      .optional()
      .describe(`Estado en el canal: ${labels(CHANNEL_STATUSES.map((s) => [s, CHANNEL_STATUS_LABEL[s]]))}.`),
    orden: asEnum(SORTS.map((s) => s.value))
      .optional()
      .describe(`Orden: ${labels(SORTS.map((s) => [s.value, s.label]))}. Sin orden, menor puntaje primero.`),
    limite: z.number().int().min(1).max(200).optional().describe('Cuántas devolver, hasta 200. Sin límite, 50.'),
    desde: z.number().int().min(0).optional().describe('Cuántas saltear, para ver las siguientes.'),
    incluir_familias: z.boolean().optional().describe('Suma la lista de familias de la cuenta con cuántas publicaciones tiene cada una.'),
  }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx.db, args.cuenta);
    const all = await listScoredPublications(account.id, {}, ctx.db);
    const counts = new Map<string, number>();
    for (const p of all) if (p.family) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
    const families = [...counts.keys()];

    // Cada familia pedida: la exacta o, si no hay, las que la contienen.
    const wantedFamilies = (args.familia ?? []).flatMap((raw) => {
      const f = raw.trim().toLowerCase();
      const exact = families.filter((x) => x.toLowerCase() === f);
      return exact.length > 0 ? exact : families.filter((x) => x.toLowerCase().includes(f));
    });
    if ((args.familia ?? []).length > 0 && wantedFamilies.length === 0) {
      throw new McpToolError(`No hay publicaciones con la familia ${args.familia!.join(', ')}. Usá incluir_familias para ver cuáles hay.`);
    }

    const join = (list: string[] | undefined) => (list && list.length > 0 ? list.join(',') : undefined);
    const filters = parsePublicationSearch({
      q: args.texto,
      pipeline: join(args.pipeline),
      familia: join(wantedFamilies.map(encodeFamily)),
      tipo: join(args.individual_o_combo),
      visitas: join(args.visitas),
      ventas: join(args.ventas),
      bloqueado: join(args.bloqueado),
      puntaje: args.puntaje,
      estado: join(args.estado_en_canal),
      orden: args.orden,
    });
    const steps = new Set<PipelineStep>(args.paso ?? []);
    const found = filterPublications(all, filters).filter(
      (p) => steps.size === 0 || (p.pipelineStatus === 'IN_PIPELINE' && p.pipelineStep !== null && steps.has(p.pipelineStep)),
    );
    const from = args.desde ?? 0;
    const page = found.slice(from, from + (args.limite ?? 50));
    return {
      cuenta: account.slug,
      total: found.length,
      mostrando: page.length > 0 ? `${from + 1} a ${from + page.length}` : 'ninguna',
      publicaciones: page.map((p) => summary(ctx, account, p)),
      ...(args.incluir_familias
        ? {
            familias: [...counts.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
              .map(([familia, publicaciones]) => ({ familia, publicaciones })),
          }
        : {}),
    };
  },
});

// ───────────────────────────── Tablero ─────────────────────────────

const getPipelineBoard = defineTool({
  name: 'get_pipeline_board',
  title: 'Ver el tablero del pipeline',
  description:
    'Muestra el tablero del pipeline de una cuenta: cuántas publicaciones hay en cada paso, cuáles son y hace cuántos días esperan en ese paso. Las que esperan hace más van primero. Se puede ver solo individuales o solo combos.',
  input: z.object({
    cuenta: accountArg,
    individual_o_combo: z
      .array(asEnum(KIND_OPTIONS.map((o) => o.value)))
      .optional()
      .describe('individual = productos individuales; combo = combos armados con productos individuales.'),
  }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx.db, args.cuenta);
    const now = new Date();
    const kinds = parseKinds(args.individual_o_combo?.join(','));
    const [board, completed] = await Promise.all([
      listBoard(account.id, ctx.db),
      ctx.db.pipelineMovement.count({
        where: {
          exitKind: 'COMPLETED',
          exitedAt: { gte: new Date(now.getTime() - 30 * 24 * 3600_000) },
          publication: { product: { accountId: account.id } },
        },
      }),
    ]);
    const items = kinds.length > 0 ? board.filter((i) => kinds.includes(i.kind)) : board;
    return {
      cuenta: account.slug,
      en_el_pipeline: items.length,
      terminadas_ultimos_30_dias: completed,
      pasos: PIPELINE_STEPS.map((step) => {
        const inStep = items.filter((i) => i.pipelineStep === step);
        return {
          paso: step,
          nombre: PIPELINE_STEP_LABEL[step],
          cantidad: inStep.length,
          publicaciones: inStep.map((i) => ({
            ...summary(ctx, account, i),
            en_el_paso_desde: when(i.stepSince, account),
            dias_en_el_paso: daysSince(i.stepSince, now),
          })),
        };
      }),
    };
  },
});

// ───────────────────────────── Publicación ─────────────────────────────

const getPublication = defineTool({
  name: 'get_publication',
  title: 'Ver una publicación',
  description:
    'Muestra todo de una publicación: la ficha del producto (la fuente de verdad), el título y la descripción actuales, los atributos del canal, los datos de catálogo del canal (cada campo del formulario de su categoría, con sus opciones y lo cargado), el puntaje y lo que le falta, la última medición, el estado e historial del pipeline, el candado del título, la competencia cargada y la investigación del producto: lo del fabricante, las aclaraciones para las imágenes, las preguntas de los compradores (las que llegaron solas del canal, con su respuesta, y las pegadas) y sus dolores y objeciones. La ficha y la investigación son del producto y las comparten todas sus publicaciones; las preguntas de la publicación propia son solo de esta.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx.db, args.cuenta);
    const id = await resolvePublication(ctx.db, account.id, args.publicacion);
    const [pub, [scored], movements, research, catalog] = await Promise.all([
      ctx.db.publication.findUniqueOrThrow({
        where: { id },
        select: {
          title: true,
          description: true,
          attributes: true,
          ownQuestions: true,
          buyerQuestions: {
            where: { status: { in: ['UNANSWERED', 'ANSWERED'] }, text: { not: '' } },
            orderBy: { askedAt: 'desc' },
            take: RECEIVED_QUESTIONS,
            select: { text: true, answer: true, askedAt: true },
          },
          measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { takenAt: true, metrics: true } },
          competitors: { orderBy: { position: 'asc' }, select: COMPETITOR_SELECT },
          product: {
            select: {
              id: true,
              name: true,
              productType: true,
              brand: true,
              partNumber: true,
              engineSystem: true,
              line: true,
              origin: true,
              warranty: true,
              kitContents: true,
              specs: true,
              variants: { orderBy: { position: 'asc' }, select: { measure: true, sku: true } },
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
              assets: { select: { kind: true } },
              _count: { select: { publications: true } },
            },
          },
        },
      }),
      listScoredPublications(account.id, { id }, ctx.db),
      listPipelineMovements(id, ctx.db),
      ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { productId: true } }).then((p) => loadResearch(ctx.db, p.productId)),
      loadCatalogData(ctx.db, id),
    ]);
    const product = pub.product;
    const combo = await loadCombo(ctx.db, product.id);
    const r = research.research;
    const manufacturerText = withoutPrices(r?.manufacturerText ?? null);
    const measurement = pub.measurements[0] ?? null;
    return {
      ...summary(ctx, account, scored),
      titulo: pub.title,
      descripcion: pub.description,
      atributos_en_el_canal: safeList(parseNameValueList(pub.attributes)),
      datos_de_catalogo: catalogForClaude(catalog),
      ficha: {
        producto_id: product.id,
        nombre: product.name,
        publicaciones_que_la_comparten: product._count.publications,
        individual_o_combo: combo ? PRODUCT_KIND_LABEL[combo.kind] : null,
        ...(combo?.kind === 'COMBO'
          ? {
              productos_del_combo: combo.items.map((i) => ({
                nombre: i.name,
                cantidad: i.quantity,
                marca: i.brand,
                numero_de_pieza: i.partNumber,
              })),
            }
          : combo && combo.inCombos.length > 0
            ? { forma_parte_de_combos: combo.inCombos.map((c) => ({ nombre: c.name, cantidad: c.quantity })) }
            : {}),
        tipo: product.productType,
        marca: product.brand,
        numero_de_pieza: product.partNumber,
        sistema_del_motor: product.engineSystem,
        linea: product.line,
        origen: product.origin,
        garantia: product.warranty,
        contenido_del_kit: product.kitContents,
        ficha_tecnica: safeList(parseNameValueList(product.specs)),
        variantes: product.variants.map((v) => ({ medida: v.measure, sku: v.sku })),
        compatibilidades: product.compatibilities.map((c) => ({
          marca: c.vehicleBrand,
          modelo: c.model,
          motor: c.engine,
          cilindrada: c.displacement,
          combustible: c.fuel,
          desde: c.yearFrom,
          hasta: c.yearTo,
          nota: c.note,
        })),
        fotos: product.assets.filter((a) => a.kind === 'PHOTO').length,
        videos: product.assets.filter((a) => a.kind === 'VIDEO').length,
      },
      puntaje: {
        valor: scored.score,
        le_falta: scored.missing.map((m) => ({ regla: m.name, peso: m.weight, detalle: m.detail })),
      },
      ultima_medicion: measurement ? { fecha: when(measurement.takenAt, account), metricas: metricsOf(latestMetrics(pub.measurements)) } : null,
      titulo_bloqueado: lockValue(scored.titleLock),
      pipeline: {
        estado: PIPELINE_STATUS_LABEL[scored.pipelineStatus],
        paso: scored.pipelineStep ? PIPELINE_STEP_LABEL[scored.pipelineStep] : null,
        motivo_de_salida: scored.pipelineRemoval ? PIPELINE_REMOVAL_LABEL[scored.pipelineRemoval] : null,
        historial: movements.map((m) => ({
          paso: PIPELINE_STEP_LABEL[m.step],
          entro: when(m.enteredAt, account),
          entro_por: m.user?.name ?? null,
          salio: when(m.exitedAt, account),
          como_salio: m.exitKind ? PIPELINE_EXIT_LABEL[m.exitKind] : null,
          motivo: m.removal ? PIPELINE_REMOVAL_LABEL[m.removal] : null,
          salio_por: m.exitedBy?.name ?? null,
        })),
      },
      competencia: pub.competitors.map(competitorOut),
      investigacion: {
        fabricante: {
          sitio: r?.manufacturerSite ?? null,
          pagina_del_producto: r?.manufacturerProductUrl ?? null,
          texto: manufacturerText.text,
          ...(manufacturerText.hidden > 0 ? {
                aviso:
                  manufacturerText.hidden === 1
                    ? 'Se ocultó una línea que parecía un precio.'
                    : `Se ocultaron ${manufacturerText.hidden} líneas que parecían precios.`,
              } : {}),
          archivos: research.files.map((f) => ({
            nombre: f.name,
            tipo: f.kind === 'PDF' ? 'pdf' : 'imagen',
            kb: Math.max(1, Math.round(f.size / 1024)),
            link: `${ctx.baseUrl}${fileHref(f.id)}`,
          })),
        },
        aclaraciones_para_imagenes: richTextToMarkdown(r?.clarifications ?? null) || null,
        preguntas: {
          // Las que llegaron solas del canal, con su respuesta si la tiene.
          recibidas: pub.buyerQuestions.map((q) => ({ pregunta: q.text, respuesta: q.answer, fecha: q.askedAt.toISOString().slice(0, 10) })),
          propia: pub.ownQuestions,
          competencia: r?.competitorQuestions ?? null,
        },
        dolores: research.pains.map((i) => i.text),
        objeciones: research.objections.map((i) => i.text),
      },
    };
  },
});

// ───────────────────────────── Título ─────────────────────────────

async function titleContext(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const account = await resolveAccount(ctx.db, args.cuenta);
  const id = await resolvePublication(ctx.db, account.id, args.publicacion);
  const tc = await loadTitleContext(ctx.db, account.id, id);
  if (!tc) throw new McpToolError('La publicación no está en la cuenta.');
  return { account, tc };
}

const getTitleWorkspace = defineTool({
  name: 'get_title_workspace',
  title: 'Ver el trabajo del título',
  description:
    'Muestra el paso Título de una publicación: el candado y la decisión tomada, las reglas y la estructura sugerida, las semillas, las sugerencias del buscador guardadas con su fecha, el mapa de palabras con las tildadas, las búsquedas principales y sus posiciones, las propuestas guardadas, la competencia y el último título aprobado. Si el producto es un combo, trae los productos que lo forman: el título tiene que dejar claro que trae varios.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const { account, tc } = await titleContext(ctx, args);
    const combo = await loadCombo(ctx.db, tc.publication.productId);
    const current = tc.publication.title ?? '';
    const usable = tc.words.filter((w) => w.status === 'use').map((w) => w.word);
    return {
      publicacion: {
        id: tc.publication.id,
        codigo: tc.publication.externalId,
        titulo_actual: tc.publication.title,
        pipeline: pipelineLabel({ ...tc.publication, pipelineRemoval: null }),
        link_app: appLink(ctx, account, tc.publication.id),
      },
      canal: tc.channel.name,
      titulo_bloqueado: lockValue(tc.titleLock),
      decision_del_bloqueo: tc.lockDecision ? LOCK_DECISION_LABEL[tc.lockDecision] : null,
      ficha: {
        nombre: tc.product.name,
        ...comboForAi(comboParts(combo)),
        tipo: tc.product.productType,
        marca: tc.product.brand,
        numero_de_pieza: tc.product.partNumber,
        linea: tc.product.line,
        variantes: tc.product.variants.map((v) => ({ medida: v.measure, sku: v.sku })),
        compatibilidades: tc.product.compatibilities.map((c) => ({
          marca: c.vehicleBrand,
          modelo: c.model,
          motor: c.engine,
          cilindrada: c.displacement,
          combustible: c.fuel,
          desde: c.yearFrom,
          hasta: c.yearTo,
          nota: c.note,
        })),
      },
      reglas: {
        largo_maximo: tc.rules.maxLength,
        signos_no_permitidos: tc.rules.forbiddenChars,
        palabras_no_permitidas: tc.rules.forbiddenWords,
        estructura_sugerida: structureFor(tc.rules, tc.product.productType),
        son_de_la_cuenta: tc.customRules,
      },
      semillas: tc.seeds,
      semillas_guardadas: tc.seedsSaved,
      sugerencias_del_buscador: tc.captures.map((c) => ({
        semilla: c.seed,
        se_escribio: c.query,
        sugerencias: c.suggestions,
        origen: c.source === 'AUTO' ? 'leído por la app' : 'cargado a mano',
        fecha: when(c.capturedAt, account),
      })),
      mapa_de_palabras: {
        total: tc.words.length,
        palabras: tc.words.slice(0, MAX_WORDS).map((w) => ({
          palabra: w.word,
          en_sugerencias: w.inSuggestions,
          en_competencia: w.inCompetitors,
          estado: w.status ? WORD_STATUS_LABEL[w.status] : null,
        })),
      },
      palabras_tildadas: usable,
      busquedas_principales: tc.mainSearches,
      posiciones: tc.positions.map((p) => ({
        busqueda: p.query,
        pagina: p.page,
        posicion: p.position,
        paginas_revisadas: p.pagesChecked,
        origen: p.source === 'AUTO' ? 'leído por la app' : 'cargado a mano',
        fecha: when(p.checkedAt, account),
      })),
      propuestas: tc.proposals.map((p) => ({ titulo: p.title, motivo: p.reason })),
      propuestas_fecha: when(tc.proposalsAt, account),
      competencia: tc.competitors.map(competitorOut),
      ultimo_titulo_aprobado: tc.lastApproval
        ? {
            resultado: tc.lastApproval.outcome,
            antes: tc.lastApproval.before,
            titulo: tc.lastApproval.title,
            por: tc.lastApproval.user?.name ?? null,
            fecha: when(tc.lastApproval.createdAt, account),
          }
        : null,
      chequeo_del_titulo_actual: current ? checkTitle(current, tc.rules, usable.length > 0 ? { usableWords: usable } : {}) : null,
    };
  },
});

const checkTitleTool = defineTool({
  name: 'check_title',
  title: 'Chequear un título',
  description:
    'Chequea un título para una publicación con el mismo control de la app: largo, signos y palabras no permitidas, palabras repetidas o sin tildar, y qué búsquedas cubre. Un título con errores no se puede aprobar. Usala antes de proponer un título.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    titulo: z.string().describe('El título a chequear.'),
  }),
  readOnly: true,
  async run(ctx, args) {
    const { tc } = await titleContext(ctx, args);
    const usable = tc.words.filter((w) => w.status === 'use').map((w) => w.word);
    const check = checkTitle(args.titulo, tc.rules, usable.length > 0 ? { usableWords: usable } : {});
    const warnings = [...check.warnings];
    if (tc.titleLock.locked && !tc.lockDecision) {
      warnings.push('El título está bloqueado: antes de aprobar hay que decidir si se mantiene o se prueba en la copia con cuotas.');
    }
    const suggestions = titleCoverage(args.titulo, tc.suggestions);
    const main = titleCoverage(args.titulo, tc.mainSearches);
    return {
      titulo: args.titulo.trim(),
      caracteres: check.length,
      largo_maximo: tc.rules.maxLength,
      se_puede_aprobar: check.errors.length === 0,
      errores: check.errors,
      avisos: warnings,
      estructura_sugerida: structureFor(tc.rules, tc.product.productType),
      busquedas_principales: { cubre: main.covered, no_cubre: main.missing },
      sugerencias_del_buscador: {
        cubre: suggestions.covered.length,
        de: suggestions.covered.length + suggestions.missing.length,
        no_cubre: suggestions.missing.slice(0, 30),
      },
    };
  },
});

export const READ_TOOLS = [listAccounts, searchCatalog, getPipelineBoard, getPublication, getTitleWorkspace, checkTitleTool];
