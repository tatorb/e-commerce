import { cache } from 'react';
import { prisma } from '@/lib/db';

export const listAccounts = cache(async () =>
  prisma.account.findMany({ orderBy: { name: 'asc' }, select: { id: true, slug: true, name: true, timezone: true } }),
);

export const getAccountBySlug = cache(async (slug: string) =>
  prisma.account.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, timezone: true } }),
);
