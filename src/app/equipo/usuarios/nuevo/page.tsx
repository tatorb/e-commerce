import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { UserForm } from '@/components/team/UserForm';
import { PASSWORD_MIN } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/session';
import { listAccounts } from '@/lib/queries/accounts';

export const metadata = { title: 'Nueva persona · Equipo' };

export const dynamic = 'force-dynamic';

export default async function NewUserPage() {
  await requireAdmin();
  const accounts = await listAccounts();
  return (
    <>
      <PageHeader className="max-w-3xl">
        <div className="space-y-2">
          <Breadcrumb items={[{ label: 'Equipo', href: '/equipo' }, { label: 'Nueva persona' }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Nueva persona</h1>
        </div>
      </PageHeader>
      <PageBody className="max-w-3xl">
        <UserForm
          initial={{ name: '', email: '', isAdmin: false, permissions: {}, accountIds: accounts.length === 1 ? [accounts[0].id] : [] }}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          passwordMin={PASSWORD_MIN}
        />
      </PageBody>
    </>
  );
}
