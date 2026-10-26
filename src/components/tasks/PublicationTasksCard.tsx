import Link from 'next/link';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { isOpen } from '@/domain/tasks';
import type { TaskItem } from '@/lib/tasks';
import { plural } from '@/lib/format';
import { TaskDialog, type PersonOption, type PublicationOption } from './TaskDialog';
import { TaskList } from './TaskList';

// Las tareas de una publicación, en su página y en su paso del pipeline. Las
// cerradas quedan plegadas.

export function PublicationTasksCard({
  accountSlug,
  publication,
  tasks,
  people,
  meId,
  canCreate,
  timeZone,
}: {
  accountSlug: string;
  publication: PublicationOption;
  tasks: TaskItem[];
  people: PersonOption[];
  meId: string;
  canCreate: boolean;
  timeZone: string;
}) {
  const now = new Date();
  const open = tasks.filter((t) => isOpen(t.status));
  const closed = tasks.filter((t) => !isOpen(t.status));
  return (
    <SectionCard
      title="Tareas"
      count={open.length}
      description="Lo que hay que hacer con esta publicación. Todas las tareas de la cuenta están en Tareas."
      action={
        canCreate ? (
          <TaskDialog accountSlug={accountSlug} timeZone={timeZone} people={people} meId={meId} presetPublications={[publication]} />
        ) : null
      }
    >
      {open.length > 0 ? (
        <TaskList accountSlug={accountSlug} tasks={open} now={now} timeZone={timeZone} showPublications={false} />
      ) : (
        <SectionBody>
          <p className="text-sm text-muted-foreground">
            No tiene tareas abiertas.{' '}
            <Link href={`/a/${accountSlug}/tareas`} className="underline-offset-4 hover:underline">
              Ver todas las tareas
            </Link>
          </p>
        </SectionBody>
      )}
      {closed.length > 0 ? (
        <details className="border-t">
          <summary className="cursor-pointer px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">
            Ver las cerradas ({plural(closed.length, 'finalizada o suspendida', 'finalizadas o suspendidas')})
          </summary>
          <div className="border-t">
            <TaskList accountSlug={accountSlug} tasks={closed} now={now} timeZone={timeZone} showPublications={false} />
          </div>
        </details>
      ) : null}
    </SectionCard>
  );
}
