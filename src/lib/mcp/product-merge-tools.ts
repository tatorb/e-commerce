import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { listDuplicateProducts, MergeError, mergeProducts, type MergePlan } from '@/lib/product-merge';
import { McpToolError, accountArg, defineTool, resolveAccount } from './tool';

// Los productos duplicados desde Claude: listarlos y unir dos. No puede haber
// dos productos de la misma marca y el mismo número de pieza.

/** Un producto por su id, el código de una de sus publicaciones o su nombre exacto. Con duplicados, el número de pieza no alcanza. */
async function findOne(db: PrismaClient, accountId: string, ref: string): Promise<string> {
  const term = ref.trim();
  const equals = { equals: term, mode: 'insensitive' as const };
  const found = await db.product.findMany({
    where: { accountId, OR: [{ id: term }, { publications: { some: { externalId: equals } } }, { name: equals }] },
    select: { id: true, name: true },
    take: 5,
  });
  const byId = found.find((p) => p.id === term);
  if (byId) return byId.id;
  if (found.length === 1) return found[0].id;
  if (found.length === 0) throw new McpToolError(`No encontré el producto «${term}». Pasá su id (list_duplicate_products lo da), el código de una de sus publicaciones o su nombre exacto.`);
  throw new McpToolError(`«${term}» coincide con ${found.length} productos: ${found.map((p) => `${p.name} (${p.id})`).join(', ')}. Pasá el id.`);
}

function planForClaude(plan: MergePlan, preview: boolean) {
  return {
    ...(plan.blockers.length > 0 ? { no_se_puede_unir: plan.blockers } : preview ? { vista_previa: true } : { unidos: plan.done }),
    queda: { id: plan.keep.id, nombre: plan.keep.name },
    se_va: { id: plan.goes.id, nombre: plan.goes.name },
    publicaciones_que_pasan: plan.publications.map((p) => ({
      publicacion: p.externalId ?? p.id,
      titulo: p.title,
      estado: p.status,
      medida_en_el_que_queda: p.measure,
      ...(p.note ? { aviso: p.note } : {}),
    })),
    se_suma_al_que_queda: plan.adds,
    donde_los_dos_tienen_algo_distinto_gana_el_que_queda: plan.conflicts,
    combos: plan.combos,
    se_pierde: plan.lost,
    ...(plan.done ? { aviso: 'El producto que se va se borró. Sus publicaciones, con su historial, notas, preguntas, visitas y ventas, quedaron en el que queda. Si alguna está activa o pausada y el que queda lleva stock, su cantidad se pone al día sola en la pasada de cada hora.' } : {}),
  };
}

const listDuplicatesTool = defineTool({
  name: 'list_duplicate_products',
  section: 'productos',
  title: 'Ver los productos duplicados',
  description:
    'Los productos de la cuenta que tienen la misma marca y el mismo número de pieza, sin importar mayúsculas, espacios, puntos ni guiones. No puede haber dos productos de lo mismo. De cada uno trae su id, su nombre, su stock, si está cruzado con el sistema de Insur y sus publicaciones con su estado, y sugiere cuál queda: el que tiene publicaciones activas o pausadas, cruce con Insur o stock. Se unen con merge_products.',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const groups = await listDuplicateProducts(ctx.db, account.id);
    return {
      cuenta: account.slug,
      grupos: groups.length,
      duplicados: groups.map((g) => ({
        marca: g.brand,
        numero_de_pieza: g.partNumber,
        sugerencia: g.why,
        ...(g.suggestedId ? { queda: g.suggestedId } : {}),
        productos: g.products.map((p) => ({
          id: p.id,
          nombre: p.name,
          stock: p.stock === null ? 'La app todavía no lleva su stock.' : p.stock,
          cruce_con_insur: p.insur.length > 0 ? p.insur : 'no',
          publicaciones: p.publications.map((x) => ({ publicacion: x.externalId ?? x.id, titulo: x.title, estado: x.status })),
        })),
      })),
    };
  },
});

const mergeProductsTool = defineTool({
  name: 'merge_products',
  section: 'productos',
  title: 'Unir dos productos duplicados',
  description:
    'Une dos productos que son lo mismo (list_duplicate_products los lista). Las publicaciones del que se va pasan al que queda, con su historial, notas, preguntas recibidas, visitas y ventas; si una trae medida, queda en la medida que corresponde del que queda y, si no se puede saber, queda sin medida y lo dice. Suma lo que no choca: compatibilidades, ficha técnica, investigación, fotos y videos, sin pisar lo del que queda; donde los dos tienen un dato distinto gana el que queda y lo informa. Si el que se va está en combos, el combo pasa a usar el que queda. Después borra el producto que se va: no se puede deshacer. Se niega, sin cambiar nada, si el que se va tiene stock, cruce con el sistema de Insur, o publicaciones activas o pausadas que no se pueden pasar, y dice por qué. No toca Mercado Libre. Usala primero con vista_previa, mostrale el plan a la persona y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    producto_que_queda: z.string().min(1).max(200).describe('El producto que queda: su id, el código de una de sus publicaciones o su nombre exacto.'),
    producto_que_se_va: z.string().min(1).max(200).describe('El producto que se va y se borra: su id, el código de una de sus publicaciones o su nombre exacto.'),
    vista_previa: z.boolean().optional().describe('true: solo muestra el plan, sin cambiar nada.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const [keepId, goesId] = [await findOne(ctx.db, account.id, args.producto_que_queda), await findOne(ctx.db, account.id, args.producto_que_se_va)];
    try {
      return planForClaude(await mergeProducts(ctx.db, { accountId: account.id, keepId, goesId, preview: args.vista_previa === true }), args.vista_previa === true);
    } catch (e) {
      if (e instanceof MergeError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

export const PRODUCT_MERGE_TOOLS = [listDuplicatesTool, mergeProductsTool];
