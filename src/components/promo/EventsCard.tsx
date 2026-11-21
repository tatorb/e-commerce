'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import { EVENT_TIERS, EVENT_TIER_LABEL, type EventTier } from '@/domain/promo/plan';
import { deleteEventAction, saveEventAction } from '@/app/a/[cuenta]/promociones/actions';

// El calendario de eventos: los del canal y las fechas propias del rubro,
// cargados con anticipación. El almanaque escalona la base hacia el próximo.

export type EventRow = { id: string; name: string; tier: EventTier; start: string; finish: string; match: string | null; notes: string | null; past: boolean };

const SELECT = 'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm';
const EMPTY = { id: undefined as string | undefined, name: '', tier: 'T1' as EventTier, start: '', finish: '', match: '', notes: '' };

export function EventsCard({ accountSlug, events }: { accountSlug: string; events: EventRow[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));
  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveEventAction(accountSlug, form).catch(() => null);
      if (!r || !r.ok) return setError(r ? r.error : 'Se cortó la conexión con la app.');
      setForm(EMPTY);
      router.refresh();
    });
  const remove = (e: EventRow) => {
    if (!window.confirm(`Se borra «${e.name}» del calendario. Las franjas que ya están en el almanaque no cambian hasta rearmarlo.`)) return;
    start(async () => {
      const r = await deleteEventAction(accountSlug, e.id).catch(() => null);
      if (!r || !r.ok) return setError(r ? r.error : 'Se cortó la conexión con la app.');
      router.refresh();
    });
  };
  return (
    <SectionCard
      title="Calendario de eventos"
      icon={<CalendarPlus />}
      count={events.length}
      description="Los eventos del canal y las fechas propias del rubro. El almanaque reconoce la campaña del canal de cada evento por un texto de su nombre o por las fechas, y hace más fuerte la base al acercarse. Las fechas propias valen para los productos con prioridad Estacional."
    >
      <ul className="divide-y text-sm">
        {events.length === 0 ? <li className="px-4 py-4 text-muted-foreground">Todavía no hay eventos cargados.</li> : null}
        {events.map((e) => (
          <li key={e.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${e.past ? 'opacity-60' : ''}`}>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{e.name}</span>
              <span className="text-muted-foreground">
                {' '}
                · {EVENT_TIER_LABEL[e.tier]} · del {e.start} al {e.finish}
                {e.match ? ` · reconoce «${e.match}»` : ''}
                {e.past ? ' · ya pasó' : ''}
              </span>
              {e.notes ? <span className="block text-xs text-muted-foreground">{e.notes}</span> : null}
            </span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setForm({ id: e.id, name: e.name, tier: e.tier, start: e.start, finish: e.finish, match: e.match ?? '', notes: e.notes ?? '' })}>
              Cambiar
            </Button>
            <Button size="icon" variant="ghost" aria-label={`Borrar ${e.name}`} disabled={busy} onClick={() => remove(e)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 border-t p-4 text-sm sm:grid-cols-2 lg:grid-cols-6">
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs text-muted-foreground">Nombre</span>
          <Input value={form.name} placeholder="Hot Sale" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs text-muted-foreground">Tipo</span>
          <select className={`${SELECT} w-full`} value={form.tier} onChange={(e) => set({ tier: e.target.value as EventTier })}>
            {EVENT_TIERS.map((t) => (
              <option key={t} value={t}>
                {EVENT_TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Primer día</span>
          <Input type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Último día</span>
          <Input type="date" value={form.finish} onChange={(e) => set({ finish: e.target.value })} />
        </label>
        <label className="space-y-1 lg:col-span-2">
          <span className="block text-xs text-muted-foreground">Texto del nombre de la campaña en el canal (opcional)</span>
          <Input value={form.match} placeholder="hot sale" onChange={(e) => set({ match: e.target.value })} />
        </label>
        <label className="space-y-1 lg:col-span-3">
          <span className="block text-xs text-muted-foreground">Notas (opcional)</span>
          <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="flex items-end gap-2">
          <Button size="sm" disabled={busy || !form.name.trim() || !form.start || !form.finish} pending={busy} onClick={save}>
            {form.id ? 'Guardar cambios' : 'Agregar'}
          </Button>
          {form.id ? (
            <Button size="sm" variant="ghost" access="view" onClick={() => setForm(EMPTY)}>
              Cancelar
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive sm:col-span-2 lg:col-span-6">{error}</p> : null}
      </div>
    </SectionCard>
  );
}
