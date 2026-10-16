'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { getChannelAdapter } from '@/channels';
import { applyRows, previewRows, rowsInputSchema, undoImportRun, type RowPreview } from '@/importers/apply';
import type { ExistingKeys } from '@/importers/classify';
import { isConfidentialHeader, isFieldKey } from '@/importers/fields';

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function accountIdFor(slug: string): Promise<string | null> {
  const account = await prisma.account.findUnique({ where: { slug }, select: { id: true } });
  return account?.id ?? null;
}

async function storeFor(accountId: string, storeId: string) {
  return prisma.store.findFirst({ where: { id: storeId, accountId }, include: { channel: true } });
}

/** Qué IDs y SKU ya existen, para que la revisión muestre qué va a pasar. */
export async function lookupExistingAction(
  accountSlug: string,
  storeId: string,
  keys: { externalIds: string[]; skus: string[] },
): Promise<Result<{ existing: ExistingKeys }>> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  const store = await storeFor(accountId, storeId);
  if (!store) return { ok: false, error: 'La tienda no existe en esta cuenta.' };

  const externalIds = [...new Set(keys.externalIds)].slice(0, 20000);
  const skus = [...new Set(keys.skus.map((s) => s.toUpperCase()))].slice(0, 50000);

  const pubs = await prisma.publication.findMany({
    where: { storeId, externalId: { in: externalIds } },
    select: { externalId: true },
  });

  const variants = skus.length
    ? await prisma.$queryRaw<{ sku: string; has_null_pub: boolean }[]>`
        SELECT upper(v.sku) AS sku,
               bool_or(p.id IS NOT NULL) AS has_null_pub
        FROM product_variants v
        JOIN products pr ON pr.id = v."productId" AND pr."accountId" = ${accountId}
        LEFT JOIN publications p ON p."productId" = pr.id AND p."storeId" = ${storeId} AND p."externalId" IS NULL
        WHERE upper(v.sku) = ANY(${skus})
        GROUP BY upper(v.sku)`
    : [];

  return {
    ok: true,
    existing: {
      externalIds: pubs.map((p) => p.externalId!).filter(Boolean),
      skus: Object.fromEntries(variants.map((v) => [v.sku, { hasPublicationWithoutId: v.has_null_pub }])),
    },
  };
}

/** Qué cambiaría en lo que ya está en la app, por tandas de filas. No guarda nada. */
export async function previewUpdatesAction(
  accountSlug: string,
  storeId: string,
  rawRows: unknown,
): Promise<Result<{ previews: RowPreview[] }>> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  const store = await storeFor(accountId, storeId);
  if (!store) return { ok: false, error: 'La tienda no existe en esta cuenta.' };
  const rows = rowsInputSchema.safeParse(rawRows);
  if (!rows.success) return { ok: false, error: 'Las filas que llegaron no tienen la forma esperada.' };

  const previews = await previewRows(
    prisma,
    { accountId, storeId: store.id, adapter: getChannelAdapter(store.channel.kind, store.channel.name) },
    rows.data,
  );
  return { ok: true, previews };
}

const mappingSchema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre para la relación.').max(120),
  headers: z.array(z.string().max(300)).max(500),
  fields: z.record(z.string().max(300), z.string().nullable()),
});

/** Guarda la relación de columnas. Si ya hay una con ese nombre, la reemplaza. */
export async function saveMappingAction(
  accountSlug: string,
  input: z.input<typeof mappingSchema>,
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = mappingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };

  // Solo se guardan campos válidos y nunca una columna confidencial.
  const fields: Record<string, string> = {};
  for (const [header, field] of Object.entries(parsed.data.fields)) {
    if (isConfidentialHeader(header)) continue;
    fields[header] = field && isFieldKey(field) ? field : '';
  }
  const saved = await prisma.importMapping.upsert({
    where: { accountId_name: { accountId, name: parsed.data.name } },
    create: { accountId, name: parsed.data.name, headers: parsed.data.headers, fields, createdById: user.id },
    update: { headers: parsed.data.headers, fields },
    select: { id: true },
  });
  return { ok: true, id: saved.id };
}

const startSchema = z.object({
  storeId: z.string().min(1),
  fileName: z.string().trim().min(1).max(300),
  sheetName: z.string().trim().min(1).max(300),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de los datos no es válida.'),
  mappingId: z.string().nullable(),
  rowsTotal: z.number().int().min(1).max(20000),
  updateMode: z.enum(['FILL_EMPTY', 'REPLACE']),
});

