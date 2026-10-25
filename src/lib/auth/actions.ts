'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { prisma } from '@/lib/db';
import { auth, PASSWORD_MIN } from '@/lib/auth';
import { getCurrentUser, requireUser, sanitizeNextPath } from '@/lib/auth/session';
import { actAsAdmin } from '@/lib/auth/guard';
import { logActivity } from '@/lib/activity';
import { saveUserAccess, saveUserProfile, setUserDisabled, UserError, type UserAccessInput } from '@/lib/users';
import { TEAM_SECTION } from '@/domain/access';

export type ActionResult = { ok: true } | { ok: false; error: string };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Escribí un email válido.'));
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .max(128, 'La contraseña es demasiado larga.');
const nameSchema = z.string().trim().min(1, 'Poné un nombre.').max(120);

const accessSchema = z.object({
  isAdmin: z.boolean(),
  permissions: z.record(z.string(), z.enum(['read', 'write'])),
  accountIds: z.array(z.string().max(40)).max(500),
});

function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? 'Revisá los datos.';
}

/** Si la contraseña es la de ese usuario, sin abrir una sesión. */
async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const cred = await prisma.authAccount.findFirst({ where: { userId, providerId: 'credential' }, select: { password: true } });
  if (!cred?.password) return false;
  const ctx = await auth.$context;
  return ctx.password.verify({ hash: cred.password, password });
}

export async function signIn(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<ActionResult> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success || !input.password) {
    return { ok: false, error: 'Email o contraseña incorrectos.' };
  }
  const known = await prisma.user.findUnique({ where: { email: email.data }, select: { id: true, disabledAt: true } });
  const failed = () => logActivity(prisma, { userId: known?.id ?? null, email: email.data, kind: 'SIGN_IN_FAILED', summary: 'No pudo entrar' });
  // Dado de baja: se le dice solo si la contraseña es la correcta.
  if (known?.disabledAt) {
    await failed();
    if (await passwordMatches(known.id, input.password)) return { ok: false, error: 'Tu usuario está dado de baja. Hablá con un administrador.' };
    return { ok: false, error: 'Email o contraseña incorrectos.' };
  }
  try {
    await auth.api.signInEmail({
      body: { email: email.data, password: input.password },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) {
      await failed();
      return { ok: false, error: 'Email o contraseña incorrectos.' };
    }
    throw e;
  }
  if (known) await logActivity(prisma, { userId: known.id, kind: 'SIGN_IN', summary: 'Entró a la app' });
  redirect(sanitizeNextPath(input.next));
}

export async function signOut(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await logActivity(prisma, { userId: user.id, kind: 'SIGN_OUT', summary: 'Salió de la app' });
  await auth.api.signOut({ headers: await headers() });
  redirect('/login');
}

/**
 * Crea el primer usuario, que es administrador. Solo funciona mientras no haya
 * ninguno: después, las altas se hacen desde Equipo.
 */
