import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { dayOf, offerOf } from '@/domain/competitors';
import { fingerprint, priceText, storedPrints } from '@/domain/channel-sync';
import type { CompetitorPrice } from '@/domain/price-comparison';
import {
  installmentCostPct,
  isInstallmentPlan,
  parsePricingValues,
  planLabel,
  resolvePricing,
  simulate,
  type InstallmentPlan,
  type PricingParams,
} from '@/domain/pricing';

// El paso Precio: los parámetros de la cuenta, el costo y los parámetros
// propios del producto, la competencia que se cargó en Información y la
// decisión de precio. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient | Prisma.TransactionClient;

export class PricingError extends Error {}

export async function loadPricingSettings(db: Db, accountId: string) {
  const row = await db.pricingSettings.findUnique({ where: { accountId }, include: { updatedBy: { select: { name: true } } } });
  const values = parsePricingValues(row?.values);
  return { values, params: resolvePricing(values), updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy?.name ?? null };
}

/** Reemplaza los parámetros de la cuenta: lo que no viene vuelve al valor de partida. */
export async function savePricingSettings(db: Db, args: { accountId: string; userId: string | null; values: Partial<PricingParams> }) {
  const data = { values: args.values as Prisma.InputJsonValue, updatedById: args.userId };
  await db.pricingSettings.upsert({ where: { accountId: args.accountId }, create: { accountId: args.accountId, ...data }, update: data });
}

/** Los parámetros de un producto: los de la cuenta y encima los propios. Para el envío de la competencia en Información. */
export async function productPricing(db: Db, accountId: string, productId: string): Promise<PricingParams> {
  const [settings, product] = await Promise.all([
    db.pricingSettings.findUnique({ where: { accountId }, select: { values: true } }),
    db.product.findUnique({ where: { id: productId }, select: { pricingOverrides: true } }),
  ]);
  return resolvePricing(settings?.values, product?.pricingOverrides);
}

/** Lo que usa el paso Precio. Null si la publicación no es de la cuenta. */
export async function loadPriceStep(db: Db, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      price: true,
      externalId: true,
      store: { select: { channel: { select: { kind: true, name: true } } } },
      channelCopy: { select: { price: true, missingSince: true } },
      competitors: {
        orderBy: { position: 'asc' },
        select: { title: true, sellerName: true, url: true, surveyedAt: true, listPrice: true, discountPct: true, installments: true, freeShipping: true },
      },
      priceDecisions: { orderBy: { decidedAt: 'desc' }, take: 1, include: { decidedBy: { select: { name: true } } } },
      product: {
        select: {
          id: true,
          name: true,
          replacementCost: true,
          pricingOverrides: true,
          _count: { select: { publications: true } },
        },
      },
    },
  });
  if (!p) return null;
  const settings = await loadPricingSettings(db, accountId);
  const overrides = parsePricingValues(p.product.pricingOverrides);
  const competitors: CompetitorPrice[] = p.competitors.flatMap((c) => {
    const offer = offerOf(c);
    return offer ? [{ title: c.title, sellerName: c.sellerName, url: c.url, surveyedAt: dayOf(c.surveyedAt), offer }] : [];
  });
  const decision = p.priceDecisions[0] ?? null;
  return {
    publicationId: p.id,
    productId: p.product.id,
    productName: p.product.name,
    channelName: getChannelAdapter(p.store.channel.kind, p.store.channel.name).name,
    // El precio publicado: el de la app y el que se leyó del canal.
    price: p.price === null ? null : Number(p.price),
    channelPrice: p.channelCopy && !p.channelCopy.missingSince && p.channelCopy.price !== null ? Number(p.channelCopy.price) : null,
    cost: p.product.replacementCost === null ? null : Number(p.product.replacementCost),
    // Las otras publicaciones del producto, que comparten el costo y los parámetros propios.
    sharedWith: p.product._count.publications - 1,
    account: settings.params,
    overrides,
    competitors,
    competitorsWithoutPrice: p.competitors.length - competitors.length,
    decision: decision
      ? {
          listPrice: Number(decision.listPrice),
          discountPct: Number(decision.discountPct),
          installments: decision.installments,
          finalPrice: Number(decision.finalPrice),
          marginPct: Number(decision.marginPct),
          minMarginPct: Number(decision.minMarginPct),
          belowMinConfirmed: decision.belowMinConfirmed,
          decidedAt: decision.decidedAt,
          decidedBy: decision.decidedBy?.name ?? null,
        }
      : null,
  };
}

export type PriceStepData = NonNullable<Awaited<ReturnType<typeof loadPriceStep>>>;

