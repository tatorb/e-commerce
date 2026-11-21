import { z } from 'zod';
import { planLabel } from '@/domain/pricing';
import { EVENT_TIERS, EVENT_TIER_LABEL, LAYER_LABEL } from '@/domain/promo/plan';
import { COMPETITION_LABEL, LIFECYCLE_LABEL, OBJECTIVE_LABEL, PRIORITY_LABEL, tagsText, type Competition, type Lifecycle, type Priority, type PromoTags, type TagGroup } from '@/domain/promo/tags';
import { applyDue, dueActions, putBack, takeOut, type AppliedAction, type DueAction } from '@/lib/promo/apply';
import { classifiedText, classifyAccount } from '@/lib/promo/classify';
import { cancelSlot, deleteEvent, listEvents, saveEvent, saveManualSlot } from '@/lib/promo/manual';
import { loadLog, measureDue } from '@/lib/promo/measure';
import { loadOverview, OVERVIEW_STATES, overviewProductIds, type OverviewFilter } from '@/lib/promo/overview';
import { generatePlan } from '@/lib/promo/plan';
import { productOfPublication } from '@/lib/promo/product';
import { loadPromoSettings, PromoError, savePromoSettings } from '@/lib/promo/settings';
import { refreshPublications, sweepInvitations } from '@/lib/promo/sweep';
import { setOptionsExcluded, setPromoTags } from '@/lib/promo/tags';
import { loadProductGrid, type GridColumn, type ProductGrid } from '@/lib/promo/view';
import { rulesPatchSchema } from '@/domain/promo/rules';
import { fromZonedInput } from '@/lib/zoned-input';
import { McpToolError, accountArg, defineTool, findPublication, resolveAccount, when, type AccountRef, type McpContext } from './tool';

// Promociones desde Claude: las etiquetas de cada producto, el almanaque de
// ofertas, las invitaciones del canal, el calendario de eventos y las reglas.
// Todo lo que cambia algo en el canal muestra antes qué va a hacer y pide la
// confirmación de la persona.

const BUDGET_MS = 40_000;
const CONFIRM = 'Antes, mostrale a la persona exactamente qué vas a hacer y esperá que confirme.';

const LIFECYCLE_IN = { nueva: 'NEW', en_crecimiento: 'GROWING', madurada: 'MATURE', a_liquidar: 'CLEARANCE' } as const;
const COMPETITION_IN = { pelea_por_precio: 'PRICE_FIGHT', sin_competencia: 'NO_COMPETITION' } as const;
const PRIORITY_IN = { empujar: 'PUSH', estacional: 'SEASONAL' } as const;
const GROUP_IN = { ciclo_de_vida: 'lifecycle', competencia: 'competition', en_catalogo: 'inCatalog' } as const;
const TIER_IN = { t1: 'T1', t2: 'T2', potencia_tus_ventas: 'BOOST', ofertas_compartidas: 'SHARED', fecha_propia: 'OWN' } as const;
const keyOf = <T extends Record<string, string>>(map: T, value: string | null) => (Object.entries(map).find(([, v]) => v === value)?.[0] ?? null) as keyof T | null;

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof PromoError) throw new McpToolError(e.message);
    throw e;
  }
}

const filterArg = z
  .object({
    ciclo_de_vida: z.enum(['nueva', 'en_crecimiento', 'madurada', 'a_liquidar', 'sin_etiqueta']).optional(),
    competencia: z.enum(['pelea_por_precio', 'sin_competencia']).optional(),
    prioridad: z.enum(['empujar', 'estacional']).optional(),
    control_de_stock: z.boolean().optional(),
    marca: z.string().max(80).optional(),
    estado: z.enum(OVERVIEW_STATES).optional().describe('sin_etiquetas: sin ciclo de vida. con_ofertas: con alguna prendida. por_entrar: con alguna por entrar. con_afuera: con formas de cobro afuera. con_errores: con alguna que no se pudo. sin_almanaque: con etiquetas y sin almanaque.'),
    buscar: z.string().max(80).optional().describe('Un texto del nombre del producto, o el código de una publicación.'),
  })
  .describe('Qué productos: los que cumplen todo lo que se pide.');

const toFilter = (f: z.infer<typeof filterArg> | undefined): OverviewFilter => ({
  lifecycle: f?.ciclo_de_vida === 'sin_etiqueta' ? 'none' : f?.ciclo_de_vida ? LIFECYCLE_IN[f.ciclo_de_vida] : undefined,
  competition: f?.competencia ? COMPETITION_IN[f.competencia] : undefined,
  priority: f?.prioridad ? PRIORITY_IN[f.prioridad] : undefined,
  stockControl: f?.control_de_stock,
  brand: f?.marca,
  state: f?.estado,
  query: f?.buscar,
});

const productsArg = {
  publicaciones: z.array(z.string().min(1)).min(1).max(100).optional().describe('Una publicación de cada producto: su id en la app, su código en el canal o su link. Vale cualquiera de sus formas de cobro: las etiquetas y el almanaque son del producto.'),
  filtro: filterArg.optional(),
  todos: z.boolean().optional().describe('true = todos los productos de la cuenta con publicaciones en el canal.'),
};

/** Los productos pedidos, por sus publicaciones, por un filtro o todos. */
async function resolveProducts(ctx: McpContext, account: AccountRef, args: { publicaciones?: string[]; filtro?: z.infer<typeof filterArg>; todos?: boolean }): Promise<string[]> {
  if (args.publicaciones) {
    const ids: string[] = [];
    for (const ref of args.publicaciones) {
      const productId = await productOfPublication(ctx.db, account.id, await findPublication(ctx.db, account.id, ref));
      if (productId && !ids.includes(productId)) ids.push(productId);
    }
    return ids;
  }
  if (args.filtro || args.todos) return overviewProductIds(ctx.db, account.id, args.todos ? {} : toFilter(args.filtro));
  throw new McpToolError('Decí de qué productos: con publicaciones, con filtro o con todos.');
}

const tagsOut = (t: PromoTags) => ({
  ciclo_de_vida: t.lifecycle ? LIFECYCLE_LABEL[t.lifecycle] : null,
  competencia: t.competition ? COMPETITION_LABEL[t.competition] : null,
  en_catalogo: t.inCatalog,
  control_de_stock: t.stockControl,
  prioridad: t.priority ? PRIORITY_LABEL[t.priority] : null,
});

const round = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

