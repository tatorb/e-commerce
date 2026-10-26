import Link from 'next/link';
import { BellRing, CalendarClock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { dueText, remindText, taskFlags } from '@/domain/tasks';
import type { TaskItem } from '@/lib/tasks';
import { cn } from '@/lib/utils/cn';
import { TaskStatusSelect } from './TaskStatusSelect';

// La lista de tareas: en Tareas, en la publicación y en su paso del pipeline.

export function TaskFlagBadges({ task, now, timeZone }: { task: Pick<TaskItem, 'status' | 'remindAt' | 'dueOn'>; now: Date; timeZone: string }) {
  const f = taskFlags(task, now, timeZone);
  return (
    <>
      {f.overdue ? <Badge variant="destructive">Vencida</Badge> : null}
      {f.dueToday ? <Badge variant="warning">Vence hoy</Badge> : null}
      {f.reminding && !f.overdue ? <Badge variant="secondary">Llegó el aviso</Badge> : null}
    </>
  );
}

/** Las fechas y las personas, en una línea. */
export function TaskMeta({ task, now, timeZone, className }: { task: TaskItem; now: Date; timeZone: string; className?: string }) {
  const due = dueText(task, now, timeZone);
  const remind = remindText(task.remindAt, timeZone);
  const f = taskFlags(task, now, timeZone);
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3 w-3" aria-hidden />
        {task.people.map((p) => p.name).join(', ')}
      </span>
      {due ? (
        <span className={cn('inline-flex items-center gap-1', f.overdue && 'font-medium text-destructive')}>
          <CalendarClock className="h-3 w-3" aria-hidden />
          {due}
        </span>
      ) : null}
      {remind ? (
        <span className="inline-flex items-center gap-1">
          <BellRing className="h-3 w-3" aria-hidden />
          {remind}
        </span>
      ) : null}
    </p>
  );
}

export function TaskList({
  accountSlug,
  tasks,
  now,
  timeZone,
  showPublications = true,
}: {
  accountSlug: string;
  tasks: TaskItem[];
  now: Date;
  timeZone: string;
  // En la publicación no hace falta repetirla.
  showPublications?: boolean;
}) {
  return (
    <ul className="divide-y">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-1">
            {/* Las marcas son bloques: no pueden ir dentro de un párrafo. */}
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/a/${accountSlug}/tareas/${t.id}`} className="min-w-0 break-words text-sm font-medium underline-offset-4 hover:underline">
                {t.title}
              </Link>
              <TaskFlagBadges task={t} now={now} timeZone={timeZone} />
            </div>
            <TaskMeta task={t} now={now} timeZone={timeZone} />
            {showPublications && t.publications.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {t.publications.slice(0, 3).map((p) => (
                  <Link key={p.id} href={`/a/${accountSlug}/publicaciones/${p.id}`} className="max-w-full truncate underline-offset-4 hover:underline">
                    {p.title}
                    <span className="text-muted-foreground">{p.externalId ? ` · ${p.externalId}` : ' · sin publicar'}</span>
                  </Link>
                ))}
                {t.publications.length > 3 ? <span className="text-muted-foreground">y {t.publications.length - 3} más</span> : null}
              </p>
            ) : null}
          </div>
          <TaskStatusSelect key={`${t.id}-${t.status}`} accountSlug={accountSlug} taskId={t.id} status={t.status} canMove={t.rights.move} className="shrink-0" />
        </li>
      ))}
    </ul>
  );
}
