import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { lockFamily } from '@/domain/family-members';
import { getChannelPublisher } from '@/channels/publish';
import { dayOf, offerOf } from '@/domain/competitors';
import { costGroups, highestCost, measuresText } from '@/domain/costs';
import { matchSlot, stockSlots } from '@/domain/stock';
import { discountText, fingerprint, installmentsText, priceText, storedPrints } from '@/domain/channel-sync';
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
import { COST_SELECT, costLines } from './costs';
import { singleMeasure } from './stock-plan';

// El paso Precio: los parámetros de la cuenta, el costo de cada medida y los
// parámetros propios del producto, la competencia que se cargó en Información
// y la decisión de precio. Las medidas que cuestan lo mismo comparten un
// precio; las que cuestan distinto se deciden cada una en su pestaña, con su
// precio, sus cuotas y su descuento. Recibe la base por parámetro para poder
// probarlo.

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

/** Una pestaña del paso Precio: las publicaciones de las medidas que cuestan lo mismo y llevan un mismo precio. */
export type PriceGroup = {
  // Donde se lee lo de hoy y la última decisión: la principal de la familia si está, si no la primera.
  anchorId: string;
  publicationIds: string[];
  // Las medidas, como se llaman en la ficha. Vacío si el producto no tiene medidas.
  measures: string[];
  cost: number | null;
  // De dónde sale el costo, para decirlo en pantalla.
  costNote: string;
  // Las medidas que no tienen el costo cargado.
  missing: string[];
  // Si hoy tienen precios distintos: al guardar quedan todas con el mismo.
  pricesDiffer: boolean;
};

const UNKNOWN_MEASURE = 'Medida sin elegir';

/**
 * Las pestañas del paso Precio de una publicación. En una familia, una por
 * costo, la de la principal primero. Sin familia, una sola: con la medida que
 * vende, o con el costo más alto si vende varias o no se sabe cuál, así
 * ninguna queda debajo del margen.
 */
export async function priceGroups(db: Db, publicationId: string): Promise<PriceGroup[]> {
  const pub = await db.publication.findUniqueOrThrow({
    where: { id: publicationId },
    select: {
      id: true,
      variantKey: true,
      price: true,
      channelCopy: { select: { details: true } },
      family: { select: { leadId: true, members: { select: { id: true, variantKey: true, price: true } } } },
      product: { select: COST_SELECT },
    },
  });
  const slots = stockSlots(pub.product.variants);
  const { lines } = costLines(pub.product);
  const line = new Map(lines.map((l) => [l.key, l]));
  const single = slots.length < 2;
  const leadId = pub.family?.leadId ?? pub.id;
  const sold = (variantKey: string | null): string[] => {
    if (single) return [slots[0].key];
    const m = singleMeasure(pub.product, pub.channelCopy, variantKey);
    const key = m ? matchSlot(slots, m) : null;
    return key !== null ? [key] : [];
  };
  const members = pub.family?.members ?? [{ id: pub.id, variantKey: pub.variantKey, price: pub.price }];
  const units = members.map((m) => {
    let keys = sold(m.variantKey);
    // Sin familia, si no se sabe qué medida vende, son todas: va el costo más alto.
    if (keys.length === 0 && !pub.family) keys = slots.map((x) => x.key);
    const known = keys.length > 0;
    return {
      id: m.id,
      price: m.price === null ? null : Number(m.price),
      keys,
      labels: known ? keys.map((k) => line.get(k)!.label) : [UNKNOWN_MEASURE],
      order: known ? Math.min(...keys.map((k) => slots.findIndex((x) => x.key === k))) : slots.length,
      cost: known ? highestCost(keys.map((k) => line.get(k)!.cost)) : null,
      missing: known ? keys.filter((k) => line.get(k)!.cost === null).map((k) => line.get(k)!.label) : [UNKNOWN_MEASURE],
    };
  });
  units.sort((a, b) => Number(b.id === leadId) - Number(a.id === leadId) || a.order - b.order);
  return costGroups(units).map((g) => {
    const ids = g.items.map((u) => u.id);
    const measures = single ? [] : [...new Set(g.items.flatMap((u) => u.labels))];
    const several = g.items.some((u) => u.keys.length > 1);
    return {
      anchorId: ids.includes(leadId) ? leadId : ids[0],
      publicationIds: ids,
      measures,
      cost: g.cost,
      costNote: single
        ? 'el del producto'
        : several
          ? `el más alto de ${measuresText(measures)}`
          : measures.length === 1
            ? `el de la medida ${measures[0]}`
            : `el de las medidas ${measuresText(measures)}`,
      missing: [...new Set(g.items.flatMap((u) => u.missing))],
      pricesDiffer: new Set(g.items.map((u) => u.price)).size > 1,
    };
  });
}

