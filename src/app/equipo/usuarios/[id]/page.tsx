import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { SectionCard } from '@/components/ui/section-card';
import { UserForm } from '@/components/team/UserForm';
import { UserStatusCard } from '@/components/team/UserStatusCard';
import { parsePermissions, sectionLabel } from '@/domain/access';
import { VIA_LABEL } from '@/domain/activity';
import { PASSWORD_MIN } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { listAccounts } from '@/lib/queries/accounts';

export const metadata = { title: 'Persona · Equipo' };

export const dynamic = 'force-dynamic';

// Lo último que hizo, para tenerlo a mano al cambiarle los permisos.
const RECENT = 10;

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const [{ id }, { nuevo }] = await Promise.all([params, searchParams]);
  const me = await requireAdmin();
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        permissions: true,
        disabledAt: true,
        mustChangePassword: true,
        accounts: { select: { accountId: true } },
        activity: {
          orderBy: { createdAt: 'desc' },
          take: RECENT,
          select: { id: true, createdAt: true, summary: true, section: true, targetLabel: true, via: true, account: { select: { name: true } } },
        },
      },
    }),
    listAccounts(),
  ]);
  if (!user) notFound();

  return (
    <>
      <PageHeader>
        <div className="space-y-2">
          <Breadcrumb items={[{ label: 'Equipo', href: '/equipo' }, { label: user.name }]} />
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {user.email}
            {user.disabledAt ? ` · dada de baja el ${formatDateTime(user.disabledAt)}` : ''}
            {user.mustChangePassword && !user.disabledAt ? ' · tiene que cambiar la contraseña al entrar' : ''}
          </p>
        </div>
      </PageHeader>
      <PageBody>
        {nuevo ? (
          <p role="status" className="rounded-md border px-3 py-2 text-sm">
            Listo, ya puede entrar con su email y la contraseña temporal. La primera vez le pide cambiarla.
          </p>
        ) : null}
        <UserForm
          userId={user.id}
          initial={{
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            permissions: parsePermissions(user.permissions),
            accountIds: user.accounts.map((a) => a.accountId),
          }}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          passwordMin={PASSWORD_MIN}
        />
        <UserStatusCard userId={user.id} disabled={Boolean(user.disabledAt)} isSelf={user.id === me.id} passwordMin={PASSWORD_MIN} />
        <SectionCard
          title="Lo último que hizo"
          action={
            <Link href={`/equipo/actividad?persona=${user.id}`} className="text-xs font-medium underline-offset-4 hover:underline">
              Ver toda su actividad
            </Link>
          }
        >
          {user.activity.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">Todavía no hizo nada.</p>
          ) : (
            <ul className="divide-y text-sm">
              {user.activity.map((a) => (
                <li key={a.id} className="space-y-0.5 px-4 py-2.5">
                  <p className="tabular-nums text-xs text-muted-foreground">
                    {formatDateTime(a.createdAt)}
                    {a.account ? ` · ${a.account.name}` : ''}
                    {a.section ? ` · ${sectionLabel(a.section)}` : ''}
                    {a.via === 'CLAUDE' ? ` · desde ${VIA_LABEL.CLAUDE}` : ''}
                  </p>
                  <p>
                    {a.summary}
                    {a.targetLabel ? <span className="text-muted-foreground"> · {a.targetLabel}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </PageBody>
    </>
  );
}
