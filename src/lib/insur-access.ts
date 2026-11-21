import { can } from '@/domain/access';
import { getCurrentUser } from '@/lib/auth/session';
import { INSUR_SLUG } from '@/lib/insur';
import { visibleAccounts } from '@/lib/queries/accounts';

// Quién puede mandar la lectura del sistema de Insur: una persona con sesión
// en la app, que ve la cuenta insur y puede cambiar Productos, porque la
// lectura corrige el stock y el costo.

type Caller = { error: string; status: number } | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; account: Awaited<ReturnType<typeof visibleAccounts>>[number] };

export async function insurCaller(): Promise<Caller> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Hace falta la sesión de la app: entrá a la app en este Chrome.', status: 401 };
  const account = (await visibleAccounts(user.access)).find((a) => a.slug === INSUR_SLUG);
  if (!account) return { error: 'Tu usuario no ve la cuenta insur.', status: 403 };
  if (!can(user.access, 'productos', 'write')) return { error: 'Tu usuario no puede cambiar Productos: pedile el permiso a un administrador.', status: 403 };
  return { user, account };
}
