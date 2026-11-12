import type { ChannelStatus } from '@/generated/prisma/enums';
import type { PrismaClient } from '@/generated/prisma/client';
import { isIn } from '@/domain/family-campaigns';
import { flatForMargin, modeRows, MODES, resultAt, type ModeCalc } from '@/domain/option-table';
import { finalPriceOf, isInstallmentPlan, resolvePricing, type InstallmentPlan, type MarginLevel, type PricingParams } from '@/domain/pricing';
import { readPromotions } from '@/lib/channel-promotions';
import { measuresOf } from '@/lib/media';
import { loadPriceStep } from '@/lib/pricing';

// La tabla de precios por modo de compra del paso Precio: por cada pestaña de
// costo, el precio de cada modo calculado desde el sin cuotas, y por cada
// medida, qué publicaciones tiene en cada modo, con su estado, su precio de
// hoy, su descuento y su campaña. Solo lee: no guarda ni sube nada. Recibe la
// base por parámetro para poder probarlo.

type Db = PrismaClient;

type Result = { profit: number; marginPct: number | null; level: MarginLevel | null };

export type TableOption = {
  id: string;
  externalId: string | null;
  url: string | null;
  status: ChannelStatus;
  statusReason: string | null;
  // El canal pide corregirla para reactivarla: aunque esté en revisión, se le puede subir el precio.
  needsFix: boolean;
  blocked: boolean;
  main: boolean;
  // Lo que tiene hoy en el canal: el precio publicado, el descuento propio y lo que deja con ese descuento.
  priceNow: number | null;
  discountNow: number | null;
  now: Result | null;
  // La campaña en la que está o está anotada, con el precio para el comprador y lo que deja.
  campaign: { name: string; state: 'activa' | 'programada'; price: number; result: Result } | null;
  // El precio que tiene guardado la app y si es distinto del que tiene el canal: queda en Por subir.
  savedPrice: number | null;
  savedDiscount: number | null;
  pending: boolean;
  // Con precio personalizado: no se recalcula desde el precio sin cuotas.
  custom: boolean;
};

export type TableMeasure = {
  mainId: string;
  measure: string | null;
  modes: { plan: InstallmentPlan; options: TableOption[] }[];
  // Opciones con una forma de cobro que la app no conoce.
  unknownPlan: TableOption[];
};

export type TableGroup = {
  anchorId: string;
  cost: number | null;
  costNote: string;
  // El precio sin cuotas del que sale todo, y de dónde salió.
  flatPrice: number | null;
  flatSource: 'pedido' | 'ultimo_precio_guardado' | 'margen_objetivo' | null;
  rows: ModeCalc[];
  measures: TableMeasure[];
};

export type OptionTable = { channelName: string; params: PricingParams; groups: TableGroup[]; campaignsRead: boolean };

/**
 * La tabla de una publicación. flatPrices: el precio sin cuotas pedido para
 * cada pestaña, por su publicación principal; sin pedirlo, sale del último
 * precio guardado con el mismo margen, o del margen objetivo.
 */
