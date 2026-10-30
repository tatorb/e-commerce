import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import type { FaceField } from '@/domain/channel-sync';
import { measuresText } from '@/domain/costs';
import {
  installmentCostPct,
  isInstallmentPlan,
  LOW_INTEREST_PLAN,
  marginLevel,
  marginOf,
  planLabel,
  PRICING_KEYS,
  PRICING_LABEL,
  references,
  resolvePricing,
  simulate,
  type InstallmentPlan,
  type MarginLevel,
  type PricingKey,
  type PricingParams,
} from '@/domain/pricing';
import { campaignOutcomeState, campaignPrice, campaignPriceProblem, campaignRevenue, combinedBounds, discountOptions, type CampaignOutcomeState } from '@/domain/promotions';
import { logActivity } from '@/lib/activity';
import { readPromotions, type PromotionsResult } from '@/lib/channel-promotions';
import { CampaignError, campaignText, queueCampaign, type CampaignOutcome } from '@/lib/channel-campaigns';
import { pushDrafts, PushError } from '@/lib/channel-push';
import { loadPricingSettings, loadPriceStep, PricingError, savePriceDecision, savePricingSettings, type PriceGroupData } from '@/lib/pricing';
import { listToPush } from '@/lib/queries/sync';
import { McpToolError, accountArg, defineTool, findPublication, publicationArg, resolveAccount, resolvePublication, type McpContext } from './tool';

// El precio desde Claude: lo mismo que el paso Precio y Ajustes > Precios, con
// los mismos permisos. Guardar un precio lo deja en Por subir, como la
// pantalla; push_prices lo manda al canal como el botón de Por subir, pero
// solo el precio, las cuotas y el descuento.

/** Cómo se llama cada costo del precio para Claude, en lo que lee y en lo que manda. */
export const PRICING_NAME: Record<PricingKey, string> = {
  channelFeePct: 'cargo_del_canal_pct',
  taxesPct: 'impuestos_pct',
  vatRatePct: 'iva_pct',
  installmentsLowPct: 'cuota_promocionada_pct',
  installments3Pct: 'cuotas_3_pct',
  installments6Pct: 'cuotas_6_pct',
  installments9Pct: 'cuotas_9_pct',
  installments12Pct: 'cuotas_12_pct',
  adsPct: 'publicidad_pct',
  returnsPct: 'devoluciones_pct',
  shipping: 'envio',
  packaging: 'embalaje',
  minMarginPct: 'margen_minimo_pct',
  targetMarginPct: 'margen_objetivo_pct',
};

const OPTIONAL: PricingKey[] = ['installmentsLowPct', 'installments3Pct', 'installments6Pct', 'installments9Pct', 'installments12Pct'];

/** Los costos como los ve Claude, con su nombre. Null en un plan de cuotas es sin cargar. */
export function pricingForClaude(values: Partial<PricingParams>): Record<string, number | null> {
  return Object.fromEntries(PRICING_KEYS.filter((k) => k in values).map((k) => [PRICING_NAME[k], values[k] as number | null]));
}

/** Los costos que manda Claude: cada uno opcional; null lo vuelve al de abajo (en un producto, al de la cuenta). */
const pricingArgs = z
  .object(
    Object.fromEntries(
      PRICING_KEYS.map((k) => [
        PRICING_NAME[k],
        z
          .number()
          .min(0)
          .max(k === 'shipping' || k === 'packaging' ? 100_000_000 : k === 'minMarginPct' || k === 'targetMarginPct' ? 1000 : 99)
          .nullable()
          .optional()
          .describe(`${PRICING_LABEL[k]}${k === 'shipping' || k === 'packaging' ? ', en pesos' : ', en %'}.`),
      ]),
    ) as Record<string, z.ZodOptional<z.ZodNullable<z.ZodNumber>>>,
  )
  .strict();

