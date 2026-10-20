import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { getChannelAdapter } from '@/channels';
import { parseNameValueList } from '@/domain/name-value';
import { readParams } from '@/domain/standard';
import { missingSpecs } from '@/domain/technical-sheet';

type Db = PrismaClient | Prisma.TransactionClient;

// Lo que se espera de la ficha técnica de un producto: los campos que pide
// cada canal para la categoría de su familia, y el mínimo del estándar.

export type ExpectedSpecs = {
  canal: string;
  categoria: string;
  campos: { nombre: string; unidades: string[] | null; en_la_ficha_tecnica: boolean }[];
  faltan: string[];
};

export async function technicalSheetState(db: Db, accountId: string, productId: string) {
  const product = await db.product.findFirstOrThrow({
    where: { id: productId, accountId },
    select: {
      productType: true,
      specs: true,
      publications: { select: { store: { select: { channel: { select: { id: true, kind: true, name: true } } } } } },
    },
  });
  const specs = parseNameValueList(product.specs);
  const family = product.productType?.trim() || null;
  const channels = [...new Map(product.publications.map((p) => [p.store.channel.id, p.store.channel])).values()];

  const expected: ExpectedSpecs[] = [];
  for (const channel of channels) {
    const catalog = getChannelAdapter(channel.kind, channel.name).catalog;
    const categoryId = catalog?.categoryForFamily(family);
    const category = categoryId ? catalog?.category(categoryId) : null;
    if (!category) continue;
    // Marca, número de pieza y origen salen de la ficha: no van en la ficha técnica.
    const fields = category.fields.filter((f) => !f.fromProduct);
    const missing = missingSpecs(
      specs,
      fields.map((f) => f.label),
    );
    expected.push({
      canal: channel.name,
      categoria: category.name,
      campos: fields.map((f) => ({ nombre: f.label, unidades: f.units ?? null, en_la_ficha_tecnica: !missing.includes(f.label) })),
      faltan: missing,
    });
  }

  // El mínimo de la regla «Ficha técnica completa» del estándar, si la cuenta la usa.
  const rule = await db.standardRule.findFirst({
    where: { accountId, check: 'specs_complete', active: true, channelId: { in: channels.map((c) => c.id) } },
    orderBy: { position: 'asc' },
    select: { params: true },
  });
  const minimum = rule ? readParams('specs_complete', rule.params).min : null;

  return { specs, family, expected, minimum };
}