export async function loadOptionTable(
  db: Db,
  args: { accountId: string; publicationId: string; flatPrices?: Record<string, number>; campaigns?: boolean },
): Promise<OptionTable | null> {
  const data = await loadPriceStep(db, args.accountId, args.publicationId);
  if (!data) return null;
  const params = resolvePricing(data.account, data.overrides);
  const mainIds = data.groups.flatMap((g) => g.publicationIds);
  const rows = await db.publication.findMany({
    where: { OR: [{ id: { in: mainIds } }, { mainOptionId: { in: mainIds } }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      externalId: true,
      url: true,
      variantKey: true,
      mainOptionId: true,
      channelStatus: true,
      installments: true,
      price: true,
      discount: true,
      customPrice: true,
      product: { select: { variants: { orderBy: { position: 'asc' }, select: { sku: true, measure: true } } } },
      channelCopy: { select: { installments: true, status: true, statusReason: true, statusNeedsFix: true, statusBlocked: true, price: true, discount: true, url: true } },
    },
  });

  // Las campañas, en una sola consulta al canal para todas las publicaciones de la tabla.
  const campaignsOf = new Map<string, { name: string; state: 'activa' | 'programada'; price: number }>();
  let campaignsRead = false;
  const published = rows.filter((r) => r.externalId).map((r) => r.id);
  if (args.campaigns !== false && published.length > 0) {
    const read = await readPromotions(db, { accountId: args.accountId, publicationIds: published }).catch(() => null);
    if (read?.ok) {
      campaignsRead = true;
      for (const r of read.read) {
        const inside = r.promotions.campaigns.filter((c) => isIn(c) && c.price !== null);
        const c = inside.find((x) => x.status === 'active') ?? inside[0];
        if (c) campaignsOf.set(r.publicationId, { name: c.name ?? c.kind, state: c.status === 'active' ? 'activa' : 'programada', price: c.price! });
      }
    }
  }

  const decisions = await db.priceDecision.findMany({
    where: { publicationId: { in: data.groups.map((g) => g.anchorId) } },
    orderBy: { decidedAt: 'desc' },
    select: { publicationId: true, marginPct: true, installments: true, listPrice: true, discountPct: true },
  });

  const groups = data.groups.map((g): TableGroup => {
    const cost = g.cost;
    const asked = args.flatPrices?.[g.anchorId];
    const last = decisions.find((d) => d.publicationId === g.anchorId);
    let flatPrice: number | null = null;
    let flatSource: TableGroup['flatSource'] = null;
    if (cost !== null) {
      if (asked && asked > 0) [flatPrice, flatSource] = [Math.round(asked), 'pedido'];
      // Si lo último guardado fue sin cuotas y sin descuento, ese mismo precio; si no, el que deja su margen.
      else if (last && last.installments === 0 && Number(last.discountPct) === 0) [flatPrice, flatSource] = [Number(last.listPrice), 'ultimo_precio_guardado'];
      else if (last) [flatPrice, flatSource] = [flatForMargin(cost, params, Number(last.marginPct)), 'ultimo_precio_guardado'];
      else [flatPrice, flatSource] = [flatForMargin(cost, params, params.targetMarginPct), 'margen_objetivo'];
    }
    const option = (r: (typeof rows)[number]): TableOption => {
      const plan = r.channelCopy?.installments ?? r.installments;
      const priceNow = r.channelCopy?.price != null ? Number(r.channelCopy.price) : null;
      const discountNow = r.channelCopy?.discount != null ? Number(r.channelCopy.discount) : null;
      const campaign = campaignsOf.get(r.id);
      const valid = plan !== null && isInstallmentPlan(plan);
      const savedPrice = r.price != null ? Number(r.price) : null;
      const savedDiscount = r.discount != null ? Number(r.discount) : null;
      return {
        id: r.id,
        externalId: r.externalId,
        url: r.channelCopy?.url ?? r.url,
        status: r.channelCopy?.status ?? r.channelStatus,
        statusReason: r.channelCopy?.statusReason ?? null,
        needsFix: r.channelCopy?.statusNeedsFix ?? false,
        blocked: r.channelCopy?.statusBlocked ?? false,
        main: r.mainOptionId === null,
        priceNow,
        discountNow,
        now: cost !== null && valid && priceNow !== null ? resultAt(finalPriceOf(priceNow, discountNow ?? 0), cost, params, plan) : null,
        campaign: campaign && cost !== null && valid ? { ...campaign, result: resultAt(campaign.price, cost, params, plan) } : null,
        savedPrice,
        savedDiscount,
        custom: r.customPrice,
        pending:
          Boolean(r.externalId) &&
          ((savedPrice !== null && savedPrice !== priceNow) || (savedDiscount !== null && discountNow !== null && savedDiscount !== discountNow)),
      };
    };
    const measures = g.publicationIds.map((mainId): TableMeasure => {
      const own = rows.filter((r) => r.id === mainId || r.mainOptionId === mainId);
      const main = own.find((r) => r.id === mainId)!;
      const planOf = (r: (typeof rows)[number]) => r.channelCopy?.installments ?? r.installments;
      return {
        mainId,
        // La medida que vende; un producto de una sola medida, la suya.
        measure: main?.variantKey
          ? (measuresOf(main.product.variants).find((m) => m.key === main.variantKey)?.label ?? null)
          : main?.product.variants.length === 1
            ? (main.product.variants[0].measure ?? null)
            : null,
        modes: MODES.map((plan) => ({ plan, options: own.filter((r) => planOf(r) === plan).map(option) })),
        unknownPlan: own.filter((r) => {
          const p = planOf(r);
          return p === null || !isInstallmentPlan(p);
        }).map(option),
      };
    });
    return {
      anchorId: g.anchorId,
      cost,
      costNote: g.costNote,
      flatPrice,
      flatSource,
      rows: flatPrice !== null && cost !== null ? modeRows({ flatPrice, cost, params }) : [],
      measures,
    };
  });
  return { channelName: data.channelName, params, groups, campaignsRead };
}
