import { prisma } from '@/lib/db';
import { setsText } from '@/domain/stock';
import { PLAN_SELECT, productStockUnits } from '@/lib/stock-plan';
import { UnitsPerSaleField } from './UnitsPerSaleField';

// "Vende de a N" en la ficha de la publicación y en el paso Publicación, con
// lo que alcanza el stock y el campo para cambiarlo.
export async function UnitsPerSaleBlock({ accountSlug, publicationId }: { accountSlug: string; publicationId: string }) {
  const p = await prisma.publication.findUnique({ where: { id: publicationId }, select: { ...PLAN_SELECT, familyId: true, mainOptionId: true } });
  if (!p) return null;
  const mainId = p.mainOptionId ?? p.id;
  const shared = await prisma.publication.count({
    where: p.familyId ? { OR: [{ familyId: p.familyId }, { mainOption: { familyId: p.familyId } }] } : { OR: [{ id: mainId }, { mainOptionId: mainId }] },
  });
  const stock = productStockUnits(p);
  return <UnitsPerSaleField accountSlug={accountSlug} publicationId={p.id} units={p.unitsPerSale} summary={stock === null || p.unitsPerSale === 1 ? null : setsText(stock, p.unitsPerSale)} shared={shared} />;
}
