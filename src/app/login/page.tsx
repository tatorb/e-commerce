import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser, sanitizeNextPath } from '@/lib/auth/session';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = { title: 'Ingresar' };

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const next = sanitizeNextPath(from);
  if ((await prisma.user.count()) === 0) redirect('/primer-ingreso');
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthCard subtitle="Ingresá tu email y contraseña.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