function columnOut(grid: ProductGrid, c: GridColumn, account: AccountRef, detail: boolean) {
  const option = new Map(grid.measures.flatMap((m) => m.options.map((o) => [o.publicationId, { ...o, measure: m.measure }] as const)));
  return {
    franja: c.slotId,
    campana: c.group,
    capa: LAYER_LABEL[c.layer],
    oferta: c.name,
    tipo: c.kind === 'OWN_DISCOUNT' ? 'Descuento propio' : (c.campaignKind ?? 'Campaña del canal'),
    desde: when(c.start, account),
    hasta: when(c.finish, account),
    rentabilidad_buscada_pct: c.targetMarginPct,
    origen: c.source === 'PLAN' ? 'almanaque' : c.source === 'MANUAL' ? 'a_mano' : 'canal_sin_franja',
    ...(c.cancelled ? { no_va: true } : {}),
    ...(c.note ? { nota: c.note } : {}),
    cuentas: { adentro_o_por_entrar: c.counts.in, de_esas_al_tope: c.counts.capped, afuera: c.counts.out, no_se_pudo: c.counts.failed },
    ...(detail
      ? {
          casilleros: c.cells.map((cell) => {
            const o = option.get(cell.publicationId);
            return {
              casillero: cell.itemId,
              publicacion: o?.externalId ?? cell.publicationId,
              ...(o?.measure ? { medida: o.measure } : {}),
              forma_de_cobro: o?.planLabel,
              estado: cell.label,
              ...(cell.price !== null ? { precio_para_el_comprador: cell.price } : {}),
              ...(cell.discountPct !== null ? { descuento_pct: cell.discountPct } : {}),
              ...(cell.marginPct !== null ? { rentabilidad_pct: cell.marginPct } : {}),
              ...(cell.text ? { motivo: cell.text } : {}),
              ...(cell.lastError ? { ultimo_error: cell.lastError } : {}),
            };
          }),
        }
      : {}),
  };
}

const getPromotions = defineTool({
  name: 'get_promotions',
  section: 'promociones',
  title: 'Ver las promociones',
  description:
    'Promociones de la cuenta, como la sección Promociones. Sin publicacion: la lista de productos con publicaciones en el canal, cada uno con sus etiquetas (ciclo de vida, competencia, control de stock, prioridad), su objetivo y cuántas formas de cobro tiene adentro, por entrar, afuera y con error, con filtros. Con publicacion: el producto de esa publicación, con la grilla de medidas por formas de cobro (cada forma de cobro es una publicación con su código, su precio de hoy y lo que deja hoy) y, por cada franja del almanaque y cada campaña del canal, qué pasa en cada casillero: adentro, por entrar, al tope o afuera y por qué (no invitada, bajo el piso, prohibida, en revisión, poco stock, sin costo), con el precio para el comprador y la rentabilidad que deja; y la bitácora. La rentabilidad es sobre el costo, por forma de cobro, con el costo de sus cuotas. Las invitaciones salen de la copia que la app lee del canal: invitaciones_leidas dice de cuándo es; para leerlas de nuevo, review_invitations.',
  input: z.object({
    cuenta: accountArg,
    publicacion: z.string().min(1).optional().describe('Una publicación del producto: su id en la app, su código en el canal o su link.'),
    filtro: filterArg.optional(),
    limite: z.number().int().min(1).max(200).optional().describe('Cuántos productos traer en la lista. Sin decir, 50.'),
    desde: z.number().int().min(0).optional().describe('Desde qué producto de la lista, para seguir.'),
    solo_franjas: z.boolean().optional().describe('Con publicacion: true = las franjas con sus cuentas, sin el detalle de cada casillero.'),
  }),
  readOnly: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      if (!args.publicacion) {
        const settings = await loadPromoSettings(ctx.db, account.id);
        const o = await loadOverview(ctx.db, account.id, { ...toFilter(args.filtro), limit: args.limite, offset: args.desde });
        return {
          cuenta: account.slug,
          rentabilidad: { saludable_pct: settings.thresholds.healthyMarginPct, piso_pct: settings.thresholds.floorMarginPct },
          ejecucion_automatica: settings.autoApply,
          invitaciones_leidas: when(settings.sweptAt, account),
          totales: { productos: o.totals.products, con_ciclo_de_vida: o.totals.tagged, formas_de_cobro_adentro: o.totals.on, por_entrar: o.totals.planned, afuera: o.totals.out, no_se_pudo: o.totals.failed },
          encontrados: o.total,
          marcas: o.brands,
          productos: o.rows.map((r) => ({
            producto: r.name,
            marca: r.brand,
            publicacion: r.publicationId,
            etiquetas: tagsText(r.tags),
            objetivo: r.objective ? OBJECTIVE_LABEL[r.objective] : null,
            formas_de_cobro: r.options,
            adentro: r.on,
            por_entrar: r.planned,
            afuera: r.out,
            no_se_pudo: r.failed,
            proxima_franja: r.next ? `${r.next.name}, ${when(r.next.start, account)}` : null,
            almanaque_armado: when(r.plannedAt, account),
          })),
        };
      }
      const publicationId = await findPublication(ctx.db, account.id, args.publicacion);
      const productId = (await productOfPublication(ctx.db, account.id, publicationId))!;
      const grid = (await loadProductGrid(ctx.db, account.id, productId))!;
      const ids = grid.measures.flatMap((m) => m.options.map((o) => o.publicationId));
      const logs = await loadLog(ctx.db, { accountId: account.id, publicationIds: ids, limit: 20 });
      return {
        producto: grid.name,
        marca: grid.brand,
        etiquetas: tagsOut(grid.tags),
        puestas_a_mano: grid.manual.map((g) => keyOf(GROUP_IN, g) ?? g),
        por_que: grid.why,
        objetivo: grid.objective ? OBJECTIVE_LABEL[grid.objective] : 'Sin ciclo de vida: todavía no tiene almanaque.',
        rentabilidad: { saludable_pct: grid.thresholds.healthyMarginPct, piso_pct: grid.thresholds.floorMarginPct },
        ejecucion_automatica: grid.autoApply,
        almanaque_armado: when(grid.plannedAt, account),
        invitaciones_leidas: when(grid.invitationsAt, account),
        competidor_mas_barato: grid.competitor ? { precio: grid.competitor.price, de: grid.competitor.seller, relevado: grid.competitor.surveyedAt?.toISOString().slice(0, 10) ?? null } : null,
        medidas: grid.measures.map((m) => ({
          medida: m.measure,
          stock: m.stock,
          formas_de_cobro: m.options.map((o) => ({
            publicacion: o.externalId ?? o.publicationId,
            forma_de_cobro: o.plan === null ? o.planLabel : planLabel(o.plan),
            estado_en_el_canal: o.status,
            precio_publicado: o.listPrice,
            descuento_propio_hoy_pct: o.discountNow,
            rentabilidad_hoy_pct: round(o.marginNow),
            ...(o.cost === null ? { aviso: 'Sin costo cargado: no se puede sacar la rentabilidad.' } : {}),
            ...(o.excluded ? { prohibida: o.excludedWhy ?? true } : {}),
          })),
        })),
        franjas: grid.columns.map((c) => columnOut(grid, c, account, !args.solo_franjas)),
        ...(grid.columns.length === 0 ? { aviso: 'No tiene franjas ni invitaciones del canal. Las publicaciones nuevas o recreadas no reciben invitaciones a los eventos: si esperabas alguna, hay que decidirlo a mano.' } : {}),
        bitacora: logs.map((l) => ({ cuando: when(l.createdAt, account), publicacion: l.publication.externalId, que: l.text, ...(l.auto ? { lo_hizo: 'la app, por el almanaque' } : {}) })),
      };
    }),
});

