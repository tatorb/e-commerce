import { notFound } from 'next/navigation';
import { AppShell } from '@/components/dashboard/AppShell';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { requireUser } from '@/lib/auth/session';
import { visibleAccounts } from '@/lib/queries/accounts';
import { can } from '@/domain/access';
import { AccessProvider } from '@/components/access/AccessProvider';
import { prisma } from '@/lib/db';
import { attentionCount } from '@/lib/tasks';
import { outOfStockCount } from '@/lib/stock-alarms';

// Arma la pantalla con sesión: menú lateral con la cuenta y el área central.
// Sin cuenta en la dirección (por ejemplo en Equipo), muestra la primera que
// ve la persona; si no ve ninguna, el menú queda solo con Equipo.
export async function AppFrame({
  accountSlug,
  children,
}: {
  accountSlug?: string;
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // La cuenta de la dirección sale de la lista de las que ve.
  const accounts = await visibleAccounts(user.access);
  const account = accountSlug ? accounts.find((a) => a.slug === accountSlug) : accounts[0];
  if (accountSlug && !account) notFound();

  const options = accounts.map((a) => ({ slug: a.slug, name: a.name }));
  // Las preguntas sin responder, para verlas apenas se entra.
  // Y sus tareas que ya llegaron al aviso o vencieron.
  // Y las medidas que se quedaron sin stock con "Mostrar más de 5".
  const [questions, tasks, alarms] = await Promise.all([
    account && can(user.access, 'preguntas', 'read')
      ? prisma.buyerQuestion.count({ where: { status: 'UNANSWERED', store: { accountId: account.id } } })
      : 0,
    account ? attentionCount(prisma, { accountId: account.id, userId: user.id, timeZone: account.timezone }) : 0,
    account && can(user.access, 'alarmas', 'read') ? outOfStockCount(prisma, account.id) : 0,
  ]);
  const sidebar = (
    <Sidebar
      user={user}
      account={account ? { slug: account.slug, name: account.name } : null}
      accounts={options}
      questions={questions}
      tasks={tasks}
      alarms={alarms}
    />
  );
  return (
    <AppShell sidebar={sidebar} homeHref={account ? `/a/${account.slug}` : '/equipo'}>
      <AccessProvider access={{ isAdmin: user.isAdmin, permissions: user.access.permissions }}>{children}</AccessProvider>
    </AppShell>
  );
}
