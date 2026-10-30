import { prisma } from '@/lib/db';
import { productCode } from '@/lib/publication-facts';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { faceSummary, faceValues, fingerprintsOf } from '@/domain/channel-sync';
import { LATEST_MEASUREMENTS, latestMetrics } from '@/domain/measurements';
import { parseVariations } from '@/domain/media';
import { channelQuantities, totalQuantity } from '@/domain/quantities';
import { resolveTitleLock } from '@/domain/title-lock';
import { FAMILY_LOCK_SELECT, titleLockFromData } from '@/lib/family-lock';
import { measuresOf } from '@/lib/media';
import { scorePublication, type RuleConfig, type ScoreResult } from '@/domain/standard';
import { toScoreInput } from './score-input';

export { toScoreInput } from './score-input';

// Arma lo que necesita el puntaje y lo calcula. El puntaje no se guarda:
// se calcula cada vez, con las reglas y los datos de ese momento.

export async function loadRulesByChannel(accountId: string, db: PrismaClient = prisma): Promise<Map<string, RuleConfig[]>> {
  const rules = await db.standardRule.findMany({
    where: { accountId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  const byChannel = new Map<string, RuleConfig[]>();
  for (const r of rules) {
    const list = byChannel.get(r.channelId) ?? [];
    list.push(r);
    byChannel.set(r.channelId, list);
  }
  return byChannel;
}

export type ScoredPublication = Awaited<ReturnType<typeof listScoredPublications>>[number];

export async function listScoredPublications(
  accountId: string,
  where: Prisma.PublicationWhereInput = {},
  db: PrismaClient = prisma,
) {
  const [rules, publications] = await Promise.all([
    loadRulesByChannel(accountId, db),
    db.publication.findMany({
      where: { ...where, product: { accountId } },
      select: {
        id: true,
        title: true,
        description: true,
        attributes: true,
        media: true,
        price: true,
        installments: true,
        discount: true,
        quantities: true,
        externalId: true,
        url: true,
        channelStatus: true,
        stage: true,
        pipelineStatus: true,
        pipelineStep: true,
        variantKey: true,
        pipelineRemoval: true,
        titleLockedManual: true,
        updatedAt: true,
        store: { select: { name: true, channelId: true, channel: { select: { kind: true, name: true } } } },
        measurements: { orderBy: { takenAt: 'desc' }, take: LATEST_MEASUREMENTS, select: { takenAt: true, metrics: true } },
        // La familia de medidas: su principal, sus medidas y sus ventas, para el candado del título.
        family: {
          select: {
            leadId: true,
            ...FAMILY_LOCK_SELECT.select,
            members: { select: { ...FAMILY_LOCK_SELECT.select.members.select, variantKey: true, externalId: true } },
          },
        },
        channelCopy: {
          select: {
            fingerprints: true,
            agreed: true,
            rejections: true,
            missingSince: true,
            price: true,
            installments: true,
            discount: true,
            quantity: true,
            variations: true,
            stockInChannel: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            kind: true,
            productType: true,
            warranty: true,
            kitContents: true,
            partNumber: true,
            specs: true,
            variants: { select: { measure: true, sku: true }, orderBy: { position: 'asc' } },
            compatibilities: { select: { vehicleBrand: true, model: true, engine: true } },
            assets: { select: { kind: true } },
          },
        },
      },
    }),
  ]);

  return publications.map((p) => {
    const result: ScoreResult = scorePublication(rules.get(p.store.channelId) ?? [], toScoreInput(p.product, p));
    const metrics = latestMetrics(p.measurements);
    const channel = getChannelAdapter(p.store.channel.kind, p.store.channel.name);
    const copy = p.channelCopy && !p.channelCopy.missingSince ? p.channelCopy : null;
    const app = faceValues(p);
    const faces = faceSummary(fingerprintsOf(app), copy);
    const lines = copy ? channelQuantities(copy.quantity, parseVariations(copy.variations)) : null;
    // Las medidas que vende, en el orden de la ficha: las de su familia, la suya, o si no se
    // sabe cuál vende, todas las del producto.
    const productMeasures = measuresOf(p.product.variants);
    const sold = p.family ? p.family.members.map((m) => m.variantKey) : p.variantKey ? [p.variantKey] : null;
    const selling = sold ? productMeasures.filter((m) => sold.includes(m.key)) : productMeasures;
    // Un solo SKU sin nombre de medida no es una medida: sería repetir el código.
    const measures = selling.length === 1 && !selling[0].measure ? [] : selling.map((m) => m.label);
    return {
      id: p.id,
      title: p.title,
      productId: p.product.id,
      productName: p.product.name,
      externalId: p.externalId,
      url: p.url,
      skus: p.product.variants.map((v) => v.sku).filter((s): s is string => Boolean(s)),
      // El código con que se nombra el producto, por ejemplo SP-808.
      code: productCode(p.product),
      storeName: p.store.name,
      channelName: channel.name,
      channelAccent: channel.accent,
      channelStatus: p.channelStatus,
      stage: p.stage,
      pipelineStatus: p.pipelineStatus,
      pipelineStep: p.pipelineStep,
      pipelineRemoval: p.pipelineRemoval,
      titleLock: resolveTitleLock(titleLockFromData(channel, p), p.titleLockedManual, Boolean(p.externalId)),
      // La familia de medidas: la principal, que la representa en el tablero, y cuántas medidas tiene.
      familyLeadId: p.family?.leadId ?? null,
      familySize: p.family?.members.length ?? 0,
      // Los códigos de las otras medidas de su familia: la tarjeta del tablero se encuentra por cualquiera.
      familyCodes: p.family?.members.map((m) => m.externalId).filter((c): c is string => Boolean(c)) ?? [],
      measures,
      productType: p.product.productType?.trim() || null,
      kind: p.product.kind,
      visits: typeof metrics.visits_90d === 'number' ? metrics.visits_90d : null,
      sales: typeof metrics.sales_90d === 'number' ? metrics.sales_90d : null,
      score: result.score,
      missing: result.missing,
      // Cómo está frente a lo que se leyó del canal.
      sync: { read: copy !== null, draft: faces.draft.length > 0, choose: faces.choose.length > 0, rejected: faces.rejected.length > 0 },
      stock: copy?.quantity ?? null,
      // La cantidad: la del canal, la que falta subir y en cuántas medidas.
      quantity: {
        channel: copy?.quantity ?? null,
        draft: app.quantity ? totalQuantity(app.quantity) : null,
        measures: lines?.length ?? 0,
        inChannel: copy?.stockInChannel ?? false,
      },
    };
  });
}