const getSettings = defineTool({
  name: 'get_promotion_settings',
  section: 'promociones',
  title: 'Ver los ajustes de promociones',
  description:
    'Los ajustes de promociones de la cuenta: la rentabilidad saludable y el piso (sobre el costo, en %), si la app prende y apaga las ofertas sola siguiendo el almanaque (ejecucion_automatica), las reglas (la receta del almanaque de cada ciclo de vida, los números con los que la regla propone las etiquetas y los tiempos) y el calendario de eventos.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const s = await loadPromoSettings(ctx.db, account.id);
      const events = await listEvents(ctx.db, account.id, { from: new Date() });
      return {
        cuenta: account.slug,
        rentabilidad: { saludable_pct: s.thresholds.healthyMarginPct, piso_pct: s.thresholds.floorMarginPct },
        ejecucion_automatica: s.autoApply,
        reglas: s.rules,
        como_leer_las_reglas:
          'recipes: la receta de cada ciclo de vida (NEW nueva, GROWING en crecimiento, MATURE madurada, CLEARANCE a liquidar): base (descuento propio), baseMarginPct, baseSteps (a tantos días o menos del próximo evento, esa rentabilidad), events (always, with_sales, never), eventMarginPct, peaks (relámpago y oferta del día), peakMarginPct, volume (por cantidad). Una rentabilidad en null es la saludable. classify: los números de la regla que propone etiquetas (newDays, matureUnits90, matureGrowthPct, growingMinUnits90: con menos ventas que esas en 90 días queda sin ciclo de vida; clearanceAuto: si la regla propone a liquidar; clearanceDays, priceFightPct, competitorDays). timing: horizonDays, baseDays, pushStepPct, baseOverEventPct, stockMin, joinLeadDays, measureDays, reclassifyDays.',
        invitaciones_leidas: when(s.sweptAt, account),
        ultima_clasificacion: when(s.classifiedAt, account),
        calendario: events.map((e) => ({ evento: e.id, nombre: e.name, tipo: keyOf(TIER_IN, e.tier), desde: when(e.start, account), hasta: when(e.finish, account), texto_de_la_campana: e.match, notas: e.notes })),
      };
    }),
});

const updateSettings = defineTool({
  name: 'update_promotion_settings',
  section: 'promociones',
  title: 'Cambiar los ajustes de promociones',
  description: `Cambia los ajustes de promociones de la cuenta: solo lo que viene. saludable_pct y piso_pct son la rentabilidad sobre el costo: ninguna oferta entra si deja menos que el piso. ejecucion_automatica: true = la app prende y apaga sola las ofertas del almanaque con la lectura de cada hora; false = no hace nada sola y se aplica con apply_promotion_changes. reglas: solo las partes a cambiar, con la misma forma que devuelve get_promotion_settings. Los cambios valen desde el próximo armado del almanaque (generate_promotion_plan): lo que ya está prendido no se toca. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    saludable_pct: z.number().min(0).max(500).optional(),
    piso_pct: z.number().min(0).max(500).optional(),
    ejecucion_automatica: z.boolean().optional(),
    reglas: rulesPatchSchema.optional(),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const s = await savePromoSettings(ctx.db, { accountId: account.id, userId: ctx.userId, healthyMarginPct: args.saludable_pct, floorMarginPct: args.piso_pct, autoApply: args.ejecucion_automatica, rules: args.reglas });
      return { guardado: true, rentabilidad: { saludable_pct: s.thresholds.healthyMarginPct, piso_pct: s.thresholds.floorMarginPct }, ejecucion_automatica: s.autoApply, reglas: s.rules };
    }),
});

const setTags = defineTool({
  name: 'set_promotion_tags',
  section: 'promociones',
  title: 'Poner las etiquetas de promociones',
  description: `Pone o corrige a mano las etiquetas de promociones de unos productos: ciclo de vida (nueva, en_crecimiento, madurada, a_liquidar), competencia (pelea_por_precio, sin_competencia), en_catalogo, control_de_stock y prioridad (empujar, estacional). null saca la etiqueta. Solo cambia lo que viene. Control de stock y prioridad son solo a mano. Lo puesto a mano en ciclo de vida, competencia y en catálogo no lo pisa la regla; con soltar, esos grupos vuelven a quedar a cargo de la regla. Las etiquetas son del producto: valen para todas sus medidas y formas de cobro. Con control de stock, la medida que tiene poco stock no entra a ofertas nuevas, y no sale de las que ya está. Cambiar una etiqueta no cambia el almanaque hasta rearmarlo con generate_promotion_plan (con rearmar: true se rearma en la misma llamada). ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    ...productsArg,
    ciclo_de_vida: z.enum(['nueva', 'en_crecimiento', 'madurada', 'a_liquidar']).nullable().optional(),
    competencia: z.enum(['pelea_por_precio', 'sin_competencia']).nullable().optional(),
    en_catalogo: z.boolean().optional(),
    control_de_stock: z.boolean().optional(),
    prioridad: z.enum(['empujar', 'estacional']).nullable().optional(),
    soltar: z.array(z.enum(['ciclo_de_vida', 'competencia', 'en_catalogo'])).max(3).optional().describe('Estos grupos vuelven a quedar a cargo de la regla.'),
    rearmar: z.boolean().optional().describe('true = después rearma el almanaque de esos productos, de hoy en adelante.'),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const productIds = await resolveProducts(ctx, account, args);
      if (productIds.length === 0) throw new McpToolError('Ningún producto cumple lo pedido.');
      const changed = await setPromoTags(ctx.db, {
        accountId: account.id,
        productIds,
        userId: ctx.userId,
        change: {
          ...(args.ciclo_de_vida !== undefined ? { lifecycle: args.ciclo_de_vida === null ? null : (LIFECYCLE_IN[args.ciclo_de_vida] as Lifecycle) } : {}),
          ...(args.competencia !== undefined ? { competition: args.competencia === null ? null : (COMPETITION_IN[args.competencia] as Competition) } : {}),
          ...(args.en_catalogo !== undefined ? { inCatalog: args.en_catalogo } : {}),
          ...(args.control_de_stock !== undefined ? { stockControl: args.control_de_stock } : {}),
          ...(args.prioridad !== undefined ? { priority: args.prioridad === null ? null : (PRIORITY_IN[args.prioridad] as Priority) } : {}),
          ...(args.soltar ? { release: args.soltar.map((g) => GROUP_IN[g] as TagGroup) } : {}),
        },
      });
      const replanned = [];
      if (args.rearmar) {
        const started = Date.now();
        for (const productId of productIds) {
          if (Date.now() - started > BUDGET_MS) break;
          replanned.push(await generatePlan(ctx.db, { accountId: account.id, productId }));
        }
      }
      return {
        productos_cambiados: changed,
        ...(args.rearmar ? { almanaques_rearmados: replanned.length, ...(replanned.length < productIds.length ? { aviso: 'No entraron todos en esta vuelta: seguí con generate_promotion_plan.' } : {}) } : { como_sigue: 'Para que el almanaque tome el cambio, generate_promotion_plan.' }),
      };
    }),
});

