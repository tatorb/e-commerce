import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import { MediaError } from '@/lib/media';
import { createSaleOption, normalizeSaleOptions, SaleOptionCopyError } from '@/lib/sale-option-copy';
import { copyMedia } from './media-tools';
import { accountArg, defineTool, McpToolError, publicationArg, resolveAccount, resolvePublication } from './tool';

// Igualar las opciones de venta de cada medida con la buena y crear las formas
// de cobro que faltan, para Claude.

const PLAN_ARG = { sin_cuotas: 0, promocionada: 1, '3': 3, '6': 6, '9': 9, '12': 12 } as const;

const asToolError = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (e) {
    if (e instanceof SaleOptionCopyError || e instanceof MediaError || e instanceof ConnectError) throw new McpToolError(e.message);
    throw e;
  }
};

const normalizeTool = defineTool({
  name: 'normalize_sale_options',
  section: ['pipeline', 'publicaciones'],
  title: 'Igualar las opciones de venta con la buena',
  description:
    'Por cada medida de la publicación (en una familia, todas sus medidas), toma la buena, la que está en el pipeline, y le copia a las otras opciones de venta de la medida (las otras formas de cobro): el título, la descripción, los datos de catálogo, las preguntas frecuentes, las reglas del bot, responder solo, la garantía, las fotos elegidas con sus medidas y los clips. El título no se cambia si la otra tiene ventas y está bloqueado. Las finalizadas y las frenadas por el canal no se tocan. No cambia el precio ni la forma de cobro: el precio va con save_price y precio_sin_cuotas. También dice qué formas de cobro le faltan a cada medida (se crean con create_sale_option). Sin aplicar, solo muestra; con aplicar, lo guarda en la app y queda en Por subir: se manda con push_titles, push_descriptions, push_catalog_data, push_media y push_warranties. Antes de aplicar, mostrale a la persona qué cambia.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg,
    desde: z.string().optional().describe('La buena, si no es la que está en el pipeline: su código, link o id.'),
    aplicar: z.boolean().default(false).describe('false (de entrada) = solo mostrar; true = guardar en la app. La persona tiene que confirmar antes.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const sourceId = args.desde ? await resolvePublication(ctx, account.id, args.desde) : undefined;
    if (args.aplicar && !ctx.userId) throw new McpToolError('Para aplicar hace falta saber quién lo hace.');
    const report = await asToolError(() =>
      normalizeSaleOptions(ctx.db, {
        accountId: account.id,
        publicationId: id,
        sourceId,
        apply: args.aplicar,
        userId: ctx.userId,
        copyMedia: (fromId, toId) => copyMedia(ctx.db, { accountId: account.id, fromId, toId, photos: true, clips: true, userId: ctx.userId! }),
      }),
    );
    return {
      modo: args.aplicar ? 'aplicado: quedó en Por subir' : 'solo mostrar: no se cambió nada',
      medidas: report.map((m) => ({
        principal: m.main,
        la_buena: m.source,
        opciones: m.targets.map((t) => ({
          codigo: t.externalId,
          forma_de_cobro: t.plan,
          ...(t.untouched ? { no_se_toca: t.untouched } : { cambia: t.changes.length > 0 ? t.changes : 'nada de los textos y datos', ...(args.aplicar ? {} : { fotos_y_clips: 'se copian al aplicar' }) }),
          ...(t.skipped.length > 0 ? { queda_como_esta: t.skipped } : {}),
          ...(t.photos ? { fotos_copiadas: t.photos.copied, ...(t.photos.notInTarget > 0 ? { fotos_del_canal_de_la_buena_que_esta_no_tiene: t.photos.notInTarget } : {}) } : {}),
        })),
        formas_de_cobro_que_faltan: m.missing,
      })),
    };
  },
});

const createTool = defineTool({
  name: 'create_sale_option',
  section: 'subir',
  title: 'Crear otra forma de cobro para una medida',
  description:
    'Crea en el canal otra opción de venta de una medida, sumada al mismo producto del canal que la buena, con una forma de cobro que la medida no tiene, copiada de la buena (la que está en el pipeline): el mismo nombre, descripción, datos de catálogo, garantía y fotos. El precio, sin mandarlo, es el de esa forma de cobro desde el precio sin cuotas guardado (la misma ganancia); la cantidad es la del producto en el canal, la misma de las otras opciones. Queda en la app como otra opción de la medida. Devuelve el código, el link, el precio y si el canal la juntó con las otras opciones de la medida (junto_a_la_medida): si da false, frená y avisale a la persona antes de crear más. Antes, corré reconcile_publications con aplicar para esa medida, así la app conoce todas las opciones que ya tiene el canal y no se crea una repetida. Crea la publicación de verdad en el canal: antes, mostrale a la persona la medida, la forma de cobro, y el precio, y esperá que confirme. Una por llamada.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg.describe('Cualquier publicación de la medida: su código, link o id.'),
    forma_de_cobro: z.enum(['sin_cuotas', 'promocionada', '3', '6', '9', '12']),
    desde: z.string().optional().describe('La buena, si no es la que está en el pipeline.'),
    precio: z.number().positive().max(999_999_999).optional().describe('El precio publicado, en pesos. Sin mandarlo, el calculado desde el sin cuotas.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const sourceId = args.desde ? await resolvePublication(ctx, account.id, args.desde) : undefined;
    const r = await asToolError(() =>
      createSaleOption(ctx.db, {
        accountId: account.id,
        publicationId: id,
        sourceId,
        plan: PLAN_ARG[args.forma_de_cobro],
        price: args.precio,
        userId: ctx.userId,
      }),
    );
    return {
      creada: true,
      codigo: r.externalId,
      link: r.url,
      forma_de_cobro: r.plan,
      precio_publicado: r.price,
      junto_a_la_medida: r.joined,
      ...(r.warnings.length > 0 ? { avisos: r.warnings } : {}),
    };
  },
});

export const SALE_OPTION_COPY_TOOLS = [normalizeTool, createTool];