/** Lo que usa el paso Precio. Null si la publicación no es de la cuenta. */
export async function loadPriceStep(db: Db, accountId: string, publicationId: string) {
  const p = await db.publication.findFirst({
    where: { id: publicationId, product: { accountId } },
    select: {
      id: true,
      store: { select: { channel: { select: { kind: true, name: true } } } },
      competitors: {
        orderBy: { position: 'asc' },
        select: { title: true, sellerName: true, brand: true, url: true, surveyedAt: true, listPrice: true, discountPct: true, installments: true, freeShipping: true },
      },
      product: { select: { id: true, name: true, brand: true, pricingOverrides: true } },
    },
  });
  if (!p) return null;
  const settings = await loadPricingSettings(db, accountId);
  const overrides = parsePricingValues(p.product.pricingOverrides);
  const competitors: CompetitorPrice[] = p.competitors.flatMap((c) => {
    const offer = offerOf(c);
    return offer ? [{ title: c.title, sellerName: c.sellerName, brand: c.brand, url: c.url, surveyedAt: dayOf(c.surveyedAt), offer }] : [];
  });
  const groups = await priceGroups(db, p.id);
  const anchors = await db.publication.findMany({
    where: { id: { in: groups.map((g) => g.anchorId) } },
    select: {
      id: true,
      price: true,
      installments: true,
      discount: true,
      channelCopy: { select: { price: true, installments: true, discount: true, discountUntil: true, missingSince: true } },
      priceDecisions: { orderBy: { decidedAt: 'desc' }, take: 1, include: { decidedBy: { select: { name: true } } } },
    },
  });
  const anchorOf = new Map(anchors.map((a) => [a.id, a]));
  return {
    publicationId: p.id,
    productId: p.product.id,
    productName: p.product.name,
    // La marca del producto, para compararla con la de la competencia.
    brand: p.product.brand,
    channelName: getChannelAdapter(p.store.channel.kind, p.store.channel.name).name,
    // El descuento que acepta el canal, en %.
    discountRange: getChannelPublisher(p.store.channel.kind)?.discountRange ?? null,
    account: settings.params,
    overrides,
    competitors,
    competitorsWithoutPrice: p.competitors.length - competitors.length,
    groups: groups.map((g) => {
      const a = anchorOf.get(g.anchorId)!;
      const decision = a.priceDecisions[0] ?? null;
      const copy = a.channelCopy && !a.channelCopy.missingSince ? a.channelCopy : null;
      return {
        ...g,
        // El precio publicado: el de la app y el que se leyó del canal.
        price: a.price === null ? null : Number(a.price),
        channelPrice: copy && copy.price !== null ? Number(copy.price) : null,
        // Las cuotas y el descuento de la app, y los que se leyeron del canal.
        installments: a.installments,
        discount: a.discount === null ? null : Number(a.discount),
        channelInstallments: copy?.installments ?? null,
        channelDiscount: copy && copy.discount !== null ? Number(copy.discount) : null,
        // Hasta cuándo dura el descuento que subió la app. Se renueva solo antes de que venza.
        discountUntil: copy?.discountUntil ?? null,
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
    }),
  };
}

export type PriceStepData = NonNullable<Awaited<ReturnType<typeof loadPriceStep>>>;
export type PriceGroupData = PriceStepData['groups'][number];

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
 * Lo acordado con el canal para el precio, las cuotas y el descuento: si no
 * tenía su huella, se guarda la de lo leído. Así lo que cambia la app queda
 * como un cambio para subir, y no como algo para elegir.
 */
async function seedPriceAgreed(tx: Prisma.TransactionClient, publicationId: string) {
  const c = await tx.channelCopy.findUnique({
    where: { publicationId },
    select: { fingerprints: true, agreed: true, price: true, installments: true, discount: true },
  });
  if (!c) return;
  const { channel, agreed } = storedPrints(c);
  await tx.channelCopy.update({
    where: { publicationId },
    data: {
      fingerprints: { ...channel },
      agreed: {
        ...agreed,
        price: agreed.price ?? fingerprint('price', priceText(c.price)),
        installments: agreed.installments ?? fingerprint('installments', installmentsText(c.installments)),
        discount: agreed.discount ?? fingerprint('discount', discountText(c.discount)),
      },
    },
  });
}

/**
 * Guarda el precio de una pestaña del paso Precio: la decisión con el margen
 * que deja el costo de sus medidas, y el precio, las cuotas y el descuento en
 * el borrador de cada una de sus publicaciones, para subirlos desde Por subir.
 * La publicación es cualquiera de la pestaña. El costo sale de Costo y Stock;
 * los parámetros propios son del producto. Si el margen queda debajo del
 * mínimo, hay que confirmarlo. En una familia, las medidas de la pestaña de la
 * principal llevan el precio de la familia y las demás el suyo.
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
    overrides: Partial<PricingParams>;
    confirmBelowMin: boolean;
    now?: Date;
  },
) {
  if (!(args.listPrice > 0)) throw new PricingError('Cargá el precio publicado.');
  if (!(args.discountPct >= 0 && args.discountPct < 100)) throw new PricingError('El descuento va de 0 a 99 %.');
  if (!isInstallmentPlan(args.plan)) throw new PricingError('Las cuotas son sin cuotas, la cuota promocionada, 3, 6, 9 o 12.');
  const plan: InstallmentPlan = args.plan;
  const listPrice = Math.round(args.listPrice);
  const discountPct = Math.round(args.discountPct * 100) / 100;

  return db.$transaction(async (tx) => {
    const found = await tx.publication.findFirst({
      where: { id: args.publicationId, product: { accountId: args.accountId } },
      select: { id: true, productId: true, family: { select: { leadId: true } }, store: { select: { channel: { select: { kind: true, name: true } } } } },
    });
    if (!found) throw new PricingError('La publicación no existe en esta cuenta.');
    await lockFamily(tx, found.id);
    const group = (await priceGroups(tx, found.id)).find((g) => g.publicationIds.includes(found.id))!;
    if (group.cost === null) {
      const which = group.missing.length > 0 && group.measures.length > 0 ? ` de ${measuresText(group.missing)}` : '';
      throw new PricingError(`Cargá el costo de reposición sin IVA${which} en la pestaña Costo y Stock del producto.`);
    }
    const cost = group.cost;
    const range = getChannelPublisher(found.store.channel.kind)?.discountRange;
    if (range && discountPct > 0 && (discountPct < range.min || discountPct > range.max)) {
      throw new PricingError(`${getChannelAdapter(found.store.channel.kind, found.store.channel.name).name} acepta descuentos de ${range.min} a ${range.max} %, o sin descuento.`);
    }
    const settings = await tx.pricingSettings.findUnique({ where: { accountId: args.accountId }, select: { values: true } });
    const params = resolvePricing(settings?.values, args.overrides);
    if (installmentCostPct(params, plan) === null) throw new PricingError(`Cargá el costo de ${planLabel(plan).toLowerCase()} en Ajustes > Precios para usarla.`);
    const s = simulate({ listPrice, discountPct, plan, cost, params });
    const below = s.marginPct < params.minMarginPct - 1e-9;
    if (below && !args.confirmBelowMin) {
      throw new PricingError(
        `El margen queda en ${s.marginPct.toFixed(1).replace('.', ',')} %, debajo del mínimo de ${String(params.minMarginPct).replace('.', ',')} %. Confirmalo para guardarlo igual.`,
      );
    }

    await tx.product.update({ where: { id: found.productId }, data: { pricingOverrides: args.overrides as Prisma.InputJsonValue } });
    const data = {
      listPrice,
      discountPct,
      installments: plan,
      finalPrice: Math.round(s.finalPrice * 100) / 100,
      cost,
      marginPct: Math.round(s.marginPct * 100) / 100,
      minMarginPct: params.minMarginPct,
      params: params as unknown as Prisma.InputJsonValue,
      belowMinConfirmed: below,
      decidedById: args.userId,
      ...(args.now ? { decidedAt: args.now } : {}),
    };
    // Cada publicación de la pestaña guarda la decisión, así su paso Publicación la ve.
    let decision: { id: string; decidedAt: Date } | null = null;
    for (const id of group.publicationIds) {
      const d = await tx.priceDecision.create({ data: { publicationId: id, ...data }, select: { id: true, decidedAt: true } });
      if (id === group.anchorId) decision = d;
    }
    // El precio, las cuotas y el descuento pasan al borrador de cada medida de la pestaña.
    for (const id of group.publicationIds) await seedPriceAgreed(tx, id);
    const family = found.family?.leadId ? { ownPrice: !group.publicationIds.includes(found.family.leadId) } : {};
    await tx.publication.updateMany({ where: { id: { in: group.publicationIds } }, data: { price: listPrice, installments: plan, discount: discountPct, ...family } });
    return { id: decision!.id, decidedAt: decision!.decidedAt, simulation: s, belowMin: below };
  });
}
