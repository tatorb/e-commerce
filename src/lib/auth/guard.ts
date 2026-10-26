import { can, canSeeAccount, SECTIONS, TEAM_SECTION, type Level, type Section } from '@/domain/access';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import { requireUser, type CurrentUser } from '@/lib/auth/session';
import { getAccountBySlug } from '@/lib/queries/accounts';

// Antes de cada acción: que la persona vea la cuenta y pueda hacerlo en la
// sección. Después, si salió bien, queda anotado en la actividad. Lo usan
// todas las acciones del servidor de la app.

export type Denied = { ok: false; error: string };

type AccountRow = NonNullable<Awaited<ReturnType<typeof getAccountBySlug>>>;

export type ActSpec<R = unknown> = {
  // La sección, o las secciones desde donde se puede hacer: alcanza con poder en una.
  section: Section | readonly Section[];
  // Cambiar, salvo que se diga que solo lee.
  level?: Level;
  // Lo puede intentar cualquiera que vea la cuenta: la acción mira ella misma
  // si le toca, como mover una tarea propia. La sección queda para la actividad.
  own?: boolean;
  // Qué hizo, para la actividad: "Aprobó el título". Sin esto no se anota, como en lo que solo lee.
  does?: string;
  publicationId?: string | null;
  productId?: string | null;
  // La pregunta de un comprador: se anota su publicación.
  questionId?: string | null;
  // Cómo se llamaba, para lo que se borra en la acción.
  targetLabel?: string | null;
  // Sobre qué, cuando se sabe al terminar: por ejemplo el título de la tarea.
  targetOf?: (r: R) => string | null | undefined;
  detail?: string | null;
};

export type ActContext = { user: CurrentUser; account: AccountRow };

const primary = (s: ActSpec['section']): Section => (typeof s === 'string' ? s : s[0]);

/** El motivo cuando no tiene permiso, nombrando la sección. */
export function deniedFor(section: ActSpec['section'], level: Level): Denied {
  const label = SECTIONS[primary(section)].label;
  return {
    ok: false,
    error: level === 'write' ? `Tu usuario no puede hacer cambios en ${label}. Pedile el permiso a un administrador.` : `Tu usuario no puede ver ${label}.`,
  };
}

// Salió bien si no devolvió { ok: false }.
const succeeded = (r: unknown) => !(r && typeof r === 'object' && 'ok' in r && (r as { ok: unknown }).ok === false);

/** Corre la acción de una cuenta con sus permisos, y la anota si salió bien. */
export async function act<R>(accountSlug: string, spec: ActSpec<R>, run: (ctx: ActContext) => Promise<R>): Promise<R | Denied> {
  const user = await requireUser();
  const account = await getAccountBySlug(String(accountSlug ?? ''));
  if (!account || !canSeeAccount(user.access, account.id)) return { ok: false, error: 'La cuenta no existe.' };
  const level = spec.level ?? 'write';
  if (!spec.own && !can(user.access, spec.section, level)) return deniedFor(spec.section, level);
  const r = await run({ user, account });
  if (spec.does && succeeded(r)) {
    const fromQuestion = spec.questionId && !spec.publicationId
      ? ((await prisma.buyerQuestion.findUnique({ where: { id: spec.questionId }, select: { publicationId: true } }))?.publicationId ?? null)
      : null;
    await logActivity(prisma, {
      userId: user.id,
      accountId: account.id,
      section: primary(spec.section),
      summary: spec.does,
      publicationId: spec.publicationId ?? fromQuestion,
      productId: spec.productId ?? null,
      targetLabel: spec.targetOf?.(r) ?? spec.targetLabel ?? null,
      detail: spec.detail ?? null,
    });
  }
  return r;
}

/** Lo de Equipo que solo pueden hacer los administradores, anotado en la actividad. */
export async function actAsAdmin<R>(
  spec: { does?: string; targetLabel?: string | null; detail?: string | null },
  run: (user: CurrentUser) => Promise<R>,
): Promise<R | Denied> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, error: 'Solo un administrador puede hacer esto.' };
  const r = await run(user);
  if (spec.does && succeeded(r)) {
    await logActivity(prisma, { userId: user.id, section: TEAM_SECTION, summary: spec.does, targetLabel: spec.targetLabel, detail: spec.detail });
  }
  return r;
}
