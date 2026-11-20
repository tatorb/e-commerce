import { z } from 'zod';
import { StockError } from '@/domain/stock';
import { accountBranches, findBranch, saveBranch } from '@/lib/branches';
import { afterBranchFlex, flexPlans } from '@/lib/branch-flex';
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
    'Las sucursales de la cuenta, cada una con su depósito: si despacha Envíos Flex y cuál es la principal, de la que salen primero las ventas que no son Flex. Con sucursales, el stock de cada producto es la suma del de cada una, las ventas Flex salen de una sucursal con Flex y Envíos Flex se prende y se apaga solo en cada publicación según haya stock en una sucursal con Flex. Devuelve también cuántas publicaciones siguen ese Flex, cuántas tienen que tenerlo prendido y cuántas lo tienen distinto en el canal (la pasada de cada hora lo corrige). El stock de cada sucursal de un producto se ve en get_publication (stock_por_sucursal).',
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
      sucursales: branches.map((b) => ({ id: b.id, nombre: b.name, flex: b.flex, principal: b.main })),
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
    'Crea una sucursal de la cuenta, o cambia una que ya existe: su nombre, si despacha Envíos Flex y si es la principal. La primera sucursal que se crea se queda con todo el stock que ya estaba cargado y es la principal; las que se suman después empiezan en 0 y su stock se carga con set_product_stock (sucursal). Las ventas Flex salen de una sucursal con Flex; las demás, de la principal y, si no alcanza, de las otras. Prender o apagar el Flex de una sucursal prende o apaga Envíos Flex en Mercado Libre en las publicaciones que siguen al stock, según haya stock en una sucursal con Flex; si ninguna sucursal queda con Flex, se apaga en todas. Antes de hacerlo, mostrale a la persona qué va a cambiar y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    sucursal: z.string().min(1).max(80).optional().describe('La sucursal a cambiar: su id o su nombre. Sin mandar, se crea una nueva con nombre.'),
    nombre: z.string().min(1).max(80).optional().describe('El nombre: el de la nueva, o el nuevo nombre.'),
    flex: z.boolean().optional().describe('Si despacha Envíos Flex. Sin mandar, queda como está (una nueva, sin Flex).'),
    principal: z.boolean().optional().describe('true: pasa a ser la principal, de la que salen primero las ventas que no son Flex.'),
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
      r = await saveBranch(ctx.db, { accountId: account.id, branch: { id, name: args.nombre, flex: args.flex, main: args.principal } });
    } catch (e) {
      if (e instanceof StockError) throw new McpToolError(e.message);
      throw e;
    }
    const flex = r.flexChanged ? await afterBranchFlex(ctx.db, { accountId: account.id, userId: ctx.userId, budgetMs: FLEX_BUDGET_MS }) : null;
    return {
      guardada: true,
      sucursal: { id: r.branch.id, nombre: r.branch.name, flex: r.branch.flex, principal: r.branch.main },
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

export const BRANCH_TOOLS = [getBranchesTool, saveBranchTool];
