import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Breadcrumb } from '@/components/navigation/Breadcrumb';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { TaskFlagBadges } from '@/components/tasks/TaskList';
import { TaskStatusSelect } from '@/components/tasks/TaskStatusSelect';
import { dueDay, dueText, formatDay, remindText, taskFlags } from '@/domain/tasks';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { assignablePeople, getTask } from '@/lib/tasks';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Tarea · ${account.name}` : 'Tarea' };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function TaskPage({ params }: { params: Promise<{ cuenta: string; id: string }> }) {
  const { cuenta, id } = await params;
  const { user, account } = await requireAccount(cuenta, 'tareas');
  const tz = account.timezone;
  const task = await getTask(prisma, { accountId: account.id, taskId: id, viewer: user });
  if (!task) notFound();
  const people = task.rights.edit ? await assignablePeople(prisma, account.id) : [];
  const now = new Date();
  const due = dueText(task, now, tz);
  const remind = remindText(task.remindAt, tz);
  const flags = taskFlags(task, now, tz);

  return (
    <>
      <PageHeader>
        <div className="space-y-2">
          <Breadcrumb items={[{ label: 'Tareas', href: `/a/${account.slug}/tareas` }, { label: task.title }]} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h1 className="break-words text-2xl font-bold tracking-tight">{task.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <TaskFlagBadges task={task} now={now} timeZone={tz} />
                <span>
                  {task.createdBy ? `Creada por ${task.createdBy}` : 'Creada'} el {formatDateTime(task.createdAt, tz)}
                  {task.status === 'DONE' && task.doneAt ? ` · finalizada el ${formatDateTime(task.doneAt, tz)}` : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <TaskStatusSelect key={task.status} accountSlug={account.slug} taskId={task.id} status={task.status} canMove={task.rights.move} />
              {task.rights.edit ? (
                <TaskDialog
                  accountSlug={account.slug}
                  timeZone={tz}
                  people={people}
                  meId={user.id}
                  task={task}
                  afterDelete={`/a/${account.slug}/tareas`}
                />
              ) : null}
            </div>
          </div>
        </div>
      </PageHeader>
      <PageBody>
        <SectionCard title="La tarea">
          <SectionBody>
            {task.description ? (
              <p className="whitespace-pre-line break-words text-sm">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin descripción.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Fact label="Personas">{task.people.map((p) => (p.disabled ? `${p.name} (dada de baja)` : p.name)).join(', ')}</Fact>
              <Fact label="Fecha de aviso">{remind ? remind.replace(/^Aviso /, '') : <span className="text-muted-foreground">Sin aviso</span>}</Fact>
              <Fact label="Fecha de finalización">
                {task.dueOn ? (
                  <span className={cn(flags.overdue && 'font-medium text-destructive')}>
                    {formatDay(dueDay(task.dueOn))}
                    {/* "Vence hoy", "Venció hace 3 días": lo que no dice ya la fecha. */}
                    {due && !due.startsWith('Vence el') && !due.startsWith('Finalización') ? ` · ${due}` : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sin fecha</span>
                )}
              </Fact>
            </div>
          </SectionBody>
        </SectionCard>

        <SectionCard title="Publicaciones" count={task.publications.length} description="Las publicaciones sobre las que es la tarea.">
          {task.publications.length > 0 ? (
            <ul className="divide-y">
              {task.publications.map((p) => (
                <li key={p.id} className="px-4 py-2.5 text-sm">
                  <Link href={`/a/${account.slug}/publicaciones/${p.id}`} className="min-w-0 font-medium underline-offset-4 hover:underline">
                    {p.title}
                    <span className="font-normal text-muted-foreground">{p.externalId ? ` · ${p.externalId}` : ' · sin publicar'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <SectionBody>
              <p className="text-sm text-muted-foreground">No es de ninguna publicación.</p>
            </SectionBody>
          )}
        </SectionCard>
      </PageBody>
    </>
  );
}
