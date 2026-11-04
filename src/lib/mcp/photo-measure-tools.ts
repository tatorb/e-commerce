import { z } from 'zod';
import { FamilyError, setPublicationMeasure } from '@/lib/families';
import { accountMeasureIssues, measureCheck, PhotoMeasureError, setPhotoMeasures, stateText, type MeasureCheck } from '@/lib/photo-measures';
import { McpToolError, accountArg, appLink, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// Las medidas de las fotos de los productos con varias medidas: cuáles quedaron
// apuntando a una medida que ya no está en la ficha (por ejemplo porque la
// medida cambió de nombre), y elegirles la medida. Lo mismo para la medida que
// vende cada publicación de una familia. Igual que la tarjeta Medidas de las
// fotos de los pasos Fotos y Organización de multimedia.

function checkOut(c: MeasureCheck) {
  return {
    medidas_de_la_ficha: c.measures.map((m) => ({ clave: m.key, nombre: m.label })),
    fotos: c.photos.map((p) => ({ foto: p.editId, nombre: p.name, medida: stateText(p.state), ...(p.state.kind === 'unknown' && p.state.guess ? { parece: p.state.guess.label } : {}) })),
    fotos_con_medida_que_ya_no_esta: c.unknownPhotos.length,
    videos_con_medida_que_ya_no_esta: c.unknownVideos.map((v) => ({ video: v.videoId, nombre: v.name, medida: stateText(v.state) })),
    publicaciones_de_la_familia: c.members.map((m) => ({
      publicacion: m.publicationId,
      codigo: m.externalId,
      titulo: m.title,
      medida: stateText(m.state),
      ...(m.state.kind === 'unknown' && m.state.guess ? { parece: m.state.guess.label } : {}),
    })),
    hay_que_revisar: c.hasIssues,
  };
}

const checkTool = defineTool({
  name: 'check_photo_measures',
  section: ['pipeline', 'productos'],
  title: 'Revisar las medidas de las fotos',
  description:
    'En un producto con varias medidas, cada foto y cada video sacado para una medida, y cada publicación de una familia, apuntan a una medida de la ficha. Si la medida cambió de nombre o de SKU, pueden quedar apuntando a una que ya no está: entonces no aparecen en ninguna medida. Con publicacion, muestra las fotos de su producto con su medida, cuáles apuntan a una que ya no está y cuál parece ser, y la medida de cada publicación de la familia. Sin publicacion, lista los productos de la cuenta que tienen algo para revisar. No cambia nada: para corregir, set_photo_measures, después de mostrarle a la persona qué se va a mover y que confirme.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg.optional() }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    if (args.publicacion) {
      const id = await resolvePublication(ctx, account.id, args.publicacion);
      const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { productId: true, product: { select: { name: true } } } });
      return { producto: pub.product.name, ...checkOut(await measureCheck(ctx.db, pub.productId)), link_app: appLink(ctx, account, id) };
    }
    const list = await accountMeasureIssues(ctx.db, account.id);
    return {
      productos_para_revisar: list.map((p) => ({
        producto: p.name,
        codigo: p.partNumber,
        fotos_con_medida_que_ya_no_esta: p.check.unknownPhotos.length,
        videos_con_medida_que_ya_no_esta: p.check.unknownVideos.length,
        publicaciones_de_familia_sin_medida: p.check.memberIssues.map((m) => ({ publicacion: m.publicationId, codigo: m.externalId, medida: stateText(m.state) })),
        publicaciones_de_familia_con_la_misma_medida: p.check.repeatedMembers.map((m) => m.externalId ?? m.publicationId),
        una_publicacion: p.check.members[0]?.publicationId ?? null,
      })),
    };
  },
});

const setTool = defineTool({
  name: 'set_photo_measures',
  section: ['pipeline', 'productos'],
  title: 'Elegir la medida de fotos y publicaciones de una familia',
  description:
    'Le pone a fotos y videos del producto de una publicación la medida elegida (por su clave o su nombre de la ficha; "todas" para todas las medidas), y a publicaciones de la familia la medida que venden. Las claves salen de check_photo_measures. Antes de llamarla, mostrale a la persona qué se va a mover y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg.describe('Una publicación del producto.'),
    fotos: z.array(z.object({ foto: z.string().min(1), medida: z.string().min(1) })).max(200).optional(),
    videos: z.array(z.object({ video: z.string().min(1), medida: z.string().min(1) })).max(50).optional(),
    publicaciones_de_la_familia: z.array(z.object({ publicacion: z.string().min(1), medida: z.string().min(1) })).max(20).optional(),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const pub = await ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { productId: true } });
    const check = await measureCheck(ctx.db, pub.productId);
    const keyOf = (name: string, allowAll: boolean): string | null => {
      const n = name.trim().toLowerCase();
      if (allowAll && n === 'todas') return null;
      const m = check.measures.find((x) => x.key.toLowerCase() === n || x.label.toLowerCase() === n || x.sku?.toLowerCase() === n);
      if (!m) throw new McpToolError(`No hay una medida «${name}» en la ficha. Las medidas son: ${check.measures.map((x) => x.label).join(', ')}.`);
      return m.key;
    };
    try {
      const n = await setPhotoMeasures(ctx.db, {
        accountId: account.id,
        productId: pub.productId,
        photos: (args.fotos ?? []).map((f) => ({ editId: f.foto.replace(/^corregida:/, ''), variantKey: keyOf(f.medida, true) })),
        videos: (args.videos ?? []).map((v) => ({ videoId: v.video, variantKey: keyOf(v.medida, true) })),
      });
      for (const m of args.publicaciones_de_la_familia ?? []) {
        const memberId = await resolvePublication(ctx, account.id, m.publicacion);
        if (!check.members.some((x) => x.publicationId === memberId)) throw new McpToolError('Esa publicación no es de la familia de este producto.');
        await setPublicationMeasure(ctx.db, { accountId: account.id, publicationId: memberId, variantKey: keyOf(m.medida, false)! });
      }
      const after = await measureCheck(ctx.db, pub.productId);
      return { listo: true, fotos_y_videos_cambiados: n, ...checkOut(after), link_app: appLink(ctx, account, id) };
    } catch (e) {
      if (e instanceof PhotoMeasureError || e instanceof FamilyError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

export const PHOTO_MEASURE_TOOLS = [checkTool, setTool];
