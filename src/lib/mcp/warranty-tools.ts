import { z } from 'zod';
import { makeWarranty, WarrantyError, warrantyLabel, type WarrantyType, type WarrantyUnit } from '@/domain/warranty';
import { accountWarranty, setAccountWarranty, setWarranties } from '@/lib/warranty';
import { McpToolError, accountArg, defineTool, findPublication, resolveAccount } from './tool';

// Cargar la garantía en las publicaciones, como la tarjeta Garantía de la
// publicación o el botón de Ajustes, Garantía. Queda en Por subir: al canal la
// manda push_warranties.

const TYPES: Record<'vendedor' | 'fabrica' | 'sin_garantia', WarrantyType> = { vendedor: 'seller', fabrica: 'factory', sin_garantia: 'none' };
const UNITS: Record<'dias' | 'meses' | 'anios', WarrantyUnit> = { dias: 'days', meses: 'months', anios: 'years' };
// Cuántas publicaciones que cambian se listan una por una.
const LISTED = 50;

const setWarrantyTool = defineTool({
  name: 'set_warranty',
  section: ['publicaciones', 'pipeline'],
  title: 'Cargar la garantía en publicaciones',
  description:
    'Carga la garantía (tipo y tiempo, por ejemplo garantía del vendedor de 15 días) en una, varias o todas las publicaciones de la cuenta. En publicaciones pasá ids de la app o códigos del canal, hasta 500; sin la lista, van todas las de la cuenta. En una familia se carga en todas sus medidas. Con usar_la_de_la_cuenta, carga la garantía de la cuenta (Ajustes, Garantía) en vez de tipo y tiempo. Con guardar_en_la_cuenta, además la deja como garantía de la cuenta: con ella se crean las publicaciones nuevas en el paso Publicación. No manda nada al canal: cada publicación que cambia queda en Por subir, y se sube con push_warranties. Primero llamala con solo_contar para decirle a la persona cuántas publicaciones cambian, y esperá que confirme antes de cargarla.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z.array(z.string().min(1)).min(1).max(500).optional().describe('Las publicaciones: su id en la app o su código en el canal. Sin la lista, todas las de la cuenta.'),
    tipo: z.enum(['vendedor', 'fabrica', 'sin_garantia']).optional().describe('Garantía del vendedor, de fábrica o sin garantía.'),
    tiempo: z.number().int().min(1).max(3650).optional().describe('Cuánto dura, por ejemplo 15. Sin garantía no lleva.'),
    unidad: z.enum(['dias', 'meses', 'anios']).optional().describe('En qué se cuenta el tiempo.'),
    usar_la_de_la_cuenta: z.boolean().optional().describe('Cargar la garantía de la cuenta, en vez de tipo y tiempo.'),
    guardar_en_la_cuenta: z.boolean().optional().describe('Dejarla también como la garantía de la cuenta, para las publicaciones nuevas.'),
    solo_contar: z.boolean().optional().describe('Solo decir cuántas cambian, sin cambiar nada.'),
  }),
  readOnly: false,
  destructive: false,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    let warranty;
    if (args.usar_la_de_la_cuenta) {
      warranty = await accountWarranty(ctx.db, account.id);
      if (!warranty) throw new McpToolError('La cuenta todavía no tiene garantía: pasá tipo y tiempo, con guardar_en_la_cuenta si querés dejarla para la cuenta.');
    } else {
      if (!args.tipo) throw new McpToolError('Falta el tipo de garantía: vendedor, fabrica o sin_garantia.');
      try {
        warranty = makeWarranty(TYPES[args.tipo], args.tiempo ?? null, args.unidad ? UNITS[args.unidad] : null);
      } catch (e) {
        if (e instanceof WarrantyError) throw new McpToolError(`${e.message} Pasá tiempo y unidad.`);
        throw e;
      }
    }

    const salteadas: { publicacion: string; motivo: string }[] = [];
    let ids: string[] | undefined;
    if (args.publicaciones) {
      ids = [];
      for (const ref of args.publicaciones) {
        try {
          ids.push(await findPublication(ctx.db, account.id, ref));
        } catch (e) {
          if (!(e instanceof McpToolError)) throw e;
          salteadas.push({ publicacion: ref, motivo: e.message });
        }
      }
      if (ids.length === 0) return { garantia: warrantyLabel(warranty), cambian: 0, salteadas };
    }

    const dryRun = args.solo_contar === true;
    const plan = await setWarranties(ctx.db, { accountId: account.id, publicationIds: ids, warranty, dryRun });
    if (args.guardar_en_la_cuenta && !dryRun) await setAccountWarranty(ctx.db, account.id, warranty);
    const listed = plan.changing.slice(0, LISTED).map((r) => ({ publicacion: r.externalId ?? r.id, titulo: r.title, hoy: r.current }));
    return {
      garantia: plan.warranty,
      [dryRun ? 'solo_contadas' : 'listo']: true,
      publicaciones_miradas: plan.total,
      [dryRun ? 'cambiarian' : 'cambiaron']: plan.changing.length,
      ya_la_tienen: plan.same,
      sin_publicar_en_el_canal: plan.unpublished,
      publicaciones: listed,
      ...(plan.changing.length > LISTED ? { y_otras: plan.changing.length - LISTED } : {}),
      ...(salteadas.length > 0 ? { salteadas } : {}),
      ...(args.guardar_en_la_cuenta ? { garantia_de_la_cuenta: dryRun ? 'Se guardaría como la de la cuenta.' : 'Quedó como la de la cuenta.' } : {}),
      siguiente: dryRun
        ? 'No se cambió nada. Si la persona confirma, llamala de nuevo sin solo_contar.'
        : plan.changing.length > 0
          ? 'Quedaron en Por subir. Para mandarlas al canal, push_warranties, después de que la persona confirme.'
          : 'No había nada para cambiar.',
    };
  },
});

export const WARRANTY_TOOLS = [setWarrantyTool];
