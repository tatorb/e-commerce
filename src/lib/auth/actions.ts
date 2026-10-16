'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { APIError } from 'better-auth/api';
import { prisma } from '@/lib/db';
import { auth, PASSWORD_MIN } from '@/lib/auth';
import { requireUser, sanitizeNextPath } from '@/lib/auth/session';

export type ActionResult = { ok: true } | { ok: false; error: string };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Escribí un email válido.'));
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .max(128, 'La contraseña es demasiado larga.');
const nameSchema = z.string().trim().min(1, 'Poné un nombre.').max(120);

function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? 'Revisá los datos.';
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
  try {
    await auth.api.signInEmail({
      body: { email: email.data, password: input.password },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) return { ok: false, error: 'Email o contraseña incorrectos.' };
    throw e;
  }
  redirect(sanitizeNextPath(input.next));
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect('/login');
}

/**
 * Crea el primer usuario. Solo funciona mientras no haya ninguno: después,
 * las altas se hacen desde Equipo.
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

  await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  await auth.api.signInEmail({
    body: { email: parsed.data.email, password: parsed.data.password },
    headers: await headers(),
  });
  redirect('/');
}

/** Alta de otra persona del equipo, con una contraseña temporal. */
export async function addTeamMember(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = z
    .object({ name: nameSchema, email: emailSchema, password: passwordSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { ok: false, error: 'Ya hay una persona con ese email.' };

  await auth.api.signUpEmail({ body: parsed.data, headers: await headers() });
  return { ok: true };
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  await requireUser();
  const parsed = passwordSchema.safeParse(input.newPassword);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
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
  return { ok: true };
}
