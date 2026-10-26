'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_STATUS_LABEL, TASK_STATUSES } from '@/domain/tasks';
import type { TaskStatus } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils/cn';
import { setTaskStatusAction } from '@/app/a/[cuenta]/tareas/actions';

// El estado de una tarea, para cambiarlo ahí mismo. Lo cambian sus personas y
// quien puede cambiar en Tareas.

const TONE: Record<TaskStatus, string> = {
  PENDING: '',
  IN_PROGRESS: 'border-foreground/40 font-medium',
  DONE: 'text-muted-foreground',
  SUSPENDED: 'text-muted-foreground',
};

export function TaskStatusSelect({
  accountSlug,
  taskId,
  status,
  canMove,
  className,
}: {
  accountSlug: string;
  taskId: string;
  status: TaskStatus;
  canMove: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: TaskStatus) {
    const before = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const r = await setTaskStatusAction(accountSlug, taskId, next);
      if (!r.ok) {
        setValue(before);
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Select value={value} onValueChange={(v) => change(v as TaskStatus)} disabled={!canMove || pending}>
        <SelectTrigger
          className={cn('h-8 w-36 text-xs', TONE[value])}
          aria-label="Estado de la tarea"
          title={canMove ? undefined : 'Le cambian el estado sus personas o quien puede cambiar en Tareas.'}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p role="status" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
