import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { listAccounts } from '@/lib/queries/accounts';

export const dynamic = 'force-dynamic';

// Inicio: sin usuarios va al primer ingreso, sin sesión al login y con
// sesión a los productos de la primera cuenta.
export default async function Home() {
  if ((await prisma.user.count()) === 0) redirect('/primer-ingreso');
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [first] = await listAccounts();
  if (!first) redirect('/equipo');
  redirect(`/a/${first.slug}/productos`);
}
