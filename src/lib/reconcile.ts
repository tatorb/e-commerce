import type { PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { getChannelListings, LISTINGS_BATCH, type ChannelListing } from '@/channels/listings';
import { jumpToStep } from '@/domain/pipeline';
import { reconcileMeasure, type Finding, type ReconcileOption } from '@/domain/reconcile';
import { planLabel } from '@/domain/pricing';
import { measuresOf } from '@/lib/media';
import { withAccessToken } from '@/lib/connections';
import { readOne } from '@/lib/channel-sync';
import { assignSaleOptions, setMainOption } from '@/lib/sale-options';
import { createTask } from '@/lib/tasks';

// La reconciliación de las opciones de venta con el canal. Por cada medida
// conocida le pide al canal todas sus publicaciones vivas, las compara con las
// de la app y dice qué encuentra. Con apply, además lo hace: suma las que
// faltan, pasa la principal al código vivo, crea las tareas y vuelve al paso
// Información las que hay que corregir. No sube nada al canal: lo que queda
// distinto aparece en Por subir. Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

// Cuántas medidas se revisan por pedido: cada una es una consulta al canal.
const MEASURES_PER_RUN = 40;

export type ReconcileOptionView = {
  externalId: string;
  status: string;
  statusReason: string | null;
  plan: string;
  price: number | null;
  main: boolean;
  inApp: boolean;
};

export type MeasureReport = {
  channelProductId: string;
  product: string;
  measure: string | null;
  options: ReconcileOptionView[];
  findings: (Finding & { done?: string; failed?: string })[];
};

export type ReconcileReport = {
  checked: number;
  measures: MeasureReport[];
  // Las que quedaron para el pedido siguiente.
  remaining: number;
  // Las medidas que el canal no devolvió.
  unread: string[];
};

const optionPlan = (plan: number | null) => (plan === null ? 'sin leer' : planLabel(plan));

/**
 * Revisa las medidas de la cuenta, o solo las de esas publicaciones. Sin
 * apply solo muestra; con apply hace los cambios en la app.
 */
export async function reconcile(
  db: Db,
  args: { accountId: string; publicationIds?: string[]; apply: boolean; userId: string; from?: number; now?: Date },
): Promise<ReconcileReport> {
  const stores = await db.store.findMany({
    where: { accountId: args.accountId, connection: { is: { status: 'ACTIVE' } } },
    select: { id: true, channel: { select: { kind: true, name: true } } },
  });
  const report: ReconcileReport = { checked: 0, measures: [], remaining: 0, unread: [] };
  let skip = args.from ?? 0;
  let budget = MEASURES_PER_RUN;

  for (const store of stores) {
    const listings = getChannelListings(store.channel.kind);
    if (!listings?.listOptions) continue;
    const rows = await loadRows(db, store.id);
    const wanted = args.publicationIds ? rows.filter((r) => args.publicationIds!.includes(r.id)) : rows;
    const productIds = [...new Set(wanted.map((r) => r.channelProductId).filter((c): c is string => Boolean(c)))].sort();
    // Las que ya se revisaron en pedidos anteriores.
    const pending = productIds.slice(Math.min(skip, productIds.length));
    skip = Math.max(0, skip - productIds.length);
    const now = pending.slice(0, budget);
    report.remaining += pending.length - now.length;
    budget -= now.length;
    if (now.length === 0) continue;

    const read = await withAccessToken(db, store.id, async (token, userId) => {
      const options = await listings.listOptions!(token, userId, now);
      const known = new Set(rows.map((r) => r.externalId));
      const unknown = [...new Set([...options.values()].flat())].filter((id) => !known.has(id));
      const found: ChannelListing[] = [];
      for (let i = 0; i < unknown.length; i += LISTINGS_BATCH) {
        found.push(...(await listings.readListings(token, userId, unknown.slice(i, i + LISTINGS_BATCH))).listings);
      }
      return { options, found: new Map(found.map((l) => [l.externalId, l])) };
    });

    for (const productId of now) {
      report.checked++;
      const inApp = rows.filter((r) => r.channelProductId === productId);
      const codes = read.options.get(productId);
      if (!codes) {
        report.unread.push(productId);
        continue;
      }
      const mainId = inApp.find((r) => !r.mainOptionId)?.id ?? inApp[0]?.id ?? null;
      const fresh = codes.filter((c) => !inApp.some((r) => r.externalId === c)).flatMap((c) => read.found.get(c) ?? []);
      const options: ReconcileOption[] = [
        ...inApp.map((r) => ({
          id: r.id,
          externalId: r.externalId,
          status: r.status,
          statusReason: r.statusReason,
          plan: r.plan,
          price: r.price,
          main: r.id === mainId,
          needsFix: r.needsFix,
          blocked: r.blocked,
        })),
        ...fresh.map((l) => ({
          id: null,
          externalId: l.externalId,
          status: l.status,
          statusReason: l.statusReason ?? null,
          plan: l.installments,
          price: l.price,
          main: false,
          needsFix: l.statusNeedsFix ?? false,
          blocked: l.statusBlocked ?? false,
        })),
      ];
      const findings = reconcileMeasure(options);
      if (findings.length === 0) continue;
      const first = inApp[0];
      const entry: MeasureReport = {
        channelProductId: productId,
        product: first?.productName ?? '',
        measure: first?.measure ?? null,
        options: options.map((o) => ({
          externalId: o.externalId,
          status: o.status,
          statusReason: o.statusReason,
          plan: optionPlan(o.plan),
          price: o.price,
          main: o.main,
          inApp: o.id !== null,
        })),
        findings,
      };
      if (args.apply && first) await applyFindings(db, { accountId: args.accountId, userId: args.userId, channelName: getChannelAdapter(store.channel.kind, store.channel.name).name, mainId, inApp, fresh, entry });
      report.measures.push(entry);
    }
    if (args.apply) await assignSaleOptions(db, store.id);
  }
  return report;
}

type Row = Awaited<ReturnType<typeof loadRows>>[number];

async function loadRows(db: Db, storeId: string) {
  const rows = await db.publication.findMany({
    where: { storeId, externalId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      externalId: true,
      productId: true,
      familyId: true,
      variantKey: true,
      mainOptionId: true,
      pipelineStatus: true,
      pipelineStep: true,
      channelStatus: true,
      price: true,
      installments: true,
      product: { select: { name: true, variants: { select: { sku: true, measure: true } } } },
      channelCopy: { select: { channelProductId: true, status: true, statusReason: true, statusNeedsFix: true, statusBlocked: true, installments: true, price: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    externalId: r.externalId!,
    productId: r.productId,
    productName: r.product.name,
    familyId: r.familyId,
    variantKey: r.variantKey,
    measure: r.variantKey ? (measuresOf(r.product.variants).find((m) => m.key === r.variantKey)?.label ?? null) : null,
    mainOptionId: r.mainOptionId,
    pipelineStatus: r.pipelineStatus,
    pipelineStep: r.pipelineStep,
    channelProductId: r.channelCopy?.channelProductId ?? null,
    status: r.channelCopy?.status ?? r.channelStatus,
    statusReason: r.channelCopy?.statusReason ?? null,
    needsFix: r.channelCopy?.statusNeedsFix ?? false,
    blocked: r.channelCopy?.statusBlocked ?? false,
    plan: r.channelCopy?.installments ?? r.installments ?? null,
    price: r.channelCopy?.price != null ? Number(r.channelCopy.price) : r.price != null ? Number(r.price) : null,
  }));
}

/** Hace en la app lo que encontró: cada hallazgo queda con lo que se hizo o por qué no. */
async function applyFindings(
  db: Db,
  args: { accountId: string; userId: string; channelName: string; mainId: string | null; inApp: Row[]; fresh: ChannelListing[]; entry: MeasureReport },
) {
  const base = args.inApp.find((r) => r.id === args.mainId) ?? args.inApp[0];
  const idOf = new Map(args.inApp.map((r) => [r.externalId, r.id]));
  for (const f of args.entry.findings) {
    try {
      if (f.kind === 'new_option') {
        const l = args.fresh.find((x) => x.externalId === f.codes[0]);
        if (!l) continue;
        const created = await db.publication.create({
          data: {
            productId: base.productId,
            storeId: (await db.publication.findUniqueOrThrow({ where: { id: base.id }, select: { storeId: true } })).storeId,
            externalId: l.externalId,
            url: l.url,
            title: l.title,
            variantKey: base.variantKey,
            familyId: base.familyId,
            mainOptionId: base.id,
            channelStatus: l.status,
            source: 'IMPORT',
          },
          select: { id: true },
        });
        idOf.set(l.externalId, created.id);
        await readOne(db, { accountId: args.accountId, publicationId: created.id });
        f.done = `Se sumó ${l.externalId} a la app como opción de venta.`;
      } else if (f.kind === 'switch_main' && f.to) {
        const to = idOf.get(f.to);
        if (!to) throw new Error(`${f.to} todavía no está en la app.`);
        const r = await setMainOption(db, { accountId: args.accountId, publicationId: base.id, mainId: to, userId: args.userId, reason: f.text });
        f.done = r.changed ? `La principal pasó de ${r.from} a ${r.to}. Lo que tenía la app queda en Por subir para ${r.to}.` : 'Ya era la principal.';
      } else if (f.kind === 'no_replacement' || f.kind === 'needs_fix') {
        const id = idOf.get(f.codes[0]);
        if (!id) continue;
        const task = await createTask(db, {
          accountId: args.accountId,
          actorId: args.userId,
          input: {
            title: f.kind === 'no_replacement' ? `¿Volver a publicar ${f.codes[0]}?` : `Revisar ${f.codes[0]} en ${args.channelName}`,
            description: f.text,
            remindAt: null,
            dueOn: null,
            assigneeIds: [],
            publicationIds: [id],
          },
        });
        f.done = `Se creó la tarea «${task.title}».`;
        const row = args.inApp.find((r) => r.id === id);
        if (f.kind === 'needs_fix' && row?.pipelineStatus === 'IN_PIPELINE' && row.pipelineStep && row.pipelineStep !== 'INFO') {
          const step = row.pipelineStep;
          await db.$transaction((tx) => jumpToStep(tx, { publicationId: id, expected: step, to: 'INFO', userId: args.userId }));
          f.done += ' Volvió al paso Información.';
        }
      }
    } catch (e) {
      f.failed = e instanceof Error ? e.message : 'No se pudo.';
    }
  }
}