const exclude = defineTool({
  name: 'exclude_from_promotions',
  section: 'promociones',
  title: 'Prohibir una forma de cobro en las promociones',
  description: `Decide a mano que unas formas de cobro (publicaciones, cada una por su código) no entren a ninguna oferta, o lo levanta. En la grilla quedan como "Afuera: prohibida", con el motivo. No las saca de las ofertas donde ya están: para eso, apply_promotion_changes con accion sacar. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(100).describe('Las formas de cobro: su id en la app, su código en el canal o su link. No se agranda a la familia.'),
    prohibir: z.boolean().describe('true = no entra a ninguna oferta. false = vuelve a decidirse con las reglas.'),
    motivo: z.string().max(300).optional(),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const ids: string[] = [];
      for (const ref of args.publicaciones) ids.push(await findPublication(ctx.db, account.id, ref));
      const n = await setOptionsExcluded(ctx.db, { accountId: account.id, publicationIds: ids, excluded: args.prohibir, why: args.motivo, userId: ctx.userId });
      // El almanaque de sus productos se vuelve a decidir con el cambio.
      const products = new Set<string>();
      for (const id of ids) {
        const productId = await productOfPublication(ctx.db, account.id, id);
        if (productId) products.add(productId);
      }
      for (const productId of products) await generatePlan(ctx.db, { accountId: account.id, productId });
      return { formas_de_cobro: n, prohibidas: args.prohibir };
    }),
});

const classify = defineTool({
  name: 'classify_promotions',
  section: 'promociones',
  title: 'Proponer las etiquetas de promociones',
  description: `La regla propone el ciclo de vida y la competencia de cada producto y explica por qué, con los números de las reglas de la cuenta (get_promotion_settings): la antigüedad de la publicación, las ventas de 90 y de 30 días, el stock y el precio del competidor más barato contra el sin cuotas. Con solo_mostrar (lo de siempre) no cambia nada: devuelve lo propuesto y cuáles cambiarían. Con solo_mostrar: false, lo guarda en los que no están puestos a mano y rearma el almanaque de los que cambiaron. "Sin competencia", control de stock y prioridad no los propone la regla: se ponen con set_promotion_tags. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    ...productsArg,
    solo_mostrar: z.boolean().optional().describe('Sin decir, true: solo muestra. false = guarda lo propuesto.'),
    solo_los_que_cambian: z.boolean().optional().describe('true = devuelve solo los productos a los que les cambiaría alguna etiqueta.'),
  }),
  readOnly: false,
  destructive: false,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const productIds = args.todos ? undefined : await resolveProducts(ctx, account, args);
      const apply = args.solo_mostrar === false;
      const r = await classifyAccount(ctx.db, { accountId: account.id, productIds, apply });
      let replanned = 0;
      if (apply) {
        const started = Date.now();
        for (const productId of r.changed) {
          if (Date.now() - started > BUDGET_MS) break;
          await generatePlan(ctx.db, { accountId: account.id, productId });
          replanned++;
        }
      }
      const shown = args.solo_los_que_cambian ? r.products.filter((p) => r.changed.includes(p.productId)) : r.products;
      return {
        productos: r.products.length,
        cambian: r.changed.length,
        guardado: apply,
        ...(apply ? { almanaques_rearmados: replanned } : {}),
        propuestas: shown.slice(0, 150).map((p) => ({
          producto: p.name,
          datos: { dias_publicada: p.facts.ageDays, vendidas_90_dias: p.facts.units90, vendidas_30_dias: p.facts.units30, stock: p.facts.stock, precio_sin_cuotas: p.facts.flatPrice, competidor_mas_barato: p.facts.competitorPrice },
          propone: classifiedText(p),
          cambia: r.changed.includes(p.productId),
        })),
        ...(shown.length > 150 ? { aviso: 'Hay más: pedilos por filtro.' } : {}),
      };
    }),
});

