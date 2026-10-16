import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PASSWORD_MIN } from '@/lib/auth';
import { AuthCard } from '@/components/auth/AuthCard';
import { FirstUserForm } from '@/components/auth/FirstUserForm';

export const metadata = { title: 'Primer ingreso' };

export const dynamic = 'force-dynamic';

// Solo existe mientras no haya ningún usuario. Después se apaga sola.
export default async function FirstUserPage() {
  if ((await prisma.user.count()) > 0) redirect('/login');
  return (
    <AuthCard subtitle="Todavía no hay usuarios. Creá el tuyo para empezar.">
      <FirstUserForm passwordMin={PASSWORD_MIN} />
    </AuthCard>
  );
}
