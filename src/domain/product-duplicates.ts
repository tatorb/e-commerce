import type { Prisma } from '@/generated/prisma/client';
import { OptionError } from '@/lib/product-options';

// No puede haber dos productos de lo mismo: la misma marca y el mismo número
// de pieza, sin importar mayúsculas, acentos, espacios, puntos, guiones ni
// barras. Acá se arma esa clave y se busca el que ya existe.

type Tx = Prisma.TransactionClient;

const plain = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[\s._/-]+/g, '');

/** La clave de un producto para saber si ya hay otro igual. Null sin número de pieza: no se puede saber. */
export function productKey(brand: string | null | undefined, partNumber: string | null | undefined): string | null {
  const part = plain(partNumber);
  return part ? `${plain(brand)}|${part}` : null;
}

/** Ya hay otro producto con esa marca y ese número de pieza. Es un error de los datos de la ficha: se muestra donde se muestran esos. */
export class DuplicateProductError extends OptionError {
  constructor(public existing: { id: string; name: string }) {
    super(`Ya hay un producto con esa marca y ese número de pieza: «${existing.name}». No puede haber dos productos de lo mismo: usá ese, o unilos con merge_products.`);
  }
}

/** El producto de la cuenta con la misma marca y número de pieza, si hay. Con varios, el que tiene más publicaciones. */
export async function findSameProduct(tx: Tx, args: { accountId: string; brand: string | null | undefined; partNumber: string | null | undefined; exceptId?: string | null }): Promise<{ id: string; name: string } | null> {
  const key = productKey(args.brand, args.partNumber);
  if (!key) return null;
  // Primero por el número de pieza tal cual o parecido, después se compara la clave entera.
  const rows = await tx.product.findMany({
    where: { accountId: args.accountId, partNumber: { not: null }, ...(args.exceptId ? { id: { not: args.exceptId } } : {}) },
    select: { id: true, name: true, brand: true, partNumber: true, _count: { select: { publications: true } } },
  });
  const same = rows.filter((r) => productKey(r.brand, r.partNumber) === key).sort((a, b) => b._count.publications - a._count.publications);
  return same[0] ? { id: same[0].id, name: same[0].name } : null;
}
