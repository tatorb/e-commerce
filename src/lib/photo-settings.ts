import type { PrismaClient } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import {
  DEFAULT_PHOTO_SETTINGS,
  parsePhotoSettings,
  photoSettingsSchema,
  type PhotoSettingsInput,
  type PhotoSettingsValues,
} from '@/domain/photo-settings';

// Los ajustes de la línea de imágenes de cada cuenta, que se editan en
// Ajustes, Imágenes. Cada paso guarda una copia de los que usó.

export class PhotoSettingsError extends Error {}

type Db = PrismaClient | Prisma.TransactionClient;

/** Los ajustes de la cuenta, o los de siempre si no cargó ninguno. */
export async function loadPhotoSettings(db: Db, accountId: string): Promise<PhotoSettingsValues> {
  const row = await db.photoSettings.findUnique({ where: { accountId } });
  return row ? parsePhotoSettings(row.values) : DEFAULT_PHOTO_SETTINGS;
}

export async function savePhotoSettings(db: PrismaClient, args: { accountId: string; userId: string | null; input: PhotoSettingsInput }) {
  const parsed = photoSettingsSchema.safeParse(args.input);
  if (!parsed.success) throw new PhotoSettingsError(parsed.error.issues[0]?.message ?? 'Revisá los valores.');
  const values = parsed.data as unknown as Prisma.InputJsonValue;
  await db.photoSettings.upsert({
    where: { accountId: args.accountId },
    update: { values, updatedById: args.userId },
    create: { accountId: args.accountId, values, updatedById: args.userId },
  });
}

export async function resetPhotoSettings(db: PrismaClient, accountId: string) {
  await db.photoSettings.deleteMany({ where: { accountId } });
}
