import { can, canSeeAccount } from '@/domain/access';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/auth/session';

// Los archivos, las fotos y los videos de un producto se sirven por la app: solo
// a quien ve la cuenta del producto y alguna sección donde se usan.

export async function canSeeProduct(user: CurrentUser, productId: string | null | undefined): Promise<boolean> {
  if (!productId) return false;
  if (user.isAdmin) return true;
  if (!can(user.access, ['productos', 'pipeline', 'publicaciones'], 'read')) return false;
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { accountId: true } });
  return Boolean(p && canSeeAccount(user.access, p.accountId));
}
