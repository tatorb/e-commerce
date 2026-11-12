'use client';

import { useState, useTransition } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { saveStockTaskRecipientsAction } from '@/app/a/[cuenta]/alarmas-stock/actions';

// A quién le llegan las tareas automáticas de stock de la cuenta: las de
// reponer y las de reactivar. Sin elegir, a todos los administradores.

type Candidate = { id: string; name: string; email: string; isAdmin: boolean; chosen: boolean };

export function StockTaskRecipients({
  accountSlug,
  candidates,
  everyAdmin,
  canEdit,
}: {
  accountSlug: string;
  candidates: Candidate[];
  everyAdmin: boolean;
  canEdit: boolean;
}) {
  const initial = candidates.filter((c) => c.chosen).map((c) => c.id);
  const [chosen, setChosen] = useState<string[]>(initial);
  const [saved, setSaved] = useState<string[]>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [defaulted, setDefaulted] = useState(everyAdmin);
  const [pending, start] = useTransition();
  const dirty = chosen.length !== saved.length || chosen.some((id) => !saved.includes(id));
  const names = candidates.filter((c) => saved.includes(c.id)).map((c) => c.name);

  const toggle = (id: string, on: boolean) => {
    setMessage(null);
    setChosen((list) => (on ? [...list, id] : list.filter((x) => x !== id)));
  };

  const save = () =>
    start(async () => {
      const r = await saveStockTaskRecipientsAction(accountSlug, chosen);
      if (!r.ok) {
        setMessage({ ok: false, text: r.error });
        return;
      }
      setSaved(chosen);
      setDefaulted(false);
      const changed = r.added + r.removed > 0 ? ' Las tareas de stock abiertas ya quedaron con estas personas.' : '';
      setMessage({ ok: true, text: `Guardado.${changed}` });
    });

  return (
    <SectionCard
      title="A quién le llegan las tareas"
      icon={<Users />}
      description="Las tareas de reponer stock y de reactivar una publicación que recibió stock, con su mail."
      collapsible
    >
      <SectionBody className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {defaulted ? 'Sin elegir, les llegan a todos los administradores: ' : 'Les llegan a: '}
          {names.length > 0 ? names.join(', ') : 'nadie elegido'}.
        </p>
        {canEdit ? (
          <>
            <ul className="grid gap-2 sm:grid-cols-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={chosen.includes(c.id)}
                      onChange={(e) => toggle(c.id, e.target.checked)}
                      disabled={pending}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{c.name}</span>
                      {c.isAdmin ? <span className="text-muted-foreground"> · administrador</span> : null}
                      <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" onClick={save} disabled={pending || !dirty || chosen.length === 0}>
                {pending ? 'Guardando…' : 'Guardar'}
              </Button>
              {chosen.length === 0 ? <span className="text-xs text-destructive">Elegí al menos una persona.</span> : null}
              {message ? <span className={message.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{message.text}</span> : null}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Para cambiarlo hace falta el permiso de editar Tareas.</p>
        )}
      </SectionBody>
    </SectionCard>
  );
}