const generate = defineTool({
  name: 'generate_promotion_plan',
  section: 'promociones',
  title: 'Armar el almanaque de promociones',
  description: `Arma o rearma el almanaque de unos productos, de hoy en adelante: las franjas que les tocan por sus etiquetas (la receta de su ciclo de vida), el calendario de eventos y las campañas a las que el canal los invita, y decide para cada forma de cobro de cada medida si entra, a qué precio y con qué rentabilidad, o por qué queda afuera. Las seis formas de cobro siguen el mismo almanaque; la que no puede entrar a una campaña queda afuera de esa, con el motivo. Lo que ya empezó, lo que ya se mandó al canal y lo decidido a mano no se toca. No sube nada al canal: lo que toca prender se ve y se manda con apply_promotion_changes, o lo hace la app sola si la cuenta tiene la ejecución automática. Con solo_mostrar, cuenta lo que cambiaría sin guardar. Un producto sin ciclo de vida no lleva almanaque.`,
  input: z.object({ cuenta: accountArg, ...productsArg, solo_mostrar: z.boolean().optional() }),
  readOnly: false,
  destructive: false,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const productIds = await resolveProducts(ctx, account, args);
      const started = Date.now();
      const done = [];
      const left: string[] = [];
      for (const productId of productIds) {
        if (Date.now() - started > BUDGET_MS) {
          left.push(productId);
          continue;
        }
        done.push(await generatePlan(ctx.db, { accountId: account.id, productId, preview: args.solo_mostrar === true }));
      }
      return {
        guardado: args.solo_mostrar !== true,
        productos: done.map((r) => ({ producto: r.name, ...(r.skipped ? { no_se_armo: r.skipped } : { franjas: r.slots, nuevas: r.created, cambiadas: r.updated, sacadas: r.removed }) })),
        ...(left.length > 0 ? { quedan: left.length, aviso: 'No entraron todos en esta vuelta: volvé a llamar con el mismo pedido; los que ya se armaron no cambian.' } : {}),
      };
    }),
});

const review = defineTool({
  name: 'review_invitations',
  section: 'promociones',
  title: 'Leer las invitaciones del canal',
  description:
    'Lee del canal las invitaciones a campañas y las compara con el almanaque y con la rentabilidad de cada forma de cobro. Con publicaciones: relee esos productos en el momento y devuelve, por cada campaña, cuántas formas de cobro entran, cuántas al tope y cuántas quedan afuera y por qué. Sin publicaciones: sigue la lectura de toda la cuenta, campaña por campaña, hasta donde alcanza el tiempo (si queda, falta: true y hay que volver a llamar); con desde_cero empieza una lectura nueva. Devuelve también las campañas de la cuenta con cuántas publicaciones invita cada una, y los productos con publicaciones activas a los que el canal no invita a nada: las publicaciones nuevas o recreadas no reciben invitaciones a los eventos y eso se decide a mano. Solo lee del canal: no suma ni saca a nadie.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(20).optional().describe('Una publicación de cada producto a releer ahora.'),
    desde_cero: z.boolean().optional(),
  }),
  readOnly: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      if (args.publicaciones) {
        const out = [];
        for (const ref of args.publicaciones) {
          const productId = (await productOfPublication(ctx.db, account.id, await findPublication(ctx.db, account.id, ref)))!;
          const before = (await loadProductGrid(ctx.db, account.id, productId))!;
          const ids = before.measures.flatMap((m) => m.options.filter((o) => o.externalId).map((o) => o.publicationId));
          const r = await refreshPublications(ctx.db, { accountId: account.id, publicationIds: ids });
          const grid = (await loadProductGrid(ctx.db, account.id, productId))!;
          out.push({
            producto: grid.name,
            publicaciones_leidas: r.read,
            campanas: grid.columns.filter((c) => c.group).map((c) => columnOut(grid, c, account, true)),
            ...(grid.columns.filter((c) => c.group).length === 0 ? { aviso: 'El canal no lo invita a ninguna campaña.' } : {}),
          });
        }
        return { productos: out };
      }
      const sweep = await sweepInvitations(ctx.db, { accountId: account.id, budgetMs: BUDGET_MS, restart: args.desde_cero });
      const groups = await ctx.db.channelPromotionItem.groupBy({ by: ['group', 'name', 'kind', 'status'], where: { publication: { product: { accountId: account.id } } }, _count: { _all: true }, _min: { start: true }, _max: { finish: true } });
      const byGroup = new Map<string, { campana: string; nombre: string | null; tipo: string; desde: string | null; hasta: string | null; invitadas: number; anotadas: number; adentro: number }>();
      for (const g of groups) {
        const row = byGroup.get(g.group) ?? { campana: g.group, nombre: g.name, tipo: g.kind, desde: when(g._min.start, account), hasta: when(g._max.finish, account), invitadas: 0, anotadas: 0, adentro: 0 };
        if (g.status === 'invited') row.invitadas += g._count._all;
        else if (g.status === 'scheduled') row.anotadas += g._count._all;
        else row.adentro += g._count._all;
        byGroup.set(g.group, row);
      }
      const overview = await loadOverview(ctx.db, account.id, { limit: 500 });
      const invited = new Set((await ctx.db.channelPromotionItem.findMany({ where: { publication: { product: { accountId: account.id } } }, distinct: ['publicationId'], select: { publication: { select: { productId: true } } } })).map((r) => r.publication.productId));
      const without = overview.rows.filter((r) => !invited.has(r.productId));
      const settings = await loadPromoSettings(ctx.db, account.id);
      return {
        lectura: { falta: sweep.pending, termino: sweep.finished, campanas_leidas: sweep.promotions, paginas: sweep.pages, publicaciones_guardadas: sweep.items, ...(sweep.error ? { error: sweep.error } : {}) },
        ultima_lectura_completa: when(settings.sweptAt, account),
        campanas: [...byGroup.values()],
        sin_invitaciones: { productos: without.length, lista: without.slice(0, 60).map((r) => ({ producto: r.name, publicacion: r.publicationId, etiquetas: tagsText(r.tags) })) },
        como_sigue: sweep.pending ? 'Falta leer: volvé a llamar.' : 'Para ver cada forma de cobro de un producto, get_promotions con una publicación suya.',
      };
    }),
});

const actionOut = (a: DueAction | AppliedAction) => ({
  casillero: a.itemId,
  producto: a.productName,
  publicacion: a.externalId ?? a.publicationId,
  que: a.action === 'ON' ? 'prender' : 'apagar',
  oferta: a.kind === 'OWN_DISCOUNT' ? `Descuento propio${a.action === 'ON' && a.discountPct !== null ? ` de ${a.discountPct} %` : ''}` : a.name,
  capa: LAYER_LABEL[a.layer as keyof typeof LAYER_LABEL] ?? a.layer,
  ...(a.action === 'ON' && a.price !== null ? { precio_para_el_comprador: a.price } : {}),
  ...(a.action === 'ON' && a.marginPct !== null ? { rentabilidad_pct: a.marginPct } : {}),
  ...(a.action === 'ON' && a.capped ? { al_tope: true } : {}),
  ...(a.stock ? { unidades_reservadas: a.stock } : {}),
  ...('ok' in a ? { resultado: a.ok ? 'hecho' : 'no_se_pudo', ...(a.message ? { motivo: a.message } : {}) } : {}),
});

