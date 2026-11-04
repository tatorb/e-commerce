import { z } from 'zod';
import { DEFAULT_DOUBTS_TITLE, MAX_ITEMS_A, pieceItemSchema, pieceDoubtSchema, TEXT_LIMITS, type PieceContent } from '@/domain/text-images';
import { storageError } from '@/lib/stored-files';
import { brandUsage, listBrands } from '@/lib/text-images/brands';
import { RenderError } from '@/lib/text-images/render';
import { generateTextImage, loadTextImageStep, MAX_MEDIA_PLACE, MAX_TEXT_IMAGES, saveTextImage, TextImageError } from '@/lib/text-images/step';
import { McpToolError, accountArg, appLink, defineTool, publicationArg, resolveAccount, resolvePublication, type McpContext } from './tool';

// El paso Imágenes con texto para Claude: ver la pieza, cargarla o cambiar una
// parte, generar el PNG y ver la base de marcas de vehículos. Usa las mismas
// funciones que la pantalla: en una familia, la pieza es una sola para todas
// sus medidas.

const slotArg = z
  .number()
  .int()
  .min(1)
  .max(MAX_TEXT_IMAGES)
  .optional()
  .describe(`Qué imagen con texto de la publicación: 1, 2... hasta ${MAX_TEXT_IMAGES}. Sin decir, la 1.`);

async function target(ctx: McpContext, args: { cuenta?: string; publicacion: string }) {
  const account = await resolveAccount(ctx, args.cuenta);
  const id = await resolvePublication(ctx, account.id, args.publicacion);
  return { account, id };
}

async function asToolError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof TextImageError || e instanceof RenderError) throw new McpToolError(e.message);
    const storage = storageError(e);
    if (storage) throw new McpToolError(storage);
    throw e;
  }
}

const RULES = `Reglas: TIPO_PRODUCTO es el nombre genérico más "para motor" (hasta ${TEXT_LIMITS.type} caracteres). MOTOR, el motor como lo busca el comprador (hasta ${TEXT_LIMITS.engine}). SELLO, siempre "COMPATIBLE". Cada ítem de compatible y no_compatible lleva tipo ("vehiculo" si nombra modelos, "motor" si nombra un motor sin modelo), marca (solo vehículos: la clave de list_vehicle_brands), titulo (hasta ${TEXT_LIMITS.itemTitle}; hasta 3 modelos de la misma marca y motor separados por " · ") y detalle (hasta ${TEXT_LIMITS.itemDetail}). En compatible van solo compatibilidades confirmadas en la ficha; en no_compatible, las confusiones reales de preguntas, dolores y objeciones. dudas: 4, de más a menos importante, titulo hasta ${TEXT_LIMITS.doubtTitle} y respuesta hasta ${TEXT_LIMITS.doubtAnswer}. TITULO_DUDAS por defecto "${DEFAULT_DOUBTS_TITLE}". Con más de ${MAX_ITEMS_A} ítems en alguna columna la pieza va en versión B, sin el bloque de dudas. Voseo, frases cortas, sin signos de exclamación ni rayas largas. Todo sale del paso Información (get_publication): no inventes nada.`;

const getStep = defineTool({
  name: 'get_text_images_step',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver el paso Imágenes con texto',
  description: `Una publicación puede tener hasta ${MAX_TEXT_IMAGES} imágenes con texto (imagen 1, 2...), cada una con su contenido y, si se eligió, su lugar fijo en Organización de multimedia, que le gana al orden del protocolo: las demás fotos llenan los huecos. Muestra una imagen con texto de una publicación (una imagen de 1200 × 1200 que le da seguridad al comprador sobre la compatibilidad): su contenido, la versión que corresponde (A o B), la foto elegida y las que se pueden elegir del paso Fotos, el PNG generado y si está desactualizado, lo que falta para generarlo y las marcas que usa sin logo. En una familia, la pieza es una sola para todas sus medidas. ${RULES}`,
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, imagen: slotArg }),
  readOnly: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const s = await asToolError(() => loadTextImageStep(ctx.db, { accountId: account.id, publicationId: id, slot: args.imagen }));
    return {
      imagen: s.slot,
      lugar_en_multimedia: s.mediaPlace,
      imagenes_de_la_publicacion: s.pieces.map((p) => ({ imagen: p.slot, lugar_en_multimedia: p.mediaPlace, png_generado: p.generated })),
      contenido: s.content,
      version: s.version,
      ...(s.sharedBy > 1 ? { familia: `La pieza es de la familia: se guarda en sus ${s.sharedBy} medidas.` } : {}),
      foto: s.photoEditId,
      fotos_para_elegir: s.photos.map((p) => ({ foto: p.editId, nombre: p.label, sin_fondo: p.transparent })),
      png: s.png
        ? { generado: s.png.at.toISOString(), desactualizado: s.png.outdated, link: `${ctx.baseUrl}${s.png.href}`, en_organizacion_de_multimedia: true }
        : null,
      falta_para_generar: s.missing,
      textos_largos: s.lengthNotes,
      marcas_sin_logo: s.withoutLogo,
      ...(s.unknownBrands.length > 0 ? { marcas_que_ya_no_estan: s.unknownBrands } : {}),
      link_app: appLink(ctx, account, id),
    };
  },
});

