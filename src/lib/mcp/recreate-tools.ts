import { z } from 'zod';
import { planLabel } from '@/domain/pricing';
import { CatalogError } from '@/domain/catalog-data';
import { ConnectError } from '@/channels/connect';
import { applyRecreate, planRecreate, RecreateError, type RecreatePlan } from '@/lib/recreate';
import { CreateError } from '@/lib/channel-create';
import { McpToolError, accountArg, defineTool, publicationArg, resolveAccount, resolvePublication } from './tool';

// Recrear un producto en otra categoría del canal, cuando el canal le cambió la
// categoría a una opción y el producto ya no acepta opciones nuevas.

const planOut = (p: RecreatePlan) => ({
  producto: p.product.name,
  categoria_destino: `${p.category.name} (${p.category.id})${p.category.path ? `, en ${p.category.path}` : ''}`,
  publicacion_nueva: p.newMain.created
    ? 'Se crea en la app copiando la principal vieja.'
    : { id: p.newMain.id, titulo: p.newMain.title, categoria_en_la_app: p.newMain.categoryNow ?? 'la del tipo de producto' },
  opciones_vivas: p.old.map((o) => ({
    codigo: o.externalId,
    forma_de_cobro: o.planLabel,
    precio: o.price,
    estado: o.statusLabel,
    ...(o.statusReason ? { motivo_del_estado: o.statusReason } : {}),
    visitas_90d: o.visits,
    ventas_90d: o.sales,
    ...(o.main ? { principal: true } : {}),
    al_final: o.closeBlocked ? `No se puede finalizar ahora: ${o.closeBlocked}` : 'Se finaliza.',
  })),
  ...(p.resume
    ? { ya_creadas: p.resume.existing.map((e) => ({ codigo: e.externalId, forma_de_cobro: planLabel(e.plan), principal: e.id === p.resume!.newMainId })) }
    : {}),
  se_crea: p.toCreate.map((t) => ({ forma_de_cobro: t.label, precio: t.price, como: t.main ? 'principal nueva, otro producto del canal' : 'opción de venta de la nueva' })),
  falta_antes_de_aplicar: p.missing,
  avisos: p.notes,
});

const recreateTool = defineTool({
  name: 'recreate_product_in_category',
  section: 'pipeline',
  title: 'Recrear el producto en otra categoría',
  description:
    'Recrea un producto en otra categoría del canal: para cuando el canal le cambió la categoría a una opción de venta y el producto del canal ya no acepta opciones nuevas ("Item\'s category domain differs from UserProduct domain"). Con solo_mostrar (así viene) no cambia nada: lista las opciones vivas del producto con su forma de cobro, precio, estado, visitas y ventas, qué se va a crear y lo que falta. Al aplicar, en este orden: pone la categoría en la publicación nueva (una sin publicar del producto, o una copia de la principal), la crea en el canal como otro producto, crea sus opciones con los mismos precios por forma de cobro, las confirma leyéndolas del canal, le pasa el trabajo del pipeline (paso, historial, título y descripción en trabajo, competencia, búsquedas, posiciones, notas) y recién al final finaliza las viejas. Si algo de la creación falla, no finaliza ninguna. Si se corta a mitad, volver a llamarla retoma: reconoce la nueva ya creada (ya_creadas), crea solo las formas de cobro que le faltan y finaliza las viejas que quedan, sin duplicar. Si la nueva no tiene fotos elegidas, le copia las de la principal vieja en el mismo orden: las del canal tal cual y las imágenes con texto como esas imágenes (las de cada publicación, copiadas a la nueva). No hereda el Tipo de vehículo ni lo que no es del formulario de la categoría destino. Las que el canal no deja finalizar (en revisión) quedan en una tarea, se reintentan solas cada hora y se ven en Por subir, Por finalizar. La categoría puede ser cualquier código de categoría del canal. Crea y finaliza publicaciones de verdad: antes mostrale a la persona el plan y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicacion: publicationArg.describe('Cualquier publicación del producto: la nueva sin publicar, o una de las viejas.'),
    categoria: z.string().min(1).describe('El código de la categoría destino, por ejemplo MLA458790.'),
    todas_las_formas_de_cobro: z.boolean().optional().describe('true (así viene) = crea también las opciones con cuotas que el producto tiene hoy, con sus precios. false = solo la principal sin cuotas.'),
    solo_mostrar: z.boolean().optional().describe('true (así viene) = no cambia nada, muestra el plan. false = lo hace.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const base = { accountId: account.id, publicationId: id, categoryId: args.categoria, allPlans: args.todas_las_formas_de_cobro !== false };
    try {
      if (args.solo_mostrar !== false) return { solo_mostrar: true, mensaje: 'No se cambió nada.', ...planOut(await planRecreate(ctx.db, base)) };
      const r = await applyRecreate(ctx.db, { ...base, userId: ctx.userId });
      return {
        solo_mostrar: false,
        ...planOut(r.plan),
        creadas: r.created.map((c) => ({ forma_de_cobro: c.label, codigo: c.externalId, confirmada_en_el_canal: c.confirmed })),
        finalizadas: r.closed,
        quedan_por_finalizar: r.pending.map((p) => ({ codigo: p.externalId, motivo: p.why })),
        ...(r.warnings.length > 0 ? { avisos_del_canal: r.warnings } : {}),
      };
    } catch (e) {
      if (e instanceof RecreateError || e instanceof CatalogError || e instanceof ConnectError || e instanceof CreateError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

export const RECREATE_TOOLS = [recreateTool];
