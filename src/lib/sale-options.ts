import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ChannelStatus } from '@/generated/prisma/enums';
import { planLabel } from '@/domain/pricing';
import { planMainOptions, samePlanOptions } from '@/domain/sale-options';

// Las opciones de venta de cada medida, con lo leído del canal: cuál es la
// principal y a cuál apuntan las demás. Corre al final de cada lectura de la
// tienda. No sube nada al canal. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

/** Agrupa las publicaciones de la tienda por su medida en el canal. Devuelve cuántas cambiaron. */
export async function assignSaleOptions(db: Db, storeId: string): Promise<number> {
  const rows = await db.publication.findMany({
    where: { storeId },
    select: {
      id: true,
      mainOptionId: true,
      pipelineStatus: true,
      createdAt: true,
      leadOf: { select: { id: true } },
      channelCopy: { select: { channelProductId: true, status: true } },
    },
  });
  const changes = planMainOptions(
    rows.map((r) => ({
      id: r.id,
      channelProductId: r.channelCopy?.channelProductId ?? null,
      mainOptionId: r.mainOptionId,
      status: r.channelCopy?.status ?? null,
      pipelineStatus: r.pipelineStatus,
      familyLead: r.leadOf !== null,
      createdAt: r.createdAt,
    })),
  );
  if (changes.size === 0) return 0;
  // Primero las que pasan a ser principales, así ninguna apunta a otra que todavía apunta a una tercera.
  const ordered = [...changes.entries()].sort((a, b) => Number(a[1] !== null) - Number(b[1] !== null));
  await db.$transaction(ordered.map(([id, mainOptionId]) => db.publication.update({ where: { id }, data: { mainOptionId } })));
  return changes.size;
}

// ───────────────────────────── Las opciones de una medida ─────────────────────────────

export type SaleOption = {
  id: string;
  externalId: string | null;
  url: string | null;
  // La forma de cobro: 0 sin cuotas, 1 la cuota promocionada, o la cantidad de cuotas. Null si no se leyó.
  plan: number | null;
  planLabel: string;
  // El precio publicado y el descuento, como se leyeron del canal.
  price: number | null;
  discount: number | null;
  status: ChannelStatus;
  statusReason: string | null;
  main: boolean;
};

export type SaleOptions = {
  mainId: string;
  options: SaleOption[];
  // Las formas de cobro repetidas entre opciones vivas: el canal apaga una.
  samePlan: { plan: number; label: string; codes: string[] }[];
};