/** El último precio decidido, para el paso Publicación. */
export async function latestPriceDecision(db: Db, publicationId: string) {
  const d = await db.priceDecision.findFirst({
    where: { publicationId },
    orderBy: { decidedAt: 'desc' },
    select: { listPrice: true, discountPct: true, installments: true, finalPrice: true, marginPct: true, minMarginPct: true, belowMinConfirmed: true, decidedAt: true },
  });
  return d
    ? {
        listPrice: Number(d.listPrice),
        discountPct: Number(d.discountPct),
        installments: d.installments,
        finalPrice: Number(d.finalPrice),
        marginPct: Number(d.marginPct),
        minMarginPct: Number(d.minMarginPct),
        belowMinConfirmed: d.belowMinConfirmed,
        decidedAt: d.decidedAt,
      }
    : null;
}

export type LatestPriceDecision = Awaited<ReturnType<typeof latestPriceDecision>>;

/**
 * Guarda el precio: el costo y los parámetros propios del producto, la
 * decisión con el margen que deja, y el precio publicado en el borrador de la
 * publicación, para subirlo desde Por subir. Si el margen queda debajo del
 * mínimo, hay que confirmarlo.
 */
export async function savePriceDecision(
  db: PrismaClient,
  args: {
    accountId: string;
    publicationId: string;
    userId: string | null;
    listPrice: number;
    discountPct: number;
    plan: number;
    cost: number;
    overrides: Partial<PricingParams>;
    confirmBelowMin: boolean;
    now?: Date;
  },
) {
  if (!(args.cost > 0)) throw new PricingError('Cargá el costo de reposición sin IVA.');
  if (!(args.listPrice > 0)) throw new PricingError('Cargá el precio publicado.');
  if (!(args.discountPct >= 0 && args.discountPct < 100)) throw new PricingError('El descuento va de 0 a 99 %.');
  if (!isInstallmentPlan(args.plan)) throw new PricingError('Las cuotas son sin cuotas, la cuota promocionada, 3, 6, 9 o 12.');
  const plan: InstallmentPlan = args.plan;
  const listPrice = Math.round(args.listPrice);

  return db.$transaction(async (tx) => {
    const p = await tx.publication.findFirst({
      where: { id: args.publicationId, product: { accountId: args.accountId } },
      select: { id: true, productId: true, channelCopy: { select: { fingerprints: true, agreed: true, price: true } } },
    });
    if (!p) throw new PricingError('La publicación no existe en esta cuenta.');
    const settings = await tx.pricingSettings.findUnique({ where: { accountId: args.accountId }, select: { values: true } });
    const params = resolvePricing(settings?.values, args.overrides);
    if (installmentCostPct(params, plan) === null) throw new PricingError(`Cargá el costo de ${planLabel(plan).toLowerCase()} en Ajustes > Precios para usarla.`);
    const s = simulate({ listPrice, discountPct: args.discountPct, plan, cost: args.cost, params });
    const below = s.marginPct < params.minMarginPct - 1e-9;
    if (below && !args.confirmBelowMin) {
      throw new PricingError(
        `El margen queda en ${s.marginPct.toFixed(1).replace('.', ',')} %, debajo del mínimo de ${String(params.minMarginPct).replace('.', ',')} %. Confirmalo para guardarlo igual.`,
      );
    }

    await tx.product.update({
      where: { id: p.productId },
      data: { replacementCost: args.cost, pricingOverrides: args.overrides as Prisma.InputJsonValue },
    });
    const decision = await tx.priceDecision.create({
      data: {
        publicationId: p.id,
        listPrice,
        discountPct: args.discountPct,
        installments: plan,
        finalPrice: Math.round(s.finalPrice * 100) / 100,
        cost: args.cost,
        marginPct: Math.round(s.marginPct * 100) / 100,
        minMarginPct: params.minMarginPct,
        params: params as unknown as Prisma.InputJsonValue,
        belowMinConfirmed: below,
        decidedById: args.userId,
        ...(args.now ? { decidedAt: args.now } : {}),
      },
      select: { id: true, decidedAt: true },
    });
    // El precio pasa al borrador. Si la copia del canal todavía no tenía la
    // huella del precio, se guarda la de antes como acordada: así queda como
    // cambio de la app para subir, y no como algo para elegir.
    if (p.channelCopy) {
      const { channel, agreed } = storedPrints(p.channelCopy);
      await tx.channelCopy.update({
        where: { publicationId: p.id },
        data: { fingerprints: { ...channel }, agreed: { ...agreed, price: agreed.price ?? fingerprint('price', priceText(p.channelCopy.price)) } },
      });
    }
    await tx.publication.update({ where: { id: p.id }, data: { price: listPrice } });
    return { id: decision.id, decidedAt: decision.decidedAt, simulation: s, belowMin: below };
  });
}
