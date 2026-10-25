import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parsePermissions, type Access } from '@/domain/access';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  // Qué puede en cada sección y qué cuentas ve (src/domain/access.ts).
  access: Access;
  // Entró con una contraseña que le dieron y todavía no la cambió.
  mustChangePassword: boolean;
};

// Donde se cambia la contraseña que le dieron a alguien al darlo de alta.
export const CHANGE_PASSWORD_PATH = '/cambiar-clave';

/** Lo que puede un usuario, leído de la base. Null si no existe o está dado de baja. */
export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      permissions: true,
      disabledAt: true,
      mustChangePassword: true,
      accounts: { select: { accountId: true } },
    },
  });
  if (!u || u.disabledAt) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    access: { isAdmin: u.isAdmin, permissions: parsePermissions(u.permissions), accountIds: u.accounts.map((a) => a.accountId) },
    mustChangePassword: u.mustChangePassword,
  };
}

// Usuario de la sesión actual, o null. Un usuario dado de baja no tiene
// sesión aunque le quede una abierta. Memoizado por request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return loadUser(session.user.id);
});

/**
 * Para páginas y acciones que requieren sesión: si no hay, va al login. Si
 * tiene que cambiar la contraseña que le dieron, va a cambiarla antes de seguir.
 */
export async function requireUser(opts: { pendingPassword?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword && !opts.pendingPassword) redirect(CHANGE_PASSWORD_PATH);
  return user;
}

/** Para lo que solo pueden hacer los administradores. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect('/equipo');
  return user;
}

/** Acepta solo rutas internas para volver después del login. */
export function sanitizeNextPath(raw: string | undefined | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
