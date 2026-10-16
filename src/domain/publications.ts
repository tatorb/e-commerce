import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { RecordSource, Stage } from '@/generated/prisma/enums';
import { compactNameValues, nameValueSchema } from './name-value';
import { moveToStage } from './stages';

// Publicación: el producto armado para una tienda. Este módulo no conoce el
// formato de ningún canal: el ID externo y el link llegan ya limpios.

export { CHANNEL_STATUS_LABEL } from './channel-status';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v));

export const publicationDataSchema = z.object({
  externalId: z.string().nullable(),
  url: z.string().nullable(),
  title: text(300),
  description: text(50000),
  attributes: z.array(nameValueSchema).max(300).transform(compactNameValues),
  price: z.number().nonnegative().nullable(),
  channelStatus: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE', 'UNPUBLISHED']),
});

export type PublicationData = z.output<typeof publicationDataSchema>;

export class DuplicateExternalIdError extends Error {
  constructor() {
    super('Ya hay una publicación con ese ID en esta tienda.');
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function toRow(data: PublicationData) {
  return {
    externalId: data.externalId,
    url: data.url,
    title: data.title,
    description: data.description,
    attributes: data.attributes,
    price: data.price === null ? null : new Prisma.Decimal(data.price),
    channelStatus: data.channelStatus,
  };
}

type CreateArgs = {
  productId: string;
  storeId: string;
  data: PublicationData;
  userId: string | null;
  source?: RecordSource;
  importRunId?: string | null;
};

/** Crea la publicación y la deja en la etapa "Importado", con su registro. */
export async function createPublication(db: PrismaClient, args: CreateArgs): Promise<{ id: string }> {
  try {
    return await db.$transaction((tx) => insertPublication(tx, args));
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateExternalIdError();
    throw e;
  }
}

/** Lo mismo que createPublication, dentro de una transacción que ya está abierta. */
export async function insertPublication(tx: Prisma.TransactionClient, args: CreateArgs): Promise<{ id: string }> {
  const publication = await tx.publication.create({
    data: {
      ...toRow(args.data),
      productId: args.productId,
      storeId: args.storeId,
      source: args.source ?? RecordSource.MANUAL,
      importRunId: args.importRunId ?? null,
      stage: Stage.IMPORTED,
    },
    select: { id: true },
  });
  await moveToStage(tx, { publicationId: publication.id, stage: Stage.IMPORTED, userId: args.userId });
  return publication;
}

/** Actualiza los datos de la publicación. No cambia la etapa. */
export async function updatePublication(
  db: PrismaClient,
  args: { publicationId: string; data: PublicationData },
): Promise<void> {
  try {
    await db.publication.update({ where: { id: args.publicationId }, data: toRow(args.data) });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateExternalIdError();
    throw e;
  }
}
