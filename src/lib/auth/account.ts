import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getCurrentUser, requireUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';

// Cada página de una cuenta pide la sesión ella misma. Al navegar dentro de la
// app, Next arma solo la página nueva y no el marco con el menú, así que el
// control de sesión del marco no alcanza: sin esto, un pedido armado a mano
// podía traer los datos de una página sin haber entrado.

/** La cuenta de la dirección, solo con sesión. La sesión y la cuenta se piden juntas. */
export const requireAccount = cache(async (slug: string) => {
  const [user, account] = await Promise.all([requireUser(), getAccountBySlug(slug)]);
  if (!account) notFound();
  return { user, account };
});

/** Para el título de la pestaña: sin sesión no se dice ni el nombre de la cuenta. */
export async function accountForTitle(slug: string) {
  const [user, account] = await Promise.all([getCurrentUser(), getAccountBySlug(slug)]);
  return user ? account : null;
}
