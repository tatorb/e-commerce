import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { can, canSeeAccount, type Section } from '@/domain/access';
import { getCurrentUser, requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';

// Cada página de una cuenta pide la sesión ella misma. Al navegar dentro de la
// app, Next arma solo la página nueva y no el marco con el menú, así que el
// control de sesión del marco no alcanza: sin esto, un pedido armado a mano
// podía traer los datos de una página sin haber entrado.

/**
 * La cuenta de la dirección, solo con sesión y si la persona la ve. Con una
 * sección, también tiene que poder verla: si no, va al aviso de que no tiene permiso.
 */
export const requireAccount = cache(async (slug: string, section?: Section) => {
  const [user, account] = await Promise.all([requireUser(), getAccountBySlug(slug)]);
  if (!account || !canSeeAccount(user.access, account.id)) notFound();
  if (section && !can(user.access, section, 'read')) redirect(`/a/${account.slug}/sin-permiso?seccion=${section}`);
  return { user, account, canWrite: section ? can(user.access, section, 'write') : false };
});

/** Para el título de la pestaña: sin sesión, o sin acceso a la cuenta, no se dice ni su nombre. */
export async function accountForTitle(slug: string) {
  const [user, account] = await Promise.all([getCurrentUser(), getAccountBySlug(slug)]);
  return user && account && canSeeAccount(user.access, account.id) ? account : null;
}
