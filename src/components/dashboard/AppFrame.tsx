import { notFound } from 'next/navigation';
import { AppShell } from '@/components/dashboard/AppShell';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { requireUser } from '@/lib/auth/session';
import { getAccountBySlug, listAccounts } from '@/lib/queries/accounts';

// Arma la pantalla con sesión: menú lateral con la cuenta y el área central.
// Sin cuenta en la dirección (por ejemplo en Equipo), muestra la primera.
export async function AppFrame({
  accountSlug,
  children,
}: {
  accountSlug?: string;
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const accounts = await listAccounts();
  const account = accountSlug ? await getAccountBySlug(accountSlug) : accounts[0];
  if (!account) notFound();

  const options = accounts.map((a) => ({ slug: a.slug, name: a.name }));
  const sidebar = (
    <Sidebar user={user} account={{ slug: account.slug, name: account.name }} accounts={options} />
  );
  return (
    <AppShell sidebar={sidebar} homeHref={`/a/${account.slug}/pipeline`}>
      {children}
    </AppShell>
  );
}
