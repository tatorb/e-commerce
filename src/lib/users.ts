import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { parsePermissions, type Permissions } from '@/domain/access';
import { revokeAllConnections } from '@/lib/mcp/oauth';

// Los usuarios de la app: qué puede cada uno, qué cuentas ve y la baja. La
// contraseña y el alta los maneja Better Auth (src/lib/auth/actions.ts).
// Recibe la base por parámetro para poder probarlo.

type Db = PrismaClient;

/** No se puede hacer el cambio: el motivo, para la pantalla. */
export class UserError extends Error {}

export type UserAccessInput = { isAdmin: boolean; permissions: Permissions; accountIds: string[] };

/** Cuántos administradores activos quedan, sin contar a uno. */
async function otherAdmins(db: Db | Prisma.TransactionClient, userId: string): Promise<number> {
  return db.user.count({ where: { isAdmin: true, disabledAt: null, id: { not: userId } } });
}

/**
 * Lo que puede un usuario y las cuentas que ve. Siempre queda al menos un
 * administrador activo, así nadie se queda sin poder manejar los usuarios.
 */
export async function saveUserAccess(db: Db, args: { userId: string } & UserAccessInput): Promise<void> {
  const user = await db.user.findUnique({ where: { id: args.userId }, select: { isAdmin: true, disabledAt: true } });
  if (!user) throw new UserError('El usuario no existe.');
  if (user.isAdmin && !args.isAdmin && !user.disabledAt && (await otherAdmins(db, args.userId)) === 0) {
    throw new UserError('Tiene que quedar al menos un administrador.');
  }
  const ids = [...new Set(args.accountIds.map(String))];
  const found = await db.account.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new UserError('Alguna de las cuentas no existe.');
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: args.userId },
      data: { isAdmin: args.isAdmin, permissions: parsePermissions(args.permissions) as Prisma.InputJsonValue },
    });
    await tx.userAccount.deleteMany({ where: { userId: args.userId, accountId: { notIn: ids } } });
    await tx.userAccount.createMany({ data: ids.map((accountId) => ({ userId: args.userId, accountId })), skipDuplicates: true });
  });
}

/** Nombre y email. El email no se puede repetir. */
export async function saveUserProfile(db: Db, args: { userId: string; name: string; email: string }): Promise<void> {
  const email = args.email.trim().toLowerCase();
  const taken = await db.user.findFirst({ where: { email, id: { not: args.userId } }, select: { id: true } });
  if (taken) throw new UserError('Ya hay otra persona con ese email.');
  const done = await db.user.updateMany({ where: { id: args.userId }, data: { name: args.name.trim(), email } });
  if (done.count === 0) throw new UserError('El usuario no existe.');
}

/**
 * Da de baja o vuelve a dar de alta. La baja cierra sus sesiones y corta sus
 * conexiones con Claude. Nadie se da de baja a sí mismo ni deja la app sin administradores.
 */
export async function setUserDisabled(db: Db, args: { actorId: string; userId: string; disabled: boolean; now?: Date }): Promise<void> {
  if (args.disabled && args.actorId === args.userId) throw new UserError('No te podés dar de baja a vos.');
  const user = await db.user.findUnique({ where: { id: args.userId }, select: { isAdmin: true } });
  if (!user) throw new UserError('El usuario no existe.');
  if (args.disabled && user.isAdmin && (await otherAdmins(db, args.userId)) === 0) {
    throw new UserError('Tiene que quedar al menos un administrador.');
  }
  await db.user.update({ where: { id: args.userId }, data: { disabledAt: args.disabled ? (args.now ?? new Date()) : null } });
  if (args.disabled) {
    await db.session.deleteMany({ where: { userId: args.userId } });
    await revokeAllConnections(db, args.userId);
  }
}

/** La lista de Equipo, con lo que puede cada uno. */
export async function listUsers(db: Db) {
  return db.user.findMany({
    orderBy: [{ disabledAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      permissions: true,
      disabledAt: true,
      mustChangePassword: true,
      createdAt: true,
      accounts: { select: { account: { select: { id: true, name: true } } } },
      activity: { where: { kind: 'SIGN_IN' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  });
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