const saveTool = defineTool({
  name: 'save_text_images',
  section: ['pipeline', 'publicaciones'],
  title: 'Guardar la imagen con texto',
  description: `Guarda una imagen con texto de una publicación (imagen 1, 2...; una que no existe se crea), entera o una parte: lo que no mandes queda como está. Las listas (compatible, no_compatible, dudas) se reemplazan enteras. foto es la clave de una foto de fotos_para_elegir de get_text_images_step; null la saca. lugar_en_multimedia es el lugar fijo en Organización de multimedia, desde 1, que le gana al orden del protocolo (con el PNG generado, la imagen queda ahí sola); null le saca el lugar fijo. Dos imágenes de la misma publicación no pueden tener el mismo lugar. En una familia se guarda en todas sus medidas. Después de cambiar algo, el PNG queda desactualizado: generalo con generate_text_image_png. ${RULES}`,
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    TIPO_PRODUCTO: z.string().max(120).optional(),
    MOTOR: z.string().max(160).optional(),
    SELLO: z.string().max(40).optional(),
    compatible: z.array(pieceItemSchema).max(30).optional(),
    no_compatible: z.array(pieceItemSchema).max(30).optional(),
    TITULO_DUDAS: z.string().max(80).optional(),
    dudas: z.array(pieceDoubtSchema).max(8).optional(),
    foto: z.string().nullable().optional(),
    imagen: slotArg,
    lugar_en_multimedia: z.number().int().min(1).max(MAX_MEDIA_PLACE).nullable().optional(),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const { cuenta: _c, publicacion: _p, foto, imagen, lugar_en_multimedia, ...rest } = args;
    void _c;
    void _p;
    const content = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<PieceContent>;
    if (Object.keys(content).length === 0 && foto === undefined && lugar_en_multimedia === undefined) throw new McpToolError('No mandaste nada para guardar.');
    await asToolError(() =>
      saveTextImage(ctx.db, { accountId: account.id, publicationId: id, slot: imagen, content, photoEditId: foto, mediaPlace: lugar_en_multimedia, userId: ctx.userId }),
    );
    const s = await loadTextImageStep(ctx.db, { accountId: account.id, publicationId: id, slot: imagen });
    return {
      listo: true,
      imagen: s.slot,
      lugar_en_multimedia: s.mediaPlace,
      version: s.version,
      falta_para_generar: s.missing,
      marcas_sin_logo: s.withoutLogo,
      png_desactualizado: s.png ? s.png.outdated : null,
      link_app: appLink(ctx, account, id),
    };
  },
});

const generateTool = defineTool({
  name: 'generate_text_image_png',
  section: ['pipeline', 'publicaciones'],
  title: 'Generar el PNG de la imagen con texto',
  description:
    'Arma el PNG de 1200 × 1200 de una imagen con texto en el servidor (imagen 1, 2...), igual a la vista previa de la app, y lo guarda en el Drive. Si la imagen tiene lugar fijo, queda sola en ese lugar en Organización de multimedia de las publicaciones que ya tienen fotos elegidas; si no, queda para elegirla como una foto más (set_publication_media). No se sube solo al canal. Si no entra todo ni achicando los ítems, no lo arma y dice por qué. Tarda unos segundos.',
  input: z.object({ cuenta: accountArg, publicacion: publicationArg, imagen: slotArg }),
  readOnly: false,
  async run(ctx, args) {
    const { account, id } = await target(ctx, args);
    const r = await asToolError(() => generateTextImage(ctx.db, { accountId: account.id, publicationId: id, slot: args.imagen, userId: ctx.userId }));
    return {
      listo: true,
      version: r.version,
      dudas_que_entraron: r.fit.doubts,
      tamano_de_los_items: `${Math.round(r.fit.scale * 100)} %`,
      generado: r.at.toISOString(),
      nota: 'Ya está en Organización de multimedia: con lugar fijo, en su lugar; si no, en Imágenes con texto, para elegirla.',
      link_app: appLink(ctx, account, id),
    };
  },
});

const brandsTool = defineTool({
  name: 'list_vehicle_brands',
  title: 'Ver la base de marcas de vehículos',
  description:
    'Lista la base de marcas de vehículos, la misma para todas las cuentas: la clave que va en los ítems de la imagen con texto, el nombre, los alias con que se la reconoce, si tiene logo y en cuántas imágenes se usa. Agregar marcas o subir logos se hace en la app, en Marcas de vehículos, y solo lo puede hacer un administrador.',
  input: z.object({}),
  readOnly: true,
  async run(ctx) {
    const [brands, usage] = await Promise.all([listBrands(ctx.db), brandUsage(ctx.db)]);
    return {
      marcas: brands.map((b) => ({ clave: b.key, nombre: b.name, alias: b.aliases, tiene_logo: b.hasLogo, usada_en: usage.get(b.key) ?? 0 })),
      link_app: `${ctx.baseUrl}/marcas-vehiculos`,
    };
  },
});

export const TEXT_IMAGE_TOOLS = [getStep, saveTool, generateTool, brandsTool];
