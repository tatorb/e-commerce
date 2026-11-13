'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { FamilyError, setPublicationMeasure } from '@/lib/families';
import { PhotoMeasureError, setPhotoMeasures } from '@/lib/photo-measures';
import { MeasureError, setPublicationMeasure as chooseMeasure } from '@/lib/publication-measure';

// Elegir de qué medida es cada foto o video de un producto, y qué medida vende
// cada publicación de su familia, cuando quedaron apuntando a una medida que
// ya no está en la ficha.

type Result = { ok: true; message: string } | { ok: false; error: string };

export async function saveMeasuresAction(
  accountSlug: string,
  publicationId: string,
  input: {
    photos?: { editId: string; variantKey: string | null }[];
    videos?: { videoId: string; variantKey: string | null }[];
    members?: { publicationId: string; variantKey: string }[];
  },
): Promise<Result> {
  return act(accountSlug, { section: ['pipeline', 'productos'], does: 'Eligió las medidas de las fotos', publicationId }, async ({ account }) => {
    const pub = await prisma.publication.findFirst({ where: { id: String(publicationId), product: { accountId: account.id } }, select: { productId: true } });
    if (!pub) return { ok: false, error: 'La publicación no existe en esta cuenta.' };
    const key = (v: unknown) => (typeof v === 'string' && v ? v : null);
    try {
      const n = await setPhotoMeasures(prisma, {
        accountId: account.id,
        productId: pub.productId,
        photos: (input?.photos ?? []).map((p) => ({ editId: String(p.editId), variantKey: key(p.variantKey) })),
        videos: (input?.videos ?? []).map((v) => ({ videoId: String(v.videoId), variantKey: key(v.variantKey) })),
      });
      let members = 0;
      for (const m of input?.members ?? []) {
        // Solo publicaciones del mismo producto.
        const same = await prisma.publication.count({ where: { id: String(m.publicationId), productId: pub.productId } });
        if (!same) return { ok: false, error: 'Una de las publicaciones no es de este producto.' };
        await setPublicationMeasure(prisma, { accountId: account.id, publicationId: String(m.publicationId), variantKey: String(m.variantKey) });
        members++;
      }
      revalidatePath(`/a/${accountSlug}`, 'layout');
      const parts = [n > 0 ? `${n === 1 ? '1 foto o video' : `${n} fotos y videos`} con su medida` : null, members > 0 ? `${members === 1 ? '1 publicación' : `${members} publicaciones`} de la familia con su medida` : null];
      return { ok: true, message: `Guardado: ${parts.filter(Boolean).join(' y ') || 'nada para cambiar'}.` };
    } catch (e) {
      if (e instanceof PhotoMeasureError || e instanceof FamilyError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

/**
 * La medida que vende una publicación publicada sola cuyo SKU no dice cuál es,
 * para ella y todas sus opciones de venta. Con sendSku, el SKU de la medida
 * queda en Por subir. La cantidad, si sigue al stock, se sube al guardar.
 */
export async function choosePublicationMeasureAction(accountSlug: string, publicationId: string, measureKey: string, sendSku: boolean): Promise<Result> {
  const id = String(publicationId);
  return act(accountSlug, { section: ['pipeline', 'publicaciones'], does: 'Eligió la medida de la publicación', publicationId: id }, async ({ account, user }) => {
    try {
      const r = await chooseMeasure(prisma, { accountId: account.id, publicationId: id, measure: String(measureKey), sendSku: Boolean(sendSku), userId: user.id });
      revalidatePath(`/a/${accountSlug}`, 'layout');
      const n = r.publications.length;
      const parts = [
        `Medida ${r.measure.label} en ${n === 1 ? 'la publicación' : `las ${n} opciones de venta`}.`,
        r.stock.sent > 0 ? `Cantidad subida al canal en ${r.stock.sent === 1 ? '1' : r.stock.sent}.` : null,
        r.stock.failed.length > 0 ? `No se pudo subir la cantidad: ${r.stock.failed.map((f) => f.error).join(' ')}` : null,
        r.skuToPush > 0 ? `SKU ${r.measure.sku} en Por subir en ${r.skuToPush === 1 ? '1' : r.skuToPush}.` : null,
      ];
      return { ok: true, message: parts.filter(Boolean).join(' ') };
    } catch (e) {
      if (e instanceof MeasureError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
