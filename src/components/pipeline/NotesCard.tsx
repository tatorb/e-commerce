'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Textarea } from '@/components/ui/textarea';
import { TaskDialog, type PersonOption, type PublicationOption } from '@/components/tasks/TaskDialog';
import { insertMention, mentionAt, mentionedIds, mentionMatches, type MentionPerson } from '@/domain/note-mentions';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils/cn';
import { addNoteAction, deleteNoteAction, editNoteAction } from '@/app/a/[cuenta]/pipeline/note-actions';

// Las notas del equipo sobre la publicación: qué pasó, qué falta, por qué se
// frenó. Son de la familia, las ve todo el equipo y Claude, y cualquiera las
// edita. Con @ se menciona a alguien y le llega un mail.

export type NoteItem = {
  id: string;
  text: string;
  stepLabel: string | null;
  author: string;
  createdAt: Date;
  editedBy: string | null;
  editedAt: Date | null;
  writtenOn: { externalId: string | null; title: string } | null;
};

const NOTE_MAX = 4000;

/** Un campo de texto con @menciones: al escribir @ aparece la lista de personas. */
export function NoteEditor({
  value,
  onChange,
  people,
  picked,
  onPick,
  disabled,
  placeholder,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  people: MentionPerson[];
  picked: string[];
  onPick: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [at, setAt] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const matches = at ? mentionMatches(people, at.query) : [];

  const track = (el: HTMLTextAreaElement) => {
    setAt(mentionAt(el.value, el.selectionStart ?? el.value.length));
    setActive(0);
  };

  const choose = (p: MentionPerson) => {
    if (!at) return;
    const next = insertMention(value, at, p.name);
    onChange(next.text);
    onPick([...new Set([...picked, p.id])]);
    setAt(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div className="relative">
      <Textarea
        id={id}
        ref={ref}
        value={value}
        maxLength={NOTE_MAX}
        rows={3}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          track(e.target);
        }}
        onClick={(e) => track(e.currentTarget)}
        onKeyDown={(e) => {
          if (!at || matches.length === 0) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === 'Escape') {
            setAt(null);
          }
        }}
        onBlur={() => setTimeout(() => setAt(null), 150)}
      />
      {at && matches.length > 0 ? (
        <ul role="listbox" aria-label="Mencionar a" className="absolute left-2 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-popover text-sm shadow-lg">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                className={cn('block w-full px-3 py-2 text-left hover:bg-muted', i === active && 'bg-muted')}
              >
                @{p.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** El texto de la nota, con las @menciones resaltadas. */
function NoteText({ text, people }: { text: string; people: MentionPerson[] }) {
  const names = [...new Set(people.map((p) => p.name))].sort((a, b) => b.length - a.length);
  if (names.length === 0) return <p className="whitespace-pre-wrap break-words text-sm">{text}</p>;
  const pattern = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g');
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function NoteRow({
  note,
  accountSlug,
  publicationId,
  people,
  timeZone,
  task,
}: {
  note: NoteItem;
  accountSlug: string;
  publicationId: string;
  people: PersonOption[];
  timeZone: string;
  task: { meId: string; canCreate: boolean; publication: PublicationOption };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const r = await editNoteAction(accountSlug, publicationId, note.id, text, mentionedIds(text, people, picked)).catch(() => null);
      if (!r) return setError('Se cortó la conexión con la app.');
      if (!r.ok) return setError(r.error);
      setEditing(false);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      setError(null);
      const r = await deleteNoteAction(accountSlug, publicationId, note.id).catch(() => null);
      if (!r) return setError('Se cortó la conexión con la app.');
      if (!r.ok) return setError(r.error);
      router.refresh();
    });

  const firstLine = note.text.split('\n')[0].trim();
  return (
    <li className="space-y-1.5 px-4 py-3 md:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{note.author}</span>
        <span>{formatDateTime(new Date(note.createdAt), timeZone)}</span>
        {note.stepLabel ? <span>· en {note.stepLabel}</span> : null}
        {note.writtenOn ? <span>· desde {note.writtenOn.externalId ?? note.writtenOn.title}</span> : null}
        {note.editedBy && note.editedAt ? (
          <span>
            · editada por {note.editedBy} el {formatDateTime(new Date(note.editedAt), timeZone)}
          </span>
        ) : null}
      </p>
      {editing ? (
        <div className="space-y-2">
          <NoteEditor value={text} onChange={setText} people={people} picked={picked} onPick={setPicked} disabled={pending} autoFocus />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" access="view" onClick={save} pending={pending} disabled={pending || !text.trim()}>
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              access="view"
              onClick={() => {
                setEditing(false);
                setText(note.text);
              }}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <NoteText text={note.text} people={people} />
      )}
      {!editing ? (
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" access="view" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          {confirm ? (
            <>
              <span className="px-1 text-xs text-muted-foreground">¿Borrarla?</span>
              <Button size="sm" variant="destructive" access="view" onClick={remove} pending={pending} disabled={pending}>
                Sí, borrar
              </Button>
              <Button size="sm" variant="ghost" access="view" onClick={() => setConfirm(false)} disabled={pending}>
                No
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" access="view" onClick={() => setConfirm(true)} disabled={pending}>
              <Trash2 className="h-3.5 w-3.5" />
              Borrar
            </Button>
          )}
          {task.canCreate ? (
            <TaskDialog
              accountSlug={accountSlug}
              timeZone={timeZone}
              people={people}
              meId={task.meId}
              presetPublications={[task.publication]}
              preset={{ title: firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine, description: `Nota de ${note.author}:\n${note.text}` }}
              trigger={{ label: 'Crear tarea' }}
            />
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  );
}

export function NotesCard({
  accountSlug,
  publicationId,
  notes,
  people,
  timeZone,
  task,
  family,
}: {
  accountSlug: string;
  // La principal: ahí quedan las que se escriben desde la pantalla.
  publicationId: string;
  notes: NoteItem[];
  people: PersonOption[];
  timeZone: string;
  task: { meId: string; canCreate: boolean; publication: PublicationOption };
  // Si es una familia: las notas se ven desde todas sus medidas.
  family: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      setError(null);
      const r = await addNoteAction(accountSlug, publicationId, text, mentionedIds(text, people, picked)).catch(() => null);
      if (!r) return setError('Se cortó la conexión con la app.');
      if (!r.ok) return setError(r.error);
      setText('');
      setPicked([]);
      router.refresh();
    });

  return (
    <SectionCard
      id="notas"
      title="Notas"
      icon={<MessageSquareText />}
      count={notes.length}
      description={`Qué pasó, qué falta o por qué se frenó, para el que sigue. ${family ? 'Son de la familia: se ven desde todas sus medidas. ' : ''}Las ve todo el equipo y Claude. Con @ avisás a alguien por mail.`}
    >
      <SectionBody className="space-y-2">
        <NoteEditor id="nota-nueva" value={text} onChange={setText} people={people} picked={picked} onPick={setPicked} disabled={pending} placeholder="Escribí una nota. Con @ mencionás a alguien." />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" access="view" onClick={add} pending={pending} disabled={pending || !text.trim()}>
            Guardar nota
          </Button>
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      </SectionBody>
      {notes.length > 0 ? (
        <ul className="divide-y border-t">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} accountSlug={accountSlug} publicationId={publicationId} people={people} timeZone={timeZone} task={task} />
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}
