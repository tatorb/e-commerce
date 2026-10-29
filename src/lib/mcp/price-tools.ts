import { z } from 'zod';
import { measuresText } from '@/domain/costs';
import {
  installmentCostPct,
  isInstallmentPlan,
  LOW_INTEREST_PLAN,
  marginLevel,
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
import { loadPricingSettings, loadPriceStep, PricingError, savePriceDecision, savePricingSettings, type PriceGroupData } from '@/lib/pricing';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// El precio desde Claude: lo mismo que el paso Precio y Ajustes > Precios, con
// los mismos permisos. Guardar un precio lo deja en Por subir, como la
// pantalla: Claude no lo manda al canal.

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

const getPriceStep = defineTool({
  name: 'get_price_step',
  section: 'pipeline',
  title: 'Ver el paso Precio',
  description:
    'Muestra el paso Precio de una publicación, como la pantalla: una pestaña por costo (si las medidas de una familia cuestan distinto, cada una tiene su precio, sus cuotas y su descuento; si no, hay una sola), con el costo de reposición sin IVA, el precio publicado, el descuento y las cuotas de hoy y el margen que dejan, lo que tiene el canal, los precios piso y objetivo y el último precio guardado. También los costos del precio: los de la cuenta (Ajustes > Precios), los propios del producto y los que se usan al final. El margen es sobre el costo, sin IVA.',
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
      pestanas: data.groups.map((g) => groupForClaude(g, params, (x) => codes.get(x) ?? x)),
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
    'Guarda el precio de una pestaña del paso Precio, como el botón Guardar precio: el precio publicado (con IVA), el descuento y las cuotas van a todas las publicaciones de la pestaña y quedan en Por subir; no se mandan al canal. Pasá en publicacion la de publicacion_para_guardar de get_price_step, o cualquiera de esa pestaña. El costo sale de Costo y Stock del producto (set_product_cost). Con costos_propios_del_producto se cambian los costos que valen solo para este producto: los que no se mandan quedan como están y null vuelve al de la cuenta. Si el margen queda debajo del mínimo, no guarda: decíselo a la persona y, si confirma, volvé a llamar con confirmar_debajo_del_minimo. Antes de guardar, mostrale a la persona qué vas a cambiar y esperá que confirme.',
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
        queda: 'En Por subir: el precio, las cuotas y el descuento se mandan al canal desde la app.',
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

export const PRICE_TOOLS = [getPriceStep, savePrice, getPricingSettings, updatePricingSettings];
