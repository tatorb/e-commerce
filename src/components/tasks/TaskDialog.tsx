'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusText } from '@/components/pipeline/StatusText';
import { dueDay, TASK_DESCRIPTION_MAX, TASK_TITLE_MAX, toLocalInput } from '@/domain/tasks';
import { cn } from '@/lib/utils/cn';
import { createTaskAction, deleteTaskAction, searchTaskPublicationsAction, updateTaskAction } from '@/app/a/[cuenta]/tareas/actions';

// Crear o editar una tarea: qué hay que hacer, quiénes, sobre qué
// publicaciones y cuándo avisar y terminar.

export type PersonOption = { id: string; name: string; email: string };
export type PublicationOption = { id: string; title: string; externalId: string | null };

export type EditableTask = {
  id: string;
  title: string;
  description: string;
  remindAt: Date | null;
  dueOn: Date | null;
  people: { id: string }[];
  publications: PublicationOption[];
};

const pubLabel = (p: PublicationOption) => `${p.title}${p.externalId ? ` · ${p.externalId}` : ' · sin publicar'}`;

function PublicationPicker({
  accountSlug,
  picked,
  onChange,
  disabled,
}: {
  accountSlug: string;
  picked: PublicationOption[];
  onChange: (next: PublicationOption[]) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PublicationOption[]>([]);
  const [searching, setSearching] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const n = ++last.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchTaskPublicationsAction(accountSlug, term);
      // Solo vale la respuesta de la última búsqueda.
      if (n === last.current) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q, accountSlug]);

  const term = q.trim();
  const visible = term.length < 2 ? [] : results.filter((r) => !picked.some((p) => p.id === r.id));
  return (
    <div className="space-y-2">
      <Label htmlFor="task-pub-search">Publicaciones</Label>
      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Publicaciones de la tarea">
          {picked.map((p) => (
            <li key={p.id} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs">
              <span className="truncate">{pubLabel(p)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(picked.filter((x) => x.id !== p.id))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Quitar ${p.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Ninguna. Una tarea puede no ser de ninguna publicación.</p>
      )}
      <Input id="task-pub-search" value={q} disabled={disabled} placeholder="Buscar por título, código o producto" onChange={(e) => setQ(e.target.value)} />
      {term.length >= 2 ? (
        visible.length > 0 ? (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-md border" aria-label="Publicaciones encontradas">
            {visible.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm">{pubLabel(p)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  access="tareas"
                  disabled={disabled}
                  aria-label={`Sumar ${p.title}`}
                  onClick={() => {
                    onChange([...picked, p]);
                    setQ('');
                    setResults([]);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Sumar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{searching ? 'Buscando…' : 'No hay publicaciones con eso.'}</p>
        )
      ) : null}
    </div>
  );
}

export function TaskDialog({
  accountSlug,
  timeZone,
  people,
  meId,
  task,
  presetPublications = [],
  size = 'sm',
  afterDelete,
}: {
  accountSlug: string;
  timeZone: string;
  people: PersonOption[];
  meId: string;
  // Sin tarea, es una nueva.
  task?: EditableTask;
  // Las publicaciones con que arranca una nueva, por ejemplo la de la página.
  presetPublications?: PublicationOption[];
  size?: 'sm' | 'default';
  // Adónde ir después de borrarla. Sin esto, se queda en la pantalla.
  afterDelete?: string;
}) {
  const router = useRouter();
  const editing = Boolean(task);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [publications, setPublications] = useState<PublicationOption[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setRemindAt(toLocalInput(task?.remindAt ?? null, timeZone));
    setDueOn(task?.dueOn ? dueDay(task.dueOn) : '');
    // Una nueva arranca con quien la crea, si puede tenerla.
    // Las que ya no se pueden asignar salen al guardar.
    const active = (id: string) => people.some((p) => p.id === id);
    setAssignees(task ? task.people.map((p) => p.id).filter(active) : active(meId) ? [meId] : []);
    setPublications(task?.publications ?? presetPublications);
    setConfirmDelete(false);
    setError(null);
  }

  function start() {
    reset();
    setOpen(true);
  }

  function toggle(id: string) {
    setAssignees((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const input = { title, description, remindAt, dueOn, assigneeIds: assignees, publicationIds: publications.map((p) => p.id) };
      const r = task ? await updateTaskAction(accountSlug, task.id, input) : await createTaskAction(accountSlug, input);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (!task) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteTaskAction(accountSlug, task.id);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      if (afterDelete) router.push(afterDelete);
      else router.refresh();
    });
  }

  // Las personas que ya no se pueden asignar, para no perderlas al editar.
  const missing = task ? task.people.filter((p) => !people.some((x) => x.id === p.id)).map((p) => p.id) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      {editing ? (
        <Button size={size} variant="outline" access="tareas" onClick={start}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      ) : (
        <Button size={size} access="tareas" onClick={start}>
          <Plus className="h-4 w-4" />
          Nueva tarea
        </Button>
      )}
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar la tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            Sus personas la ven en Tareas y reciben un mail al asignársela, al llegar la fecha de aviso y si vence sin terminar.
          </DialogDescription>
        </DialogHeader>

        <form
          id="task-form"
          className="min-w-0 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Qué hay que hacer</Label>
            <Input id="task-title" value={title} maxLength={TASK_TITLE_MAX} disabled={pending} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Descripción</Label>
            <Textarea
              id="task-description"
              rows={4}
              value={description}
              maxLength={TASK_DESCRIPTION_MAX}
              disabled={pending}
              placeholder="Opcional: los detalles, links o lo que haga falta saber."
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none">Personas</legend>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {people.map((p) => {
                const on = assignees.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={pending}
                    onClick={() => toggle(p.id)}
                    title={p.email}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition-colors',
                      on ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p.name}
                    {p.id === meId ? ' (vos)' : ''}
                  </button>
                );
              })}
            </div>
            {missing.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {missing.length === 1
                  ? 'Una persona de la tarea ya no está activa o no ve la cuenta. Al guardar, sale de la tarea.'
                  : 'Algunas personas de la tarea ya no están activas o no ven la cuenta. Al guardar, salen de la tarea.'}
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-remind">Fecha de aviso</Label>
              <Input id="task-remind" type="datetime-local" value={remindAt} disabled={pending} onChange={(e) => setRemindAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Ese día y a esa hora les avisa en la app y por mail.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Fecha de finalización</Label>
              <Input id="task-due" type="date" value={dueOn} disabled={pending} onChange={(e) => setDueOn(e.target.value)} />
              <p className="text-xs text-muted-foreground">Si al terminar ese día sigue abierta, vence.</p>
            </div>
          </div>

          <PublicationPicker accountSlug={accountSlug} picked={publications} onChange={setPublications} disabled={pending} />
        </form>

        {error ? <StatusText status={{ kind: 'error', text: error }} /> : null}
        <DialogFooter className="gap-2 sm:justify-between">
          {task ? (
            confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>¿La borrás?</span>
                <Button type="button" variant="destructive" size="sm" access="tareas" onClick={remove} pending={pending} disabled={pending}>
                  Sí, borrar
                </Button>
                <Button type="button" variant="ghost" size="sm" access="view" onClick={() => setConfirmDelete(false)} disabled={pending}>
                  No
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" access="tareas" onClick={() => setConfirmDelete(true)} disabled={pending}>
                <Trash2 className="h-4 w-4" />
                Borrar
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" access="view" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form="task-form" access="tareas" pending={pending} disabled={pending || !title.trim() || assignees.length === 0}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