export async function startImportAction(
  accountSlug: string,
  input: z.input<typeof startSchema>,
): Promise<Result<{ runId: string }>> {
  const user = await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
  const store = await storeFor(accountId, parsed.data.storeId);
  if (!store) return { ok: false, error: 'La tienda no existe en esta cuenta.' };

  const mapping = parsed.data.mappingId
    ? await prisma.importMapping.findFirst({ where: { id: parsed.data.mappingId, accountId }, select: { id: true } })
    : null;
  const run = await prisma.importRun.create({
    data: {
      accountId,
      storeId: store.id,
      mappingId: mapping?.id ?? null,
      userId: user.id,
      fileName: parsed.data.fileName,
      sheetName: parsed.data.sheetName,
      dataDate: new Date(`${parsed.data.dataDate}T00:00:00Z`),
      rowsTotal: parsed.data.rowsTotal,
      updateMode: parsed.data.updateMode,
    },
    select: { id: true },
  });
  return { ok: true, runId: run.id };
}

const MAX_SAVED_ERRORS = 200;

/** Importa una tanda de filas y suma los resultados a la importación. */
export async function importBatchAction(
  accountSlug: string,
  runId: string,
  rawRows: unknown,
): Promise<Result<{ processed: number; errors: { row: number; message: string }[] }>> {
  const user = await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  const run = await prisma.importRun.findFirst({
    where: { id: runId, accountId },
    include: { store: { include: { channel: true } } },
  });
  if (!run) return { ok: false, error: 'La importación no existe.' };
  if (run.status !== 'RUNNING') return { ok: false, error: 'Esta importación ya terminó.' };

  const rows = rowsInputSchema.safeParse(rawRows);
  if (!rows.success) return { ok: false, error: 'Las filas que llegaron no tienen la forma esperada.' };

  const result = await applyRows(
    prisma,
    {
      accountId,
      storeId: run.storeId,
      adapter: getChannelAdapter(run.store.channel.kind, run.store.channel.name),
      runId: run.id,
      userId: user.id,
      dataDate: run.dataDate,
      mode: run.updateMode,
    },
    rows.data,
  );

  const previous = Array.isArray(run.errors) ? (run.errors as { row: number; message: string }[]) : [];
  await prisma.importRun.update({
    where: { id: run.id },
    data: {
      rowsProcessed: { increment: result.processed },
      productsCreated: { increment: result.productsCreated },
      publicationsCreated: { increment: result.publicationsCreated },
      publicationsLinked: { increment: result.publicationsLinked },
      publicationsExisting: { increment: result.publicationsExisting },
      publicationsUpdated: { increment: result.publicationsUpdated },
      fieldsChanged: { increment: result.fieldsChanged },
      measurementsSaved: { increment: result.measurementsSaved },
      rowsWithErrors: { increment: result.errors.length },
      errors: [...previous, ...result.errors].slice(0, MAX_SAVED_ERRORS),
    },
  });
  return { ok: true, processed: result.processed, errors: result.errors };
}

export type RunTotals = {
  productsCreated: number;
  publicationsCreated: number;
  publicationsLinked: number;
  publicationsExisting: number;
  publicationsUpdated: number;
  fieldsChanged: number;
  measurementsSaved: number;
  rowsWithErrors: number;
};

export async function finishImportAction(
  accountSlug: string,
  runId: string,
  failed = false,
): Promise<Result<{ run: RunTotals }>> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  const run = await prisma.importRun.findFirst({ where: { id: runId, accountId } });
  if (!run) return { ok: false, error: 'La importación no existe.' };
  const updated = await prisma.importRun.update({
    where: { id: run.id },
    data: { status: failed ? 'FAILED' : 'DONE', finishedAt: new Date() },
  });
  revalidatePath(`/a/${accountSlug}/productos`);
  revalidatePath(`/a/${accountSlug}/publicaciones`);
  revalidatePath(`/a/${accountSlug}/importar`);
  return { ok: true, run: updated };
}

export async function undoImportAction(accountSlug: string, runId: string): Promise<Result> {
  await requireUser();
  const accountId = await accountIdFor(accountSlug);
  if (!accountId) return { ok: false, error: 'La cuenta no existe.' };
  try {
    await undoImportRun(prisma, { runId, accountId });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo deshacer.' };
  }
  revalidatePath(`/a/${accountSlug}/productos`);
  revalidatePath(`/a/${accountSlug}/publicaciones`);
  revalidatePath(`/a/${accountSlug}/importar`);
  return { ok: true };
}