export async function createFirstUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  if ((await prisma.user.count()) > 0) {
    return { ok: false, error: 'Ya hay un usuario creado. Ingresá con tu email y contraseña.' };
  }
  const parsed = z
    .object({ name: nameSchema, email: emailSchema, password: passwordSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const r = await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  await prisma.user.update({ where: { id: r.user.id }, data: { isAdmin: true } });
  await auth.api.signInEmail({
    body: { email: parsed.data.email, password: parsed.data.password },
    headers: await headers(),
  });
  await logActivity(prisma, { userId: r.user.id, kind: 'SIGN_IN', summary: 'Entró a la app por primera vez' });
  redirect('/');
}

function userFailure(e: unknown): { ok: false; error: string } {
  if (e instanceof UserError) return { ok: false, error: e.message };
  throw e;
}

/**
 * Alta de otra persona, con una contraseña temporal que cambia al entrar, y lo
 * que puede hacer. Solo administradores.
 */
export async function createUserAction(input: {
  name: string;
  email: string;
  password: string;
  access: UserAccessInput;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = z
    .object({ name: nameSchema, email: emailSchema, password: passwordSchema, access: accessSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { access, ...body } = parsed.data;
  return actAsAdmin({ does: 'Creó un usuario', targetLabel: `${body.name} (${body.email})` }, async () => {
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return { ok: false as const, error: 'Ya hay una persona con ese email.' };
    const r = await auth.api.signUpEmail({ body, headers: await headers() });
    await prisma.user.update({ where: { id: r.user.id }, data: { mustChangePassword: true } });
    try {
      await saveUserAccess(prisma, { userId: r.user.id, ...access });
    } catch (e) {
      return userFailure(e);
    }
    revalidatePath('/equipo');
    return { ok: true as const, id: r.user.id };
  });
}

/** Nombre, email, permisos y cuentas de un usuario. Solo administradores. */
export async function updateUserAction(
  userId: string,
  input: { name: string; email: string; access: UserAccessInput },
): Promise<ActionResult> {
  const parsed = z.object({ name: nameSchema, email: emailSchema, access: accessSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  return actAsAdmin({ does: 'Cambió los datos y permisos de un usuario', targetLabel: `${parsed.data.name} (${parsed.data.email})` }, async () => {
    try {
      await saveUserProfile(prisma, { userId: String(userId), name: parsed.data.name, email: parsed.data.email });
      await saveUserAccess(prisma, { userId: String(userId), ...parsed.data.access });
    } catch (e) {
      return userFailure(e);
    }
    revalidatePath('/equipo', 'layout');
    return { ok: true as const };
  });
}

/** Da de baja o vuelve a dar de alta a un usuario. Solo administradores. */
export async function setUserDisabledAction(userId: string, disabled: boolean): Promise<ActionResult> {
  const target = await prisma.user.findUnique({ where: { id: String(userId) }, select: { name: true, email: true } });
  return actAsAdmin(
    { does: disabled ? 'Dio de baja a un usuario' : 'Volvió a dar de alta a un usuario', targetLabel: target ? `${target.name} (${target.email})` : null },
    async (me) => {
      try {
        await setUserDisabled(prisma, { actorId: me.id, userId: String(userId), disabled: disabled === true });
      } catch (e) {
        return userFailure(e);
      }
      revalidatePath('/equipo', 'layout');
      return { ok: true as const };
    },
  );
}

/** Le pone una contraseña temporal a otra persona: la cambia al entrar. Cierra sus sesiones. Solo administradores. */
export async function resetUserPasswordAction(userId: string, password: string): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const target = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true, name: true, email: true } });
  if (!target) return { ok: false, error: 'El usuario no existe.' };
  return actAsAdmin({ does: 'Le dio una contraseña nueva a un usuario', targetLabel: `${target.name} (${target.email})` }, async () => {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(parsed.data);
    const cred = await prisma.authAccount.findFirst({ where: { userId: target.id, providerId: 'credential' }, select: { id: true } });
    if (cred) await prisma.authAccount.update({ where: { id: cred.id }, data: { password: hash } });
    else await ctx.internalAdapter.linkAccount({ userId: target.id, providerId: 'credential', accountId: target.id, password: hash });
    await prisma.user.update({ where: { id: target.id }, data: { mustChangePassword: true } });
    await prisma.session.deleteMany({ where: { userId: target.id } });
    revalidatePath('/equipo', 'layout');
    return { ok: true as const };
  });
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  const user = await requireUser({ pendingPassword: true });
  const parsed = passwordSchema.safeParse(input.newPassword);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (input.newPassword === input.currentPassword) return { ok: false, error: 'La contraseña nueva tiene que ser distinta de la actual.' };
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: input.currentPassword,
        newPassword: parsed.data,
        // Cerrar las otras sesiones también rota la actual, y la pantalla se
        // recargaría con la sesión vieja. Por ahora no se cierran.
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) return { ok: false, error: 'La contraseña actual no es correcta.' };
    throw e;
  }
  await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  await logActivity(prisma, { userId: user.id, section: TEAM_SECTION, summary: 'Cambió su contraseña' });
  return { ok: true };
}
