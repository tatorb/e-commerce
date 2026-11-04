'use server';

import { revalidatePath } from 'next/cache';
import { act } from '@/lib/auth/guard';
import { prisma } from '@/lib/db';
import { AI_NOT_CONFIGURED, isAiConfigured } from '@/ai/claude';
import { pieceSchema, type PieceContent } from '@/domain/text-images';
import { storageError } from '@/lib/stored-files';
import { RenderError } from '@/lib/text-images/render';
import { completeTextImage, generateTextImage, saveTextImage, TextImageError } from '@/lib/text-images/step';

// Lo que se hace desde el paso Imágenes con texto: guardar la pieza, pedirle
// a Claude que la complete y generar el PNG. En una familia vale para todas
// sus medidas.

type Result = { ok: true; message: string } | { ok: false; error: string };

const section = ['pipeline', 'publicaciones'] as const;

async function guard(accountSlug: string, publicationId: string, run: () => Promise<string>): Promise<Result> {
  try {
    const message = await run();
    revalidatePath(`/a/${accountSlug}/pipeline/${publicationId}`);
    return { ok: true, message };
  } catch (e) {
    if (e instanceof TextImageError || e instanceof RenderError) return { ok: false, error: e.message };
    const storage = storageError(e);
    if (storage) return { ok: false, error: storage };
    throw e;
  }
}

export async function saveTextImageAction(accountSlug: string, publicationId: string, input: { content: unknown; photoEditId: string | null }): Promise<Result> {
  return act(accountSlug, { section: [...section], does: 'Guardó la imagen con texto', publicationId }, async ({ account, user }) => {
    const parsed = pieceSchema.safeParse(input?.content ?? {});
    if (!parsed.success) return { ok: false, error: 'Lo que llegó no tiene la forma esperada. Recargá la página.' };
    return guard(accountSlug, String(publicationId), async () => {
      await saveTextImage(prisma, {
        accountId: account.id,
        publicationId: String(publicationId),
        content: parsed.data as PieceContent,
        photoEditId: typeof input?.photoEditId === 'string' ? input.photoEditId : null,
        userId: user.id,
      });
      return 'Guardada.';
    });
  });
}

export async function completeTextImageAction(accountSlug: string, publicationId: string, replace: boolean): Promise<Result> {
  return act(accountSlug, { section: [...section], does: 'Pidió a Claude la imagen con texto', publicationId }, async ({ account, user }) => {
    if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED };
    const r = await completeTextImage(prisma, { accountId: account.id, publicationId: String(publicationId), userId: user.id, replace: Boolean(replace) });
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath(`/a/${accountSlug}/pipeline/${publicationId}`);
    const missing = r.missingBrands.length > 0 ? ` Faltan en la base de marcas: ${r.missingBrands.join(', ')}. Esos ítems quedaron sin logo hasta que las agregues.` : '';
    return { ok: true, message: `Claude completó la imagen. Revisala antes de generar el PNG.${missing}` };
  });
}

export async function generateTextImageAction(accountSlug: string, publicationId: string): Promise<Result> {
  return act(accountSlug, { section: [...section], does: 'Generó el PNG de la imagen con texto', publicationId }, async ({ account, user }) => {
    return guard(accountSlug, String(publicationId), async () => {
      const r = await generateTextImage(prisma, { accountId: account.id, publicationId: String(publicationId), userId: user.id });
      const how = [`versión ${r.version}`, r.version === 'A' ? `${r.fit.doubts} dudas` : null, r.fit.scale < 1 ? `ítems al ${Math.round(r.fit.scale * 100)} %` : null]
        .filter(Boolean)
        .join(', ');
      return `PNG generado (${how}). Ya está en Organización de multimedia para elegirlo.`;
    });
  });
}