/** Lo que mandó Claude, por clave de la app. undefined: no se tocó; null: se borra. */
function pricingFrom(args: Record<string, number | null | undefined> | undefined): Partial<Record<PricingKey, number | null>> {
  const out: Partial<Record<PricingKey, number | null>> = {};
  for (const k of PRICING_KEYS) {
    const v = args?.[PRICING_NAME[k]];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Junta lo que había con lo que cambia: null borra, salvo un plan de cuotas en la cuenta, que queda sin cargar. */
function merged(before: Partial<PricingParams>, changes: Partial<Record<PricingKey, number | null>>, keepNull: boolean): Partial<PricingParams> {
  const out: Partial<Record<PricingKey, number | null>> = { ...before };
  for (const [k, v] of Object.entries(changes) as [PricingKey, number | null][]) {
    if (v === null && !(keepNull && OPTIONAL.includes(k))) delete out[k];
    else out[k] = v;
  }
  if (out.minMarginPct !== undefined && out.targetMarginPct !== undefined && (out.targetMarginPct as number) < (out.minMarginPct as number)) {
    throw new McpToolError('El margen objetivo no puede ser menor que el mínimo.');
  }
  return out as Partial<PricingParams>;
}

const LEVEL_TEXT: Record<MarginLevel, string> = { target: 'en el objetivo o arriba', between: 'entre el mínimo y el objetivo', below: 'debajo del mínimo' };

const round = (n: number) => Math.round(n * 100) / 100;

/** El último precio guardado, como lo ve Claude. */
export function decisionForClaude(d: {
  listPrice: number;
  discountPct: number;
  installments: number;
  finalPrice: number;
  marginPct: number;
  minMarginPct: number;
  belowMinConfirmed: boolean;
  decidedAt: Date;
  decidedBy?: string | null;
}) {
  return {
    precio_publicado: d.listPrice,
    descuento_pct: d.discountPct,
    cuotas: planLabel(d.installments),
    precio_final: d.finalPrice,
    margen_pct: d.marginPct,
    margen_minimo_pct: d.minMarginPct,
    ...(d.belowMinConfirmed ? { se_confirmo_debajo_del_minimo: true } : {}),
    fecha: d.decidedAt.toISOString(),
    ...(d.decidedBy ? { quien: d.decidedBy } : {}),
  };
}

/** Las cuotas como las manda Claude. */
const PLAN_ARG: Record<string, InstallmentPlan> = { sin_cuotas: 0, promocionada: LOW_INTEREST_PLAN, '3': 3, '6': 6, '9': 9, '12': 12 };
const planName = (plan: number) => Object.entries(PLAN_ARG).find(([, p]) => p === plan)?.[0] ?? 'sin_cuotas';

/** Una pestaña del paso Precio, como la ve Claude: con el margen de lo que tiene hoy. */
function groupForClaude(g: PriceGroupData, params: PricingParams, ref: (id: string) => string) {
  const plan: InstallmentPlan = g.installments !== null && isInstallmentPlan(g.installments) ? g.installments : 0;
  const discount = g.discount ?? 0;
  const now =
    g.cost !== null && g.price !== null
      ? (() => {
          const s = simulate({ listPrice: g.price, discountPct: discount, plan, cost: g.cost, params });
          return {
            precio_final: round(s.finalPrice),
            margen_pct: round(s.marginPct),
            nivel: LEVEL_TEXT[marginLevel(s.marginPct, params)],
            ganancia_por_venta: round(s.profit),
            ...(installmentCostPct(params, plan) === null ? { aviso: `${planLabel(plan)} no tiene el costo cargado: no se puede guardar así.` } : {}),
          };
        })()
      : null;
  const refs = g.cost !== null ? references(g.price ?? 0, g.cost, params) : null;
  return {
    publicacion_para_guardar: ref(g.anchorId),
    publicaciones: g.publicationIds.map(ref),
    ...(g.measures.length > 0 ? { medidas: g.measures } : {}),
    costo_de_reposicion_sin_iva: g.cost,
    de_donde_sale_el_costo: g.cost !== null ? g.costNote : null,
    ...(g.missing.length > 0 && g.measures.length > 0 ? { falta_el_costo_de: g.missing } : {}),
    hoy: {
      precio_publicado: g.price,
      descuento_pct: discount,
      cuotas: planName(plan),
      ...(now ? now : {}),
      ...(g.pricesDiffer ? { aviso_precios: `Hoy ${measuresText(g.measures)} tienen precios distintos: al guardar quedan todas con el mismo.` } : {}),
    },
    en_el_canal: { precio: g.channelPrice, descuento_pct: g.channelDiscount, cuotas: g.channelInstallments === null ? null : planName(g.channelInstallments) },
    precio_piso_sin_cuotas_ni_descuento: refs?.floor != null ? Math.ceil(refs.floor) : null,
    precio_objetivo_sin_cuotas_ni_descuento: refs?.target != null ? Math.ceil(refs.target) : null,
    ultimo_guardado: g.decision ? decisionForClaude(g.decision) : null,
  };
}

const CAMPAIGN_STATUS = { invited: 'la_invitan', scheduled: 'programada', active: 'esta_adentro' } as const;

/** Lo que el canal deja hacer hoy con el descuento de una pestaña, como lo ve Claude. */
function promotionsForClaude(r: PromotionsResult, listPrice: number | null, range: { min: number; max: number } | null) {
  if (!r.ok) return { no_se_pudo_consultar: r.error };
  if (r.read.length === 0) return { aviso: `Todavía no está publicada en ${r.channelName}: se consulta cuando esté.` };
  const bounds = combinedBounds(r.read.map((x) => x.promotions.discount));
  const options = discountOptions(listPrice ?? 0, bounds, range);
  const current = r.read.map((x) => x.promotions.current).find(Boolean) ?? null;
  return {
    descuento_propio: bounds
      ? {
          se_puede: true,
          precio_con_descuento_desde: bounds.minPrice,
          precio_con_descuento_hasta: bounds.maxPrice,
          precio_con_descuento_sugerido: bounds.suggestedPrice,
          ...(listPrice
            ? {
                sobre_el_precio_publicado: listPrice,
                descuento_pct_mas_chico_que_acepta: options.smallest,
                descuento_pct_mas_grande_que_acepta: options.largest,
                descuento_pct_sugerido: options.suggested,
              }
            : {}),
        }
      : { se_puede: false },
    ...(current ? { descuento_puesto: { precio_para_el_comprador: current.price, programado: current.scheduled } } : {}),
    campanas: r.read.flatMap((x) =>
      x.promotions.campaigns.map((c) => {
        const queued = r.pending.find((q) => q.publicationId === x.publicationId && q.ref === c.ref);
        return {
          publicacion: x.externalId,
          ...(c.ref ? { campana: c.ref } : {}),
          nombre: c.name,
          tipo: c.kind,
          estado: CAMPAIGN_STATUS[c.status],
          precio_para_el_comprador: c.price,
          pone_el_canal_pct: c.channelPct,
          pone_la_tienda_pct: c.sellerPct,
          desde: c.start?.toISOString() ?? null,
          hasta: c.finish?.toISOString() ?? null,
          como_sumarse: c.join === 'price' ? 'eligiendo_el_precio' : c.join === 'accept' ? 'aceptando' : c.status === 'invited' ? 'desde_el_canal' : null,
          ...(c.join === 'price' && c.range
            ? { precio_que_acepta: { desde: c.range.minPrice, hasta: c.range.maxPrice, sugerido: c.range.suggestedPrice } }
            : {}),
          se_puede_salir: c.canLeave,
          ...(c.pausesOwnDiscount ? { frena_el_descuento_propio: true } : {}),
          ...(queued ? { en_por_subir: campaignText(queued), ...(queued.rejection ? { rechazo_anterior: queued.rejection } : {}) } : {}),
        };
      }),
    ),
    ...(r.unpublished > 0 ? { sin_consultar: `${r.unpublished} todavía no están en ${r.channelName}.` } : {}),
  };
}

const getPriceStep = defineTool({
  name: 'get_price_step',
  section: 'pipeline',
  title: 'Ver el paso Precio',
  description:
    'Muestra el paso Precio de una publicación, como la pantalla: una pestaña por costo (si las medidas de una familia cuestan distinto, cada una tiene su precio, sus cuotas y su descuento; si no, hay una sola), con el costo de reposición sin IVA, el precio publicado, el descuento y las cuotas de hoy y el margen que dejan, lo que tiene el canal, los precios piso y objetivo y el último precio guardado. En lo_que_acepta_el_canal, lo que el canal informa hoy, consultado en el momento: si deja poner un descuento propio y entre qué precios con descuento (si queda más caro de lo que acepta, lo rechaza por parecerle chico), el sugerido, y las campañas en las que está o a las que la invitan, con cómo sumarse o salir: eso se pide con choose_campaign y se manda con push_prices. Es lo que muestra la tarjeta Promociones. Antes de proponer un descuento, mirá que entre en ese rango. También los costos del precio: los de la cuenta (Ajustes > Precios), los propios del producto y los que se usan al final. El margen es sobre el costo, sin IVA.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const data = (await loadPriceStep(ctx.db, account.id, id))!;
    const params = resolvePricing(data.account, data.overrides);
    const codes = new Map(
      (await ctx.db.publication.findMany({ where: { id: { in: data.groups.flatMap((g) => g.publicationIds) } }, select: { id: true, externalId: true } })).map((p) => [
        p.id,
        p.externalId ?? p.id,
      ]),
    );
    return {
      canal: data.channelName,
      ...(data.discountRange ? { descuento_que_acepta_el_canal: { minimo_pct: data.discountRange.min, maximo_pct: data.discountRange.max } } : {}),
      pestanas: await Promise.all(
        data.groups.map(async (g) => ({
          ...groupForClaude(g, params, (x) => codes.get(x) ?? x),
          lo_que_acepta_el_canal: promotionsForClaude(
            await readPromotions(ctx.db, { accountId: account.id, publicationIds: g.publicationIds }),
            g.price,
            data.discountRange,
          ),
        })),
      ),
      costos: {
        de_la_cuenta: pricingForClaude(data.account),
        propios_del_producto: pricingForClaude(data.overrides),
        los_que_se_usan: pricingForClaude(params),
      },
      cuotas_que_se_pueden_usar: Object.keys(PLAN_ARG).filter((k) => installmentCostPct(params, PLAN_ARG[k]) !== null),
    };
  },
});

const savePrice = defineTool({
  name: 'save_price',
  section: 'pipeline',
  title: 'Guardar el precio',
  description:
    'Guarda el precio de una pestaña del paso Precio, como el botón Guardar precio: el precio publicado (con IVA), el descuento y las cuotas van a todas las publicaciones de la pestaña y quedan en Por subir; para mandarlos al canal, push_prices. Pasá en publicacion la de publicacion_para_guardar de get_price_step, o cualquiera de esa pestaña. El costo sale de Costo y Stock del producto (set_product_cost). Con costos_propios_del_producto se cambian los costos que valen solo para este producto: los que no se mandan quedan como están y null vuelve al de la cuenta. Si el margen queda debajo del mínimo, no guarda: decíselo a la persona y, si confirma, volvé a llamar con confirmar_debajo_del_minimo. Antes de guardar, mostrale a la persona qué vas a cambiar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    precio_publicado: z.number().positive().max(999_999_999).describe('El precio publicado, con IVA, en pesos.'),
    descuento_pct: z.number().min(0).max(99).default(0).describe('El descuento, en %. 0 es sin descuento.'),
    cuotas: z.enum(['sin_cuotas', 'promocionada', '3', '6', '9', '12']).default('sin_cuotas').describe('Las cuotas sin interés, o la cuota promocionada.'),
    costos_propios_del_producto: pricingArgs.optional().describe('Los costos que valen solo para este producto. null vuelve al de la cuenta.'),
    confirmar_debajo_del_minimo: z.boolean().default(false).describe('Guardar aunque el margen quede debajo del mínimo: solo si la persona lo confirmó.'),
  }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const before = (await loadPriceStep(ctx.db, account.id, id))!.overrides;
    const overrides = args.costos_propios_del_producto ? merged(before, pricingFrom(args.costos_propios_del_producto), false) : before;
    try {
      const r = await savePriceDecision(ctx.db, {
        accountId: account.id,
        publicationId: id,
        userId: ctx.userId,
        listPrice: args.precio_publicado,
        discountPct: args.descuento_pct,
        plan: PLAN_ARG[args.cuotas],
        overrides,
        confirmBelowMin: args.confirmar_debajo_del_minimo,
      });
      return {
        guardado: true,
        precio_final: round(r.simulation.finalPrice),
        margen_pct: round(r.simulation.marginPct),
        nivel: LEVEL_TEXT[r.simulation.level],
        ganancia_por_venta: round(r.simulation.profit),
        ...(r.belowMin ? { se_confirmo_debajo_del_minimo: true } : {}),
        queda: 'En Por subir: el precio, las cuotas y el descuento se mandan al canal desde la app o con push_prices.',
      };
    } catch (e) {
      if (e instanceof PricingError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const getPricingSettings = defineTool({
  name: 'get_pricing_settings',
  section: 'precios',
  title: 'Ver los costos del precio de la cuenta',
  description:
    'Muestra los costos del precio de la cuenta, los de Ajustes > Precios: cargo del canal, impuestos, IVA, el costo de cada plan de cuotas (null es sin cargar: ese plan no se puede usar), publicidad, devoluciones, envío y embalaje por venta, y los márgenes mínimo y objetivo sobre el costo. Los porcentajes son del precio final. Cada producto puede tener los suyos (get_price_step).',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const s = await loadPricingSettings(ctx.db, account.id);
    return {
      costos: pricingForClaude(s.params),
      cargados_a_mano: Object.keys(pricingForClaude(s.values)),
      ...(s.updatedAt ? { actualizado: s.updatedAt.toISOString(), ...(s.updatedBy ? { por: s.updatedBy } : {}) } : {}),
    };
  },
});

const updatePricingSettings = defineTool({
  name: 'update_pricing_settings',
  section: 'precios',
  title: 'Cambiar los costos del precio de la cuenta',
  description:
    'Cambia los costos del precio de la cuenta, los de Ajustes > Precios. Valen para todos los productos que no tienen los suyos. Mandá solo los que cambian: los demás quedan como están. null vuelve al valor de partida, salvo el costo de un plan de cuotas, que queda sin cargar y ese plan no se puede usar. Los porcentajes van en %, por ejemplo 14.3; envío y embalaje, en pesos. Antes de cambiarlos, mostrale a la persona qué vas a cambiar y esperá que confirme.',
  input: z.object({ cuenta: accountArg, costos: pricingArgs.describe('Los costos que cambian.') }),
  readOnly: false,
  destructive: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const changes = pricingFrom(args.costos);
    if (Object.keys(changes).length === 0) throw new McpToolError('Mandá al menos un costo para cambiar.');
    const before = await loadPricingSettings(ctx.db, account.id);
    const values = merged(before.values, changes, true);
    const resolved = resolvePricing(values);
    if (resolved.targetMarginPct < resolved.minMarginPct) throw new McpToolError('El margen objetivo no puede ser menor que el mínimo.');
    await savePricingSettings(ctx.db, { accountId: account.id, userId: ctx.userId, values });
    return { guardado: true, costos: pricingForClaude(resolvePricing(values)) };
  },
});

// ───────────────────────────── Subir al canal ─────────────────────────────

/** Lo del paso Precio que se sube al canal, con el nombre que ve Claude. */
const PRICE_FIELDS = { price: 'precio', installments: 'cuotas', discount: 'descuento' } as const satisfies Partial<Record<FaceField, string>>;
type PriceField = keyof typeof PRICE_FIELDS;
const isPriceField = (f: FaceField): f is PriceField => f in PRICE_FIELDS;
/** En el orden en que se suben: el precio antes que las cuotas y el descuento. */
const PRICE_ORDER: PriceField[] = ['price', 'installments', 'discount'];
/** Cómo se llama cada valor en lo que devuelve push_prices. */
const SENT_NAME = { price: 'precio', installments: 'cuotas', discount: 'descuento_pct' } as const;

// Cuánto sube en una vuelta: el pedido de Claude a la app tiene 60 segundos, y
// cada publicación tarda unos segundos porque después se vuelve a leer del canal.
// Antes de que se corte la conexión con Claude: lo que no entra vuelve en quedan.
export const PUSH_BUDGET_MS = 25_000;

const chooseCampaign = defineTool({
  name: 'choose_campaign',
  section: 'pipeline',
  title: 'Sumarse a una campaña o salir',
  description:
    'Deja en Por subir sumarse a una campaña del canal o salir de una, como los botones de la tarjeta Promociones del paso Precio y de la página de la publicación. La campaña es su campana en lo_que_acepta_el_canal de get_price_step. Para sumarse: si como_sumarse es eligiendo_el_precio, mandá precio, el precio para el comprador dentro de precio_que_acepta; si es aceptando, el precio lo pone el canal; si es desde_el_canal, no se puede desde la app. Para salir, se_puede_salir tiene que ser true. Devuelve el margen estimado con lo que recibe la tienda, que suma lo que pone el canal. Se manda al canal con push_prices o desde Por subir. Antes, mostrale a la persona la campaña, el precio y el margen, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    campana: z.string().min(1).max(500).describe('La campaña: su campana en lo_que_acepta_el_canal de get_price_step.'),
    accion: z.enum(['sumarse', 'salir']),
    precio: z.number().positive().max(999_999_999).optional().describe('El precio para el comprador, en pesos, en las campañas que se suman eligiendo el precio. Con centavos se redondea para abajo.'),
  }),
  readOnly: false,
  destructive: false,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const read = await readPromotions(ctx.db, { accountId: account.id, publicationIds: [id] });
    if (!read.ok) throw new McpToolError(read.error);
    const c = read.read[0]?.promotions.campaigns.find((x) => x.ref === args.campana);
    if (!c) throw new McpToolError(`Esa campaña ya no aparece en ${read.channelName}: volvé a mirar get_price_step.`);
    const name = c.name ?? c.kind;
    if (args.accion === 'salir' && !c.canLeave) throw new McpToolError(`De ${name} no se puede salir desde la app: se hace en ${read.channelName}.`);
    if (args.accion === 'sumarse' && !c.join) throw new McpToolError(`A ${name} no se puede sumar desde la app: se hace en ${read.channelName}.`);
    const withPrice = args.accion === 'sumarse' && c.join === 'price';
    if (withPrice) {
      const problem = campaignPriceProblem(args.precio ?? 0, c.range, c.listPrice);
      if (problem) throw new McpToolError(`${problem} ${c.range ? `${read.channelName} acepta de ${c.range.minPrice ?? '?'} a ${c.range.maxPrice ?? '?'}.` : ''}`.trim());
    }
    const price = withPrice ? campaignPrice(args.precio!) : null;
    try {
      const queued = await queueCampaign(ctx.db, {
        accountId: account.id,
        publicationId: id,
        choice: { action: args.accion === 'sumarse' ? 'join' : 'leave', ref: c.ref!, name, kind: c.kind, price, pausesOwnDiscount: c.pausesOwnDiscount },
        userId: ctx.userId,
      });
      // El margen, con lo que recibe la tienda: lo que paga el comprador más lo que pone el canal.
      let margin: number | null = null;
      if (args.accion === 'sumarse') {
        const step = await loadPriceStep(ctx.db, account.id, id);
        const group = step?.groups.find((g) => g.publicationIds.includes(id));
        const revenue = campaignRevenue({ price: price ?? c.price, channelPct: c.channelPct, listPrice: c.listPrice });
        if (step && group?.cost && revenue !== null) {
          const plan = group.installments !== null && isInstallmentPlan(group.installments) ? group.installments : 0;
          margin = marginOf(revenue, group.cost, resolvePricing(step.account, step.overrides), plan);
        }
      }
      return {
        en_por_subir: campaignText(queued),
        ...(margin !== null ? { margen_estimado_pct: round(margin) } : {}),
        ...(args.accion === 'sumarse' && c.pausesOwnDiscount
          ? { aviso: `Mientras esté en esta campaña, ${read.channelName} frena el descuento propio: al subir, el descuento propio no se manda y se avisa.` }
          : {}),
      };
    } catch (e) {
      if (e instanceof CampaignError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

const pushPrices = defineTool({
  name: 'push_prices',
  section: 'subir',
  title: 'Subir precios al canal',
  description:
    'Manda al canal el precio publicado, el descuento y las cuotas sin interés que quedaron en Por subir, y sumarse o salir de las campañas pedidas (choose_campaign), como el botón de subir de Por subir, pero solo eso: lo demás que esté por subir (título, descripción, fotos) queda donde está; la descripción se sube con push_descriptions y el título con push_titles. Se mandan los valores del último precio guardado (save_price). En publicaciones pasá ids de la app o códigos del canal (por ejemplo MLA123456789), hasta 100; sin la lista, van todas las de la cuenta que tienen precio, cuotas o descuento por subir. Saltea las que todavía no están publicadas en el canal y las que no tienen esos cambios pendientes, y dice por qué. Si cambia el precio, el descuento se vuelve a mandar, porque el canal lo calcula sobre el precio. Por cada una devuelve qué se mandó y si quedó bien, o el motivo exacto del rechazo del canal; si el canal rechaza el descuento, lo dice y sigue con lo demás. Después de mandar una campaña vuelve a consultar al canal: confirmado_en_el_canal es true solo si ya figura programada o activa (o fuera, al salir); si el canal todavía no lo muestra, la campaña queda como pendiente, suele tardar unos minutos, y se vuelve a mirar con get_price_step. Si la publicación tiene descuento propio pendiente y la campaña lo frena, el descuento no se manda y se avisa. Si son muchas, sube las que entran en una vuelta (unos 25 segundos) y devuelve en quedan las que faltan: volvé a llamar con esa lista. Cambia la publicación en el canal de verdad: antes de subir, mostrale a la persona qué se va a mandar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .optional()
      .describe('Las publicaciones: su id en la app o su código en el canal, hasta 100. Sin la lista, todas las de la cuenta con precio, cuotas o descuento por subir.'),
  }),
  readOnly: false,
  destructive: true,
  logsItself: true,
  run: async (ctx, args) => {
    const account = await resolveAccount(ctx, args.cuenta);
    const started = Date.now();
    const pending = new Map((await listToPush(account.id, ctx.db)).map((r) => [r.id, r]));
    // Lo que tiene para subir del precio: lo que cambió en la app, y lo que cambió también en el canal, que avisa que hay que elegir.
    const priceFields = (id: string) => {
      const row = pending.get(id);
      return row ? [...new Set([...row.draft, ...row.choose])].filter(isPriceField) : [];
    };
    // Sumarse o salir de campañas, pedido desde el Pipeline.
    const campaignsOf = (id: string) => pending.get(id)?.campaigns.length ?? 0;

    const salteadas: { publicacion: string; motivo: string }[] = [];
    let ids: string[] = [];
    if (args.publicaciones) {
      for (const ref of args.publicaciones) {
        try {
          const id = await findPublication(ctx.db, account.id, ref);
          if (!ids.includes(id)) ids.push(id);
        } catch (e) {
          if (!(e instanceof McpToolError)) throw e;
          salteadas.push({ publicacion: ref, motivo: e.message });
        }
      }
    } else ids = [...pending.keys()].filter((id) => priceFields(id).length > 0 || campaignsOf(id) > 0);

    const pubs = new Map(
      (
        await ctx.db.publication.findMany({
          where: { id: { in: ids } },
          select: { id: true, externalId: true, title: true, price: true, installments: true, discount: true, store: { select: { channel: { select: { name: true } } } } },
        })
      ).map((p) => [p.id, p]),
    );

    const subidas: unknown[] = [];
    const quedan: string[] = [];
    for (const id of ids) {
      const p = pubs.get(id)!;
      const code = p.externalId ?? id;
      if (!p.externalId) {
        salteadas.push({ publicacion: code, motivo: `Todavía no está publicada en ${p.store.channel.name}: primero hay que crearla allá.` });
        continue;
      }
      const fields = priceFields(id);
      if (fields.length === 0 && campaignsOf(id) === 0) {
        salteadas.push({ publicacion: code, motivo: 'No tiene precio, cuotas, descuento ni campañas por subir.' });
        continue;
      }
      if (Date.now() - started > PUSH_BUDGET_MS) {
        quedan.push(code);
        continue;
      }
      const value: Record<PriceField, unknown> = {
        price: p.price === null ? null : Number(p.price),
        installments: p.installments === null ? null : planName(p.installments),
        discount: p.discount === null ? null : Number(p.discount),
      };
      const base = { publicacion: code, titulo: p.title };
      try {
        const r = await pushDrafts(ctx.db, { accountId: account.id, publicationId: id, fields, campaigns: true, userId: ctx.userId });
        const tried = [...r.sent, ...r.rejected.map((x) => x.field)].filter(isPriceField);
        const sent = r.sent.filter(isPriceField);
        const failed = r.rejected.length + r.campaigns.filter((c) => !c.ok).length;
        const done = sent.length + r.campaigns.filter((c) => c.ok).length;
        // Las campañas que se mandaron: se vuelve a consultar al canal para ver cómo quedaron.
        const states = await campaignStates(ctx.db, account.id, id, r.campaigns);
        const pendingCampaigns = r.campaigns.filter((c) => c.ok && states.get(c.ref) === 'pendiente').map((c) => c.name);
        subidas.push({
          ...base,
          se_mando: {
            ...Object.fromEntries(PRICE_ORDER.filter((f) => tried.includes(f)).map((f) => [SENT_NAME[f], value[f]])),
            ...(r.campaigns.length > 0 ? { campanas: r.campaigns.map(campaignText) } : {}),
          },
          resultado: failed === 0 ? 'subido' : done > 0 ? 'subido_en_parte' : 'rechazado',
          subio: sent.map((f) => PRICE_FIELDS[f]),
          ...(r.rejected.length > 0 ? { rechazos: r.rejected.map((x) => ({ dato: isPriceField(x.field) ? PRICE_FIELDS[x.field] : x.field, motivo: x.message })) } : {}),
          ...(r.campaigns.length > 0
            ? {
                campanas: r.campaigns.map((c) => ({
                  campana: c.name,
                  accion: c.action === 'join' ? 'sumarse' : 'salir',
                  resultado: c.ok ? 'hecho' : 'rechazado',
                  ...(c.ok ? { estado_en_el_canal: states.get(c.ref) ?? 'pendiente' } : {}),
                  ...(c.message ? { motivo: c.message } : {}),
                })),
              }
            : {}),
          // Lo del precio, releído después de subir; lo de las campañas, consultado al canal.
          confirmado_en_el_canal: (sent.length === 0 || r.confirmed) && done > 0 && pendingCampaigns.length === 0,
          ...(pendingCampaigns.length > 0
            ? { aviso: `${p.store.channel.name} aceptó ${pendingCampaigns.join(', ')} pero todavía no lo muestra: suele tardar unos minutos. Volvé a mirar con get_price_step.` }
            : {}),
        });
        // Como el botón de Por subir: queda en la actividad de la persona, hecho por Claude.
        await logActivity(ctx.db, {
          userId: ctx.userId,
          accountId: account.id,
          section: 'subir',
          summary: 'Subió cambios al canal',
          publicationId: id,
          detail:
            [
              sent.length > 0 ? `Subió ${sent.map((f) => PRICE_FIELDS[f]).join(', ')}` : null,
              ...r.campaigns.map((c) => (c.ok ? `${c.action === 'join' ? 'Se sumó a' : 'Salió de'} ${c.name}` : `${c.name}: ${c.message}`)),
              ...r.rejected.map((x) => x.message),
            ]
              .filter(Boolean)
              .join('. ') || null,
          via: 'CLAUDE',
        });
      } catch (e) {
        if (!(e instanceof PushError || e instanceof ConnectError)) {
          console.error('push_prices: no se pudo subir', e instanceof Error ? e.message : e);
        }
        subidas.push({
          ...base,
          se_mando: Object.fromEntries(PRICE_ORDER.filter((f) => fields.includes(f)).map((f) => [SENT_NAME[f], value[f]])),
          resultado: 'error',
          error: e instanceof PushError || e instanceof ConnectError ? e.message : 'No se pudo subir: hubo un error en la app. Probá de nuevo.',
        });
      }
    }
    return {
      subidas,
      ...(salteadas.length > 0 ? { salteadas } : {}),
      ...(quedan.length > 0 ? { quedan, aviso: 'No entraron todas en esta vuelta: volvé a llamar con la lista de quedan.' } : {}),
      ...(ids.length === 0 && salteadas.length === 0 ? { aviso: 'No hay precios, cuotas, descuentos ni campañas por subir en la cuenta.' } : {}),
    };
  },
});

/** Cómo quedó en el canal cada campaña que se mandó bien, por su ref. Si no se puede consultar, quedan como pendientes. */
async function campaignStates(db: McpContext['db'], accountId: string, publicationId: string, outcomes: CampaignOutcome[]): Promise<Map<string, CampaignOutcomeState>> {
  const states = new Map<string, CampaignOutcomeState>();
  const sent = outcomes.filter((c) => c.ok);
  if (sent.length === 0) return states;
  const read = await readPromotions(db, { accountId, publicationIds: [publicationId], light: true });
  const campaigns = read.ok ? (read.read[0]?.promotions.campaigns ?? []) : null;
  for (const c of sent) {
    // Al entrar, el canal puede cambiarle la ref (por ejemplo, sumarle el código de la oferta): también vale el nombre.
    const found = campaigns?.find((x) => x.ref === c.ref) ?? campaigns?.find((x) => x.name !== null && x.name === c.name && x.kind === c.kind) ?? null;
    states.set(c.ref, campaigns === null ? 'pendiente' : campaignOutcomeState(c.action, found?.status ?? null));
  }
  return states;
}

export const PRICE_TOOLS = [getPriceStep, savePrice, getPricingSettings, updatePricingSettings, chooseCampaign, pushPrices];