const applyChanges = defineTool({
  name: 'apply_promotion_changes',
  section: ['promociones', 'subir'],
  title: 'Prender y apagar ofertas',
  description: `Prende y apaga ofertas en el canal, por forma de cobro, cada una con su código. Sin confirmar no hace nada: devuelve la vista previa, con cada cambio, el precio para el comprador y la rentabilidad que deja. accion lo_que_toca: lo que el almanaque marca para hoy (las bases que empiezan o terminan, las campañas a las que ya toca entrar); con productos se limita a esos. prender: los casilleros elegidos que están por entrar, aunque todavía no sea su fecha. sacar: saca los casilleros elegidos de su oferta (si están en el canal, los saca de ahí) y quedan como sacados a mano: el almanaque no los vuelve a meter. volver_a_decidir: deshace lo sacado a mano o lo que no se pudo, y se decide de nuevo con las reglas. Los casilleros son los casillero de get_promotions. Antes de prender, la app vuelve a sacar la rentabilidad con el costo del momento: si ya no deja el piso, no entra y lo dice. Una oferta del día o una relámpago que ya empezó no se puede sacar: solo pausando la publicación. Lo que el canal no acepta se reintenta y queda en la bitácora. Manda solo lo de esta llamada: lo que haya en Por subir no se toca. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    accion: z.enum(['lo_que_toca', 'prender', 'sacar', 'volver_a_decidir']),
    casilleros: z.array(z.string().min(1)).min(1).max(200).optional().describe('Para prender, sacar y volver_a_decidir: los casillero de get_promotions.'),
    publicaciones: z.array(z.string().min(1)).min(1).max(100).optional().describe('Para lo_que_toca: una publicación de cada producto, para limitar a esos.'),
    motivo: z.string().max(200).optional().describe('Para sacar: por qué, queda en la grilla y en la bitácora.'),
    confirmar: z.boolean().optional().describe('true = hacerlo. Sin decirlo, solo muestra la vista previa.'),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const settings = await loadPromoSettings(ctx.db, account.id);
      const needItems = args.accion !== 'lo_que_toca';
      if (needItems && !args.casilleros) throw new McpToolError('Pasá los casilleros: son los casillero de get_promotions.');
      const productIds = args.accion === 'lo_que_toca' && args.publicaciones ? await resolveProducts(ctx, account, { publicaciones: args.publicaciones }) : undefined;
      if (args.accion === 'volver_a_decidir') {
        if (!args.confirmar) return { vista_previa: true, casilleros: args.casilleros!.length, que: 'Se deshace lo sacado a mano o lo que no se pudo y se decide de nuevo con las reglas.' };
        return { vueltos_a_decidir: await putBack(ctx.db, { accountId: account.id, itemIds: args.casilleros! }) };
      }
      if (args.accion === 'sacar') {
        if (!args.confirmar) {
          const items = await ctx.db.promotionSlotItem.findMany({ where: { id: { in: args.casilleros! }, slot: { accountId: account.id } }, include: { slot: { select: { name: true } }, publication: { select: { externalId: true } } } });
          return { vista_previa: true, se_sacan: items.map((i) => ({ casillero: i.id, publicacion: i.publication.externalId, oferta: i.slot.name, hoy: i.state === 'ON' || i.state === 'SCHEDULED' ? 'está en el canal: se saca de ahí' : 'todavía no entró: no va a entrar' })) };
        }
        const out = await takeOut(ctx.db, { accountId: account.id, itemIds: args.casilleros!, why: args.motivo, userId: ctx.userId });
        return { sacados: out.filter((o) => o.ok).length, no_se_pudo: out.filter((o) => !o.ok).length, detalle: out.map(actionOut) };
      }
      const scope = { accountId: account.id, productIds, itemIds: args.accion === 'prender' ? args.casilleros : undefined, force: args.accion === 'prender' };
      if (!args.confirmar) {
        const due = await dueActions(ctx.db, { ...scope, joinLeadDays: settings.rules.timing.joinLeadDays });
        return {
          vista_previa: true,
          cambios: due.length,
          prender: due.filter((d) => d.action === 'ON').length,
          apagar: due.filter((d) => d.action === 'OFF').length,
          detalle: due.slice(0, 200).map(actionOut),
          ...(due.length > 200 ? { aviso: 'Hay más de 200: se muestran las primeras.' } : {}),
          como_sigue: due.length > 0 ? 'Mostrale esto a la persona y, con su confirmación, volvé a llamar con confirmar: true.' : 'No hay nada para hacer ahora.',
        };
      }
      const r = await applyDue(ctx.db, { ...scope, auto: false, userId: ctx.userId, budgetMs: BUDGET_MS });
      return {
        hechos: r.done.filter((d) => d.ok).length,
        no_se_pudo: r.done.filter((d) => !d.ok).length,
        detalle: r.done.map(actionOut),
        ...(r.skipped.length > 0 ? { no_entraron: r.skipped.map((s) => ({ publicacion: s.externalId, oferta: s.name, motivo: s.why })) } : {}),
        ...(r.pending > 0 ? { quedan: r.pending, aviso: 'No entraron todos en esta vuelta: volvé a llamar con el mismo pedido.' } : {}),
      };
    }),
});

const setSlot = defineTool({
  name: 'set_promotion_slot',
  section: 'promociones',
  title: 'Poner o cambiar una franja del almanaque a mano',
  description: `Lo que se decide a mano en el almanaque de un producto, que el almanaque después respeta. accion poner: una franja nueva; con campana (el campana de una franja canal_sin_franja de get_promotions) es de esa campaña del canal, y sin campana es un descuento propio entre desde y hasta. cambiar: cambia las fechas o la rentabilidad buscada de una franja (franja), que pasa a ser a mano. no_va: decide que una franja no va; queda guardada para que el almanaque no la vuelva a armar, y con sacar_ahora además saca del canal lo que ya estaba prendido. vuelve: deshace no_va. La rentabilidad buscada nunca puede ser menor que el piso. No sube nada al canal salvo sacar_ahora: lo demás se manda con apply_promotion_changes. ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    publicacion: z.string().min(1).describe('Una publicación del producto.'),
    accion: z.enum(['poner', 'cambiar', 'no_va', 'vuelve']),
    franja: z.string().optional().describe('Para cambiar, no_va y vuelve: el franja de get_promotions.'),
    campana: z.string().max(200).optional().describe('Para poner: el campana de una campaña del canal.'),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional().describe('El día en que empieza, como 2026-12-01, o con hora 2026-12-01T08:00, en la hora de la cuenta.'),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional().describe('El día en que termina (hasta el primer minuto de ese día), o con hora.'),
    rentabilidad_pct: z.number().min(0).max(500).optional().describe('La rentabilidad sobre el costo que busca la franja. Sin decir, la saludable.'),
    nombre: z.string().max(120).optional(),
    motivo: z.string().max(300).optional(),
    sacar_ahora: z.boolean().optional(),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const productId = (await productOfPublication(ctx.db, account.id, await findPublication(ctx.db, account.id, args.publicacion)))!;
      const date = (v: string | undefined) => {
        if (!v) return undefined;
        const d = fromZonedInput(v.includes('T') ? v : `${v}T00:00`, account.timezone);
        if (!d) throw new McpToolError(`No se entiende la fecha ${v}.`);
        return d;
      };
      if (args.accion === 'no_va' || args.accion === 'vuelve') {
        if (!args.franja) throw new McpToolError('Pasá la franja.');
        const r = await cancelSlot(ctx.db, { accountId: account.id, slotId: args.franja, cancelled: args.accion === 'no_va', takeOutNow: args.sacar_ahora, why: args.motivo, userId: ctx.userId });
        return { franja: args.franja, no_va: args.accion === 'no_va', ...(r.takenOut.length > 0 ? { sacados_del_canal: r.takenOut.map(actionOut) } : {}) };
      }
      if (args.accion === 'cambiar' && !args.franja) throw new McpToolError('Pasá la franja a cambiar.');
      const id = await saveManualSlot(ctx.db, {
        accountId: account.id,
        input: { productId, slotId: args.accion === 'cambiar' ? args.franja : undefined, group: args.campana ?? null, start: date(args.desde), finish: date(args.hasta), targetMarginPct: args.rentabilidad_pct, name: args.nombre, note: args.motivo },
      });
      const grid = (await loadProductGrid(ctx.db, account.id, productId))!;
      const column = grid.columns.find((c) => c.slotId === id);
      return { guardada: true, ...(column ? columnOut(grid, column, account, true) : { franja: id }), como_sigue: 'Para mandarla al canal, apply_promotion_changes.' };
    }),
});

