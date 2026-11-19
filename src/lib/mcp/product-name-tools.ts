import { z } from 'zod';
import { applyRenames, planRenames, ProductNameError, setTypeShortName, type RenamePlan } from '@/lib/product-names';
import { McpToolError, accountArg, defineTool, resolveAccount } from './tool';

// El nombre de los productos (el de la ficha, no el título de la publicación),
// renombrados en tanda con un formato.

const asToolError = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (e) {
    if (e instanceof ProductNameError) throw new McpToolError(e.message);
    throw e;
  }
};

const planOut = (plan: RenamePlan) => ({
  a_renombrar: plan.toRename.length,
  ya_cumplen: plan.alreadyOk.length,
  no_se_pueden: plan.cannot.length,
  en_conflicto: plan.conflicts.length,
  cambios: plan.toRename.map((r) => ({ producto_id: r.id, nombre_actual: r.from, nombre_nuevo: r.to })),
  conflictos: plan.conflicts.map((c) => ({ producto_id: c.id, nombre_actual: c.from, nombre_nuevo: c.to, choca_con: c.with })),
  sin_renombrar: plan.cannot.map((c) => ({ producto_id: c.id, nombre_actual: c.name, motivo: c.reason })),
  ya_cumplen_el_formato: plan.alreadyOk.map((o) => ({ producto_id: o.id, nombre: o.name })),
});

const renameProductsTool = defineTool({
  name: 'rename_products',
  section: 'productos',
  title: 'Renombrar productos en tanda',
  description:
    'Renombra productos de la cuenta con un formato: el nombre de la ficha, no el título de la publicación. El formato lleva campos entre corchetes: [tipo], [tipo_corto], [marca], [numero_de_pieza], por ejemplo "[tipo_corto] [numero_de_pieza]" da "Subconjunto SP-413". El tipo corto es el nombre corto de cada tipo de producto, de Ajustes, Tipos y marcas. Con solo_contar (así viene) no cambia nada: devuelve cada producto con su nombre actual y el nuevo, los que ya cumplen el formato, los que no se pueden renombrar con el motivo, y los conflictos: si dos productos quedarían con el mismo nombre, o con el de otro producto, no se renombra ninguno. Mostrale a la persona la lista y esperá que confirme antes de mandar solo_contar false. Cada cambio queda en el registro del producto con el nombre anterior.',
  input: z.object({
    cuenta: accountArg,
    formato: z.string().min(1).max(200).describe('Por ejemplo "[tipo_corto] [numero_de_pieza]".'),
    marca: z.array(z.string()).optional().describe('Solo los productos de esas marcas, sin importar mayúsculas ni acentos.'),
    tipo_de_producto: z.array(z.string()).optional().describe('Solo los productos de esos tipos. Si no coincide exacto, los tipos que lo contienen.'),
    producto_ids: z.array(z.string()).max(2000).optional().describe('Solo esos productos: el producto_id de search_catalog.'),
    nombres_cortos: z
      .array(z.object({ tipo: z.string().min(1), nombre_corto: z.string().max(100) }))
      .max(200)
      .optional()
      .describe('El nombre corto de tipos de producto. Con solo_contar sirve para probar sin guardar; con solo_contar false se guarda en Ajustes, Tipos y marcas. Vacío lo borra.'),
    solo_contar: z.boolean().optional().describe('true (así viene) = no cambia nada, muestra qué cambiaría. false = cambia los nombres.'),
  }),
  readOnly: false,
  destructive: true,
  logsItself: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const dryRun = args.solo_contar !== false;
    const shortNames = Object.fromEntries((args.nombres_cortos ?? []).map((n) => [n.tipo, n.nombre_corto]));
    const plan = await asToolError(() =>
      planRenames(ctx.db, {
        accountId: account.id,
        format: args.formato,
        filters: { brands: args.marca, types: args.tipo_de_producto, productIds: args.producto_ids },
        shortNames,
      }),
    );
    if (dryRun) return { cuenta: account.slug, solo_contar: true, mensaje: 'No se cambió nada.', ...planOut(plan) };
    await asToolError(async () => {
      for (const n of args.nombres_cortos ?? []) await setTypeShortName(ctx.db, account.id, n.tipo, n.nombre_corto);
    });
    await applyRenames(ctx.db, { accountId: account.id, plan, userId: ctx.userId, via: 'CLAUDE' });
    return { cuenta: account.slug, solo_contar: false, mensaje: `Se cambió el nombre de ${plan.toRename.length} productos.`, ...planOut(plan) };
  },
});

export const PRODUCT_NAME_TOOLS = [renameProductsTool];