/** Las opciones de venta de la medida de una publicación, la principal primero. Null si es la única. */
export async function loadSaleOptions(db: Db, publicationId: string): Promise<SaleOptions | null> {
  const p = await db.publication.findUnique({ where: { id: publicationId }, select: { id: true, mainOptionId: true } });
  if (!p) return null;
  const mainId = p.mainOptionId ?? p.id;
  const rows = await db.publication.findMany({
    where: { OR: [{ id: mainId }, { mainOptionId: mainId }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      externalId: true,
      url: true,
      channelStatus: true,
      installments: true,
      channelCopy: { select: { installments: true, price: true, discount: true, status: true, statusReason: true, url: true } },
    },
  });
  if (rows.length < 2) return null;
  const options = rows
    .map((r): SaleOption => {
      const plan = r.channelCopy?.installments ?? r.installments ?? null;
      return {
        id: r.id,
        externalId: r.externalId,
        url: r.channelCopy?.url ?? r.url,
        plan,
        planLabel: plan === null ? 'Forma de cobro sin leer' : planLabel(plan),
        price: r.channelCopy?.price != null ? Number(r.channelCopy.price) : null,
        discount: r.channelCopy?.discount != null ? Number(r.channelCopy.discount) : null,
        status: r.channelCopy?.status ?? r.channelStatus,
        statusReason: r.channelCopy?.statusReason ?? null,
        main: r.id === mainId,
      };
    })
    .sort((a, b) => Number(b.main) - Number(a.main));
  const samePlan = samePlanOptions(options.map((o) => ({ ...o, installments: o.plan }))).map((d) => ({
    plan: d.plan,
    label: d.label,
    codes: d.options.map((o) => o.externalId ?? o.id),
  }));
  return { mainId, options, samePlan };
}

// ───────────────────────────── Cambiar la principal ─────────────────────────────

export class SaleOptionError extends Error {}

// El contenido de la app que se trabaja en el pipeline: la principal nueva lo recibe igual.
const CONTENT_FIELDS = [
  'title',
  'description',
  'attributes',
  'faq',
  'answerRules',
  'autoAnswer',
  'channelCategory',
  'media',
  'videoVariants',
  'warranty',
  'titleLockedManual',
] as const satisfies readonly (keyof Prisma.PublicationUncheckedUpdateInput)[];

// Dónde está en el pipeline: se intercambia entre la principal vieja y la nueva.
const PIPELINE_FIELDS = ['pipelineStatus', 'pipelineStep', 'pipelineRemoval', 'stage'] as const;

// Las tablas con el trabajo del pipeline y su historial, de muchas filas por publicación.
const WORK_TABLES = ['price_decisions', 'competitor_listings', 'search_positions', 'title_approvals', 'pipeline_movements', 'stage_movements'] as const;

/**
 * Pasa el trabajo del pipeline de una publicación a otra y al revés: el
 * historial, el título, la descripción propuesta, los precios decididos, la
 * competencia y el paso. Lo que la nueva tenía queda en la vieja, así no se pierde nada.
 */
async function swapWork(tx: Tx, fromId: string, toId: string) {
  for (const table of WORK_TABLES) {
    await tx.$executeRawUnsafe(
      `UPDATE "${table}" SET "publicationId" = CASE WHEN "publicationId" = $1 THEN $2 ELSE $1 END WHERE "publicationId" IN ($1, $2)`,
      fromId,
      toId,
    );
  }
  // Una por publicación: se sacan las dos y se vuelven a poner al revés.
  const [fromTitle, toTitle] = await Promise.all([tx.titleWork.findUnique({ where: { publicationId: fromId } }), tx.titleWork.findUnique({ where: { publicationId: toId } })]);
  await tx.titleWork.deleteMany({ where: { publicationId: { in: [fromId, toId] } } });
  for (const [row, publicationId] of [[fromTitle, toId], [toTitle, fromId]] as const) {
    if (row) await tx.titleWork.create({ data: { ...row, proposalUsage: row.proposalUsage ?? Prisma.DbNull, seeds: row.seeds ?? Prisma.DbNull, publicationId } as Prisma.TitleWorkUncheckedCreateInput });
  }
  const [fromDraft, toDraft] = await Promise.all([
    tx.descriptionDraft.findUnique({ where: { publicationId: fromId } }),
    tx.descriptionDraft.findUnique({ where: { publicationId: toId } }),
  ]);
  await tx.descriptionDraft.deleteMany({ where: { publicationId: { in: [fromId, toId] } } });
  for (const [row, publicationId] of [[fromDraft, toId], [toDraft, fromId]] as const) {
    if (row) await tx.descriptionDraft.create({ data: { ...row, publicationId } as Prisma.DescriptionDraftUncheckedCreateInput });
  }
}

/**
 * Elige otra opción de venta como principal de su medida. Si la vieja tenía el
 * trabajo del pipeline, porque es la principal de su familia o va sin
 * familia, el trabajo pasa a la nueva, con su contenido. Queda en el registro
 * de las dos. No sube nada al canal.
 */
export async function setMainOption(
  db: Db,
  args: { accountId: string; publicationId: string; mainId: string; userId: string | null; reason: string },
): Promise<{ changed: boolean; from: string | null; to: string | null }> {
  return db.$transaction(async (tx) => {
    const target = await tx.publication.findFirst({
      where: { id: args.mainId, product: { accountId: args.accountId } },
      select: { id: true, externalId: true, mainOptionId: true },
    });
    const asked = await tx.publication.findFirst({ where: { id: args.publicationId, product: { accountId: args.accountId } }, select: { id: true, mainOptionId: true } });
    if (!target || !asked) throw new SaleOptionError('La publicación no está en la cuenta.');
    const oldMainId = asked.mainOptionId ?? asked.id;
    if (target.id === oldMainId) return { changed: false, from: target.externalId, to: target.externalId };
    if (target.mainOptionId !== oldMainId) throw new SaleOptionError(`${target.externalId ?? 'Esa publicación'} no es otra opción de venta de la misma medida.`);

    const old = await tx.publication.findUniqueOrThrow({
      where: { id: oldMainId },
      select: { id: true, externalId: true, familyId: true, leadOf: { select: { id: true } }, ...Object.fromEntries([...CONTENT_FIELDS, ...PIPELINE_FIELDS].map((f) => [f, true])) },
    });
    const fresh = await tx.publication.findUniqueOrThrow({ where: { id: target.id }, select: Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, true])) });

    // Las demás opciones apuntan a la nueva, y la nueva a nadie.
    await tx.publication.updateMany({ where: { mainOptionId: oldMainId, id: { not: target.id } }, data: { mainOptionId: target.id } });
    await tx.publication.update({ where: { id: oldMainId }, data: { mainOptionId: target.id } });

    // El trabajo del pipeline vive en la principal de la familia o, sin familia, en la publicación.
    const holdsWork = old.leadOf !== null || old.familyId === null;
    const content = Object.fromEntries(CONTENT_FIELDS.map((f) => [f, (old as Record<string, unknown>)[f] ?? (f === 'videoVariants' ? {} : null)]));
    const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    await tx.publication.update({
      where: { id: target.id },
      data: {
        mainOptionId: null,
        ...content,
        attributes: json(content.attributes) as Prisma.InputJsonValue,
        media: json(content.media),
        videoVariants: (content.videoVariants ?? {}) as Prisma.InputJsonValue,
        warranty: json(content.warranty),
        ...(holdsWork ? Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, (old as Record<string, unknown>)[f]])) : {}),
      } as Prisma.PublicationUncheckedUpdateInput,
    });
    if (holdsWork) {
      await tx.publication.update({ where: { id: oldMainId }, data: Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, fresh[f]])) as Prisma.PublicationUncheckedUpdateInput });
      await swapWork(tx, oldMainId, target.id);
      if (old.leadOf) await tx.listingFamily.update({ where: { id: old.leadOf.id }, data: { leadId: target.id } });
    }
    const change = { field: 'publication', kind: 'MAIN_OPTION_CHANGED' as const, before: { externalId: old.externalId }, after: { externalId: target.externalId }, message: args.reason, userId: args.userId };
    await tx.channelSyncChange.createMany({ data: [oldMainId, target.id].map((publicationId) => ({ publicationId, ...change })) });
    return { changed: true, from: old.externalId, to: target.externalId };
  });
}