const measure = defineTool({
  name: 'measure_promotion_result',
  section: 'promociones',
  title: 'Medir el resultado de una oferta',
  description:
    'Compara el antes y el después de las ofertas que la app prendió: las ventas, las visitas, la conversión y la posición en búsquedas de los días de antes contra los de después (los días son measureDays de las reglas, 7 de partida), por forma de cobro, y lo escribe en la bitácora. La app lo hace sola cuando a cada oferta le llega el día. Con publicaciones, mide ahora las ofertas prendidas de esas formas de cobro aunque no haya pasado el plazo (los días que falten cuentan como sin ventas), y devuelve su bitácora. Sin publicaciones, mide las que ya cumplieron el plazo en toda la cuenta. La posición sale de las mediciones guardadas: para tener una nueva, measure_search_positions.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(50).optional().describe('Las formas de cobro, cada una por su código.'),
  }),
  readOnly: false,
  destructive: false,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      let itemIds: string[] | undefined;
      const ids: string[] = [];
      if (args.publicaciones) {
        for (const ref of args.publicaciones) ids.push(await findPublication(ctx.db, account.id, ref));
        itemIds = (await ctx.db.promotionSlotItem.findMany({ where: { publicationId: { in: ids }, appliedAt: { not: null }, slot: { accountId: account.id } }, orderBy: { appliedAt: 'desc' }, take: 50, select: { id: true } })).map((i) => i.id);
        if (itemIds.length === 0) return { medidas: 0, aviso: 'Esas publicaciones no tienen ofertas prendidas por la app para medir.' };
      }
      const r = await measureDue(ctx.db, { accountId: account.id, budgetMs: BUDGET_MS, itemIds, userId: ctx.userId });
      const codes = new Map((await ctx.db.publication.findMany({ where: { id: { in: r.measured.map((m) => m.publicationId) } }, select: { id: true, externalId: true } })).map((p) => [p.id, p.externalId]));
      const side = (w: { visits: number | null; units: number; conversionPct: number | null; position: number | null }) => ({ ventas: w.units, visitas: w.visits, conversion_pct: w.conversionPct, posicion: w.position });
      return {
        medidas: r.measured.length,
        ...(r.pending ? { falta: true } : {}),
        resultados: r.measured.map((m) => ({ publicacion: codes.get(m.publicationId) ?? m.publicationId, oferta: m.name, desde: m.measurement.from, dias: m.measurement.days, antes: side(m.measurement.before), despues: side(m.measurement.after) })),
        ...(ids.length > 0 ? { bitacora: (await loadLog(ctx.db, { accountId: account.id, publicationIds: ids, limit: 40 })).map((l) => ({ cuando: when(l.createdAt, account), publicacion: l.publication.externalId, que: l.text })) } : {}),
      };
    }),
});

