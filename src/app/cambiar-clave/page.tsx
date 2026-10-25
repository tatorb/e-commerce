import { redirect } from 'next/navigation';
import { PASSWORD_MIN } from '@/lib/auth';
import { requireUser } from '@/lib/auth/session';
import { AuthCard } from '@/components/auth/AuthCard';
import { ChangePasswordForm } from '@/components/team/ChangePasswordForm';
import { signOut } from '@/lib/auth/actions';

export const metadata = { title: 'Cambiar la contraseña' };

export const dynamic = 'force-dynamic';

// Quien entra con la contraseña que le dio un administrador la cambia antes de
// usar la app.
export default async function ChangePasswordPage() {
  const user = await requireUser({ pendingPassword: true });
  if (!user.mustChangePassword) redirect('/');
  return (
    <AuthCard subtitle={`Hola, ${user.name}. Antes de seguir, cambiá la contraseña que te dieron por una tuya.`}>
      <div className="space-y-4">
        <ChangePasswordForm passwordMin={PASSWORD_MIN} currentLabel="La que te dieron" next="/" />
        <form action={signOut}>
          <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Salir
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
