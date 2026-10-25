import { cache } from 'react';
import { prisma } from '@/lib/db';
import { canSeeAccount, type Access } from '@/domain/access';

export const listAccounts = cache(async () =>
  prisma.account.findMany({ orderBy: { name: 'asc' }, select: { id: true, slug: true, name: true, timezone: true } }),
);

/** Las cuentas que ve la persona. */
export async function visibleAccounts(access: Access) {
  const all = await listAccounts();
  return all.filter((a) => canSeeAccount(access, a.id));
}

export const getAccountBySlug = cache(async (slug: string) =>
  prisma.account.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, timezone: true } }),
);