const calendar = defineTool({
  name: 'manage_event_calendar',
  section: 'promociones',
  title: 'Cargar el calendario de eventos',
  description: `El calendario de eventos de promociones de la cuenta, que se carga con anticipación: los del canal (t1: Hot Sale, Black Friday, Cyber Monday; t2; potencia_tus_ventas; ofertas_compartidas) y las fechas propias del rubro (fecha_propia). accion listar los devuelve; guardar crea uno o, con evento, cambia ese; borrar lo saca. El almanaque reconoce la campaña del canal de cada evento por texto_de_la_campana (un texto que aparezca en el nombre de la campaña) o por las fechas, y escalona la capa base hacia el próximo evento. Las fechas propias valen para los productos con prioridad estacional y van con el descuento propio. Cambiar el calendario no cambia el almanaque hasta rearmarlo (generate_promotion_plan). ${CONFIRM}`,
  input: z.object({
    cuenta: accountArg,
    accion: z.enum(['listar', 'guardar', 'borrar']),
    evento: z.string().optional().describe('Para cambiar o borrar uno: su evento.'),
    nombre: z.string().max(120).optional(),
    tipo: z.enum(['t1', 't2', 'potencia_tus_ventas', 'ofertas_compartidas', 'fecha_propia']).optional(),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('El primer día, como 2027-05-10.'),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('El último día, incluido.'),
    texto_de_la_campana: z.string().max(120).nullable().optional(),
    notas: z.string().max(500).nullable().optional(),
    tambien_pasados: z.boolean().optional().describe('Para listar: true = también los que ya terminaron.'),
  }),
  readOnly: false,
  destructive: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const out = (e: Awaited<ReturnType<typeof listEvents>>[number]) => ({ evento: e.id, nombre: e.name, tipo: keyOf(TIER_IN, e.tier), que_es: EVENT_TIER_LABEL[e.tier as (typeof EVENT_TIERS)[number]] ?? e.tier, desde: when(e.start, account), hasta: when(e.finish, account), texto_de_la_campana: e.match, notas: e.notes });
      if (args.accion === 'listar') return { calendario: (await listEvents(ctx.db, account.id, args.tambien_pasados ? {} : { from: new Date() })).map(out) };
      if (args.accion === 'borrar') {
        if (!args.evento) throw new McpToolError('Pasá el evento a borrar.');
        await deleteEvent(ctx.db, account.id, args.evento);
        return { borrado: true, evento: args.evento };
      }
      const current = args.evento ? (await listEvents(ctx.db, account.id)).find((e) => e.id === args.evento) : null;
      if (args.evento && !current) throw new McpToolError('Ese evento ya no está en el calendario.');
      const day = (v: string, endOfDay: boolean) => {
        const d = fromZonedInput(`${v}T00:00`, account.timezone);
        if (!d) throw new McpToolError(`No se entiende la fecha ${v}.`);
        return endOfDay ? new Date(d.getTime() + 86_400_000) : d;
      };
      if (!current && (!args.nombre || !args.tipo || !args.desde || !args.hasta)) throw new McpToolError('Para un evento nuevo hacen falta nombre, tipo, desde y hasta.');
      const saved = await saveEvent(ctx.db, account.id, {
        id: current?.id,
        name: args.nombre ?? current!.name,
        tier: args.tipo ? TIER_IN[args.tipo] : (current!.tier as (typeof EVENT_TIERS)[number]),
        start: args.desde ? day(args.desde, false) : current!.start,
        finish: args.hasta ? day(args.hasta, true) : current!.finish,
        match: args.texto_de_la_campana !== undefined ? args.texto_de_la_campana : current?.match,
        notes: args.notas !== undefined ? args.notas : current?.notes,
      });
      return { guardado: true, ...out(saved), como_sigue: 'Para que el almanaque lo tome, generate_promotion_plan.' };
    }),
});

const refreshCompetitors = defineTool({
  name: 'refresh_competitors',
  section: 'promociones',
  title: 'Ver qué competencia hay que volver a relevar',
  description:
    'La lista de productos cuya tabla de competencia hay que actualizar, para hacerlo de forma ordenada: los que no tienen ningún competidor cargado y los que tienen el precio relevado hace más días que competitorDays de las reglas (14 de partida), primero los que pelean por precio. De cada uno devuelve una publicación suya, sus competidores con el link, el precio guardado y cuándo se relevó. Con eso, mirá cada link, tomá el precio de hoy, si tiene oferta prendida y las cuotas, y guardalo con save_competitors (que reemplaza la lista entera: mandá todos, no solo los que cambiaron). Después, classify_promotions vuelve a proponer quién pelea por precio. Esta herramienta solo lee.',
  input: z.object({ cuenta: accountArg, limite: z.number().int().min(1).max(100).optional(), solo_pelea_por_precio: z.boolean().optional() }),
  readOnly: true,
  run: (ctx, args) =>
    run(async () => {
      const account = await resolveAccount(ctx, args.cuenta);
      const settings = await loadPromoSettings(ctx.db, account.id);
      const days = settings.rules.classify.competitorDays;
      const overview = await loadOverview(ctx.db, account.id, { limit: 500, ...(args.solo_pelea_por_precio ? { competition: 'PRICE_FIGHT' as const } : {}) });
      // La competencia de todos en una sola consulta: la guardada en el producto y la guardada en sus publicaciones.
      const productIds = overview.rows.map((r) => r.productId);
      const pubs = await ctx.db.publication.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true } });
      const productOf = new Map(pubs.map((p) => [p.id, p.productId]));
      const all = await ctx.db.competitorListing.findMany({
        where: { OR: [{ productId: { in: productIds } }, { publicationId: { in: pubs.map((p) => p.id) } }] },
        orderBy: { position: 'asc' },
        select: { productId: true, publicationId: true, title: true, sellerName: true, brand: true, url: true, listPrice: true, discountPct: true, installments: true, surveyedAt: true },
      });
      const byProduct = new Map<string, typeof all>();
      for (const c of all) {
        const owner = c.productId ?? (c.publicationId ? productOf.get(c.publicationId) : undefined);
        if (owner) byProduct.set(owner, [...(byProduct.get(owner) ?? []), c]);
      }
      const now = Date.now();
      const rows = [];
      for (const r of overview.rows) {
        const listed = byProduct.get(r.productId) ?? [];
        const oldest = listed.map((c) => c.surveyedAt?.getTime() ?? 0).sort((a, b) => a - b)[0];
        const age = listed.length === 0 ? null : Math.floor((now - (oldest ?? 0)) / 86_400_000);
        if (listed.length > 0 && age !== null && age < days && listed.every((c) => c.listPrice !== null)) continue;
        rows.push({
          producto: r.name,
          marca: r.brand,
          publicacion: r.publicationId,
          etiquetas: tagsText(r.tags),
          pelea: r.tags.competition === 'PRICE_FIGHT',
          por_que: listed.length === 0 ? 'No tiene competidores cargados.' : listed.some((c) => c.listPrice === null) ? 'Tiene competidores sin precio.' : `El precio más viejo se relevó hace ${age} días.`,
          competidores: listed.map((c) => ({ vendedor: c.sellerName ?? c.title, marca: c.brand, link: c.url, precio: c.listPrice === null ? null : Number(c.listPrice), descuento_pct: Number(c.discountPct ?? 0), cuotas: c.installments, relevado: c.surveyedAt?.toISOString().slice(0, 10) ?? null })),
        });
      }
      rows.sort((a, b) => Number(b.pelea) - Number(a.pelea));
      const limit = args.limite ?? 30;
      return { cada_cuantos_dias: days, para_actualizar: rows.length, productos: rows.slice(0, limit).map((row) => ({ ...row, pelea: undefined })), ...(rows.length > limit ? { aviso: `Hay ${rows.length - limit} más.` } : {}) };
    }),
});

export const PROMO_TOOLS = [getPromotions, getSettings, updateSettings, setTags, exclude, classify, generate, review, applyChanges, setSlot, measure, calendar, refreshCompetitors];
