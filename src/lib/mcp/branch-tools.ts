import { z } from 'zod';
import { StockError } from '@/domain/stock';
import { accountBranches, findBranch, saveBranch } from '@/lib/branches';
import { afterBranchFlex, flexPlans } from '@/lib/branch-flex';
import { assignSaleBranch, salesWithoutBranch } from '@/lib/sale-branch';
import { McpToolError, accountArg, defineTool, resolveAccount } from './tool';

// Las sucursales de la cuenta desde Claude: verlas y crearlas o cambiarlas,
// con su Flex. Con sucursales, el stock del producto es la suma del de cada
// una y Envíos Flex sigue al stock de las sucursales con Flex.

// Lo que tarda como mucho en revisar Flex al cambiar una sucursal; lo demás lo termina la pasada de cada hora.
const FLEX_BUDGET_MS = 25_000;

/** Las publicaciones de la cuenta que podrían seguir el Flex por stock. */
async function accountPublications(db: Parameters<typeof flexPlans>[0], accountId: string): Promise<string[]> {
  const rows = await db.publication.findMany({ where: { product: { accountId }, externalId: { not: null } }, select: { id: true } });
  return rows.map((r) => r.id);
}

const getBranchesTool = defineTool({
  name: 'get_branches',
  section: 'productos',
  title: 'Ver las sucursales y su Flex',
  description:
    'Las sucursales de la cuenta, cada una con su depósito, y si despacha Envíos Flex. Con sucursales, el stock de cada producto es la suma del de cada una, las ventas Flex salen de una sucursal con Flex, las demás esperan que una persona elija de qué sucursal salieron (ventas_sin_sucursal, con una tarea abierta; se elige con assign_sale_branch) y Envíos Flex se prende y se apaga solo en cada publicación según haya stock en una sucursal con Flex. Devuelve también cuántas publicaciones siguen ese Flex, cuántas tienen que tenerlo prendido y cuántas lo tienen distinto en el canal (la pasada de cada hora lo corrige). El stock de cada sucursal de un producto se ve en get_publication (stock_por_sucursal).',
  input: z.object({ cuenta: accountArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const branches = await accountBranches(ctx.db, account.id);
    if (branches.length === 0) return { cuenta: account.slug, sucursales: [], aviso: 'La cuenta no tiene sucursales: el stock es uno solo y Flex se cambia a mano. Se crean con save_branch.' };
    const plans = [...(await flexPlans(ctx.db, await accountPublications(ctx.db, account.id))).values()];
    const follow = plans.filter((p) => p.follows);
    return {
      cuenta: account.slug,
      sucursales: branches.map((b) => ({ id: b.id, nombre: b.name, flex: b.flex })),
      ventas_sin_sucursal: (await salesWithoutBranch(ctx.db, account.id)).map((s) => ({
        venta: s.orderId,
        fecha: s.orderedAt.toISOString().slice(0, 10),
        lineas: s.parts.map((p) => ({ linea: p.moveId, producto: p.product, ...(p.measure ? { medida: p.measure } : {}), unidades: p.units, publicacion: p.publication?.externalId ?? null })),
      })),
      flex_por_stock: {
        siguen_al_stock: follow.length,
        con_flex_por_stock: follow.filter((p) => p.follows && p.on).length,
        distinto_en_el_canal: follow.filter((p) => p.follows && p.on !== p.current).length,
        cambiadas_a_mano: plans.filter((p) => !p.follows && p.reason.startsWith('Flex se cambió a mano')).length,
      },
    };
  },
});

const saveBranchTool = defineTool({
  name: 'save_branch',
  section: 'productos',
  title: 'Crear o cambiar una sucursal',
  description:
    'Crea una sucursal de la cuenta, o cambia una que ya existe: su nombre y si despacha Envíos Flex. La primera sucursal que se crea se queda con todo el stock que ya estaba cargado; las que se suman después empiezan en 0 y su stock se carga con set_product_stock (sucursal). Las ventas Flex salen de una sucursal con Flex; en las demás, una persona elige de cuál salieron (assign_sale_branch). Prender o apagar el Flex de una sucursal prende o apaga Envíos Flex en Mercado Libre en las publicaciones que siguen al stock, según haya stock en una sucursal con Flex; si ninguna sucursal queda con Flex, se apaga en todas. Antes de hacerlo, mostrale a la persona qué va a cambiar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    sucursal: z.string().min(1).max(80).optional().describe('La sucursal a cambiar: su id o su nombre. Sin mandar, se crea una nueva con nombre.'),
    nombre: z.string().min(1).max(80).optional().describe('El nombre: el de la nueva, o el nuevo nombre.'),
    flex: z.boolean().optional().describe('Si despacha Envíos Flex. Sin mandar, queda como está (una nueva, sin Flex).'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const branches = await accountBranches(ctx.db, account.id);
    let id: string | undefined;
    if (args.sucursal) {
      const found = findBranch(branches, args.sucursal);
      if (!found) throw new McpToolError(`"${args.sucursal}" no es una sucursal de la cuenta.${branches.length ? ` Sucursales: ${branches.map((b) => b.name).join(', ')}.` : ''}`);
      id = found.id;
    } else if (!args.nombre) {
      throw new McpToolError('Pasá el nombre de la sucursal nueva, o la sucursal a cambiar.');
    }
    let r;
    try {
      r = await saveBranch(ctx.db, { accountId: account.id, branch: { id, name: args.nombre, flex: args.flex } });
    } catch (e) {
      if (e instanceof StockError) throw new McpToolError(e.message);
      throw e;
    }
    const flex = r.flexChanged ? await afterBranchFlex(ctx.db, { accountId: account.id, userId: ctx.userId, budgetMs: FLEX_BUDGET_MS }) : null;
    return {
      guardada: true,
      sucursal: { id: r.branch.id, nombre: r.branch.name, flex: r.branch.flex },
      ...(r.tookStock > 0 ? { stock_que_paso_a_esta_sucursal: `${r.tookStock} medidas de productos con el stock que ya estaba cargado.` } : {}),
      ...(flex
        ? {
            flex_en_el_canal: {
              prendido_en: flex.changed.filter((c) => c.on).length,
              apagado_en: flex.changed.filter((c) => !c.on).length,
              no_se_pudo: flex.failed.length,
              ...(flex.pending ? { aviso: 'Quedaron publicaciones por revisar: las termina la pasada de cada hora.' } : {}),
            },
          }
        : {}),
    };
  },
});

const assignSaleBranchTool = defineTool({
  name: 'assign_sale_branch',
  section: 'productos',
  title: 'Elegir de qué sucursal salió una venta',
  description:
    'En una cuenta con sucursales, una venta que no es Flex baja el stock total pero queda sin sucursal, con una tarea abierta, hasta que una persona dice de cuál salió. Esta herramienta lo dice: una sucursal para toda la venta, o una por línea (las líneas y sus números salen en get_branches, ventas_sin_sucursal). Baja el stock de esa sucursal, cierra la tarea y, si cambia el stock de una sucursal con Flex, prende o apaga Envíos Flex en Mercado Libre en las publicaciones que lo siguen. Usala solo con lo que te dice la persona, y antes mostrale qué vas a anotar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    venta: z.string().min(1).max(40).describe('El número de la venta en el canal.'),
    sucursal: z.string().min(1).max(80).optional().describe('La sucursal de toda la venta, por su nombre.'),
    lineas: z
      .array(z.object({ linea: z.number().int().positive(), sucursal: z.string().min(1).max(80) }))
      .max(50)
      .optional()
      .describe('Una sucursal por línea, si salieron de sucursales distintas.'),
  }),
  readOnly: false,
  destructive: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const branches = await accountBranches(ctx.db, account.id);
    const pick = (ref: string) => {
      const b = findBranch(branches, ref);
      if (!b) throw new McpToolError(`"${ref}" no es una sucursal de la cuenta. Sucursales: ${branches.map((x) => x.name).join(', ')}.`);
      return b.id;
    };
    if (!args.sucursal && !args.lineas?.length) throw new McpToolError('Pasá la sucursal de la venta, o la de cada línea.');
    const sale = await ctx.db.channelSale.findFirst({ where: { orderId: args.venta.trim(), store: { accountId: account.id } }, select: { id: true } });
    if (!sale) throw new McpToolError(`La venta ${args.venta} no está en la cuenta.`);
    try {
      const r = await assignSaleBranch(ctx.db, {
        accountId: account.id,
        saleId: sale.id,
        branchId: args.sucursal ? pick(args.sucursal) : undefined,
        byPart: Object.fromEntries((args.lineas ?? []).map((l) => [l.linea, pick(l.sucursal)])),
        userId: ctx.userId,
      });
      return {
        anotado: r.assigned.map((a) => ({ producto: a.part.product, ...(a.part.measure ? { medida: a.part.measure } : {}), unidades: a.part.units, sucursal: a.branch })),
        ...(r.left > 0 ? { faltan: `${r.left} líneas sin sucursal: la tarea sigue abierta.` } : { tarea: 'cerrada' }),
        ...(r.flex.changed.length ? { flex_cambiado_por_stock: r.flex.changed.map((f) => ({ publicacion_id: f.publicationId, flex: f.on ? 'prendido' : 'apagado' })) } : {}),
      };
    } catch (e) {
      if (e instanceof StockError) throw new McpToolError(e.message);
      throw e;
    }
  },
});

export const BRANCH_TOOLS = [getBranchesTool, saveBranchTool, assignSaleBranchTool];
