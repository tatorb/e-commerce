import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { CHANGE_PASSWORD_PATH, getCurrentUser } from '@/lib/auth/session';
import { visibleAccounts } from '@/lib/queries/accounts';

export const dynamic = 'force-dynamic';

// Inicio: sin usuarios va al primer ingreso, sin sesión al login y con
// sesión a la primera cuenta que ve, en la primera sección que puede ver.
export default async function Home() {
  if ((await prisma.user.count()) === 0) redirect('/primer-ingreso');
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  const [first] = await visibleAccounts(user.access);
  if (!first) redirect('/equipo');
  redirect(`/a/${first.slug}`);
}
