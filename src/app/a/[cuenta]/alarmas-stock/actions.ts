'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { act } from '@/lib/auth/guard';
import { saveStockTaskRecipients, StockRecipientsError } from '@/lib/stock-task-recipients';
import { saveBranch } from '@/lib/branches';
import { afterBranchFlex } from '@/lib/branch-flex';
import { StockError } from '@/domain/stock';

// A quién le llegan las tareas de stock de la cuenta. Es asignar tareas: lo
// pide el permiso de editar Tareas.

type Result = { ok: true; added: number; removed: number } | { ok: false; error: string };

export async function saveStockTaskRecipientsAction(accountSlug: string, userIds: string[]) {
  const spec = { section: 'tareas', does: 'Eligió a quién le llegan las tareas de stock' } as const;
  return act<Result>(accountSlug, spec, async ({ account }) => {
    try {
      const r = await saveStockTaskRecipients(prisma, account.id, Array.isArray(userIds) ? userIds.map(String) : []);
      revalidatePath(`/a/${account.slug}/alarmas-stock`);
      return { ok: true, ...r };
    } catch (e) {
      if (e instanceof StockRecipientsError) return { ok: false, error: e.message };
      throw e;
    }
  });
}

// Las sucursales: crear una, prender o apagar su Flex y elegir la principal.
// Cambiar el Flex de una sucursal prende o apaga Envíos Flex en el canal en las
// publicaciones que siguen al stock: lo pide el permiso de editar Productos.

type BranchResult = { ok: true; message: string } | { ok: false; error: string };

export async function saveBranchAction(accountSlug: string, branch: { id?: string; name?: string; flex?: boolean; main?: boolean }) {
  const spec = { section: 'productos', does: branch.id ? 'Cambió una sucursal' : 'Creó una sucursal' } as const;
  return act<BranchResult>(accountSlug, spec, async ({ account, user }) => {
    try {
      const r = await saveBranch(prisma, {
        accountId: account.id,
        branch: { id: branch.id ? String(branch.id) : undefined, name: branch.name, flex: branch.flex, main: branch.main },
      });
      let flex = '';
      if (r.flexChanged) {
        const f = await afterBranchFlex(prisma, { accountId: account.id, userId: user.id, budgetMs: 25_000 });
        flex = ` Flex se prendió en ${f.changed.filter((c) => c.on).length} y se apagó en ${f.changed.filter((c) => !c.on).length} publicaciones.${f.pending ? ' Las que faltan las termina la pasada de cada hora.' : ''}`;
      }
      revalidatePath(`/a/${account.slug}`, 'layout');
      const took = r.tookStock > 0 ? ' Se quedó con todo el stock que ya estaba cargado.' : '';
      return { ok: true, message: `Guardada.${took}${flex}` };
    } catch (e) {
      if (e instanceof StockError) return { ok: false, error: e.message };
      throw e;
    }
  });
}
