import { notFound } from 'next/navigation';
import { AppShell } from '@/components/dashboard/AppShell';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { requireUser } from '@/lib/auth/session';
import { listAccounts } from '@/lib/queries/accounts';
import { prisma } from '@/lib/db';

// Arma la pantalla con sesión: menú lateral con la cuenta y el área central.
// Sin cuenta en la dirección (por ejemplo en Equipo), muestra la primera.
export async function AppFrame({
  accountSlug,
  children,
}: {
  accountSlug?: string;
  children: React.ReactNode;
}) {
  // La sesión y las cuentas se piden juntas; la cuenta de la dirección sale de la lista.
  const [user, accounts] = await Promise.all([requireUser(), listAccounts()]);
  const account = accountSlug ? accounts.find((a) => a.slug === accountSlug) : accounts[0];
  if (!account) notFound();

  const options = accounts.map((a) => ({ slug: a.slug, name: a.name }));
  // Las preguntas sin responder, para verlas apenas se entra.
  const questions = await prisma.buyerQuestion.count({ where: { status: 'UNANSWERED', store: { accountId: account.id } } });
  const sidebar = (
    <Sidebar user={user} account={{ slug: account.slug, name: account.name }} accounts={options} questions={questions} />
  );
  return (
    <AppShell sidebar={sidebar} homeHref={`/a/${account.slug}/pipeline`}>
      {children}
    </AppShell>
  );
}
