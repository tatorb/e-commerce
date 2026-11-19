'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { formatPrice } from '@/domain/money';
import type { RecreatePlan } from '@/lib/recreate';
import { applyRecreateAction, planRecreateAction } from '@/app/a/[cuenta]/pipeline/recreate-actions';

// Paso Publicación: recrear el producto en otra categoría cuando el canal ya no
// acepta opciones nuevas en el producto viejo. Primero se ve el plan; después se aplica.

export function RecreateCard({ accountSlug, publicationId, channelName, defaultCategory }: { accountSlug: string; publicationId: string; channelName: string; defaultCategory: string | null }) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory ?? '');
  const [allPlans, setAllPlans] = useState(true);
  const [plan, setPlan] = useState<RecreatePlan | null>(null);
  const [busy, setBusy] = useState<'plan' | 'apply' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function look() {
    setBusy('plan');
    setMessage(null);
    const r = await planRecreateAction(accountSlug, publicationId, category.trim(), allPlans).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setPlan(r.plan);
  }

  async function apply() {
    if (!plan || !window.confirm(`Se crea el producto en ${plan.category.name} y al final se finalizan ${plan.old.length} publicaciones viejas en ${channelName}. No tiene vuelta atrás. ¿Seguir?`)) return;
    setBusy('apply');
    setMessage(null);
    const r = await applyRecreateAction(accountSlug, publicationId, plan.category.id, allPlans).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Revisá en el canal qué se creó antes de volver a probar.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    const res = r.result;
    setMessage({
      kind: 'ok',
      text: [
        `Se creó ${res.created.map((c) => `${c.externalId} (${c.label.toLowerCase()})`).join(', ')}.`,
        res.closed.length > 0 ? `Se finalizaron ${res.closed.join(', ')}.` : '',
        res.pending.length > 0 ? `Quedan por finalizar ${res.pending.map((p) => p.externalId).join(', ')}: la app lo reintenta cada hora.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
    setPlan(null);
    router.refresh();
  }

  return (
    <SectionCard
      title="Recrear el producto en otra categoría"
      icon={<RefreshCcw />}
      description={`Para cuando ${channelName} le cambió la categoría a una opción y el producto ya no acepta opciones nuevas: se crea como otro producto en la categoría que va, con sus formas de cobro, y recién al final se finalizan las viejas.`}
    >
      <SectionBody className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Código de la categoría" value={category} onChange={(e) => (setCategory(e.target.value), setPlan(null))} placeholder="MLA458790" className="h-8 w-40 font-mono" />
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={allPlans} onChange={(e) => (setAllPlans(e.target.checked), setPlan(null))} />
            Con todas las formas de cobro de hoy
          </label>
          <Button size="sm" variant="outline" pending={busy === 'plan'} disabled={busy !== null || !category.trim()} onClick={look}>
            Ver el plan
          </Button>
        </div>
        {plan ? (
          <div className="space-y-2 rounded-md border p-3">
            <p>
              Categoría destino: <strong>{plan.category.name}</strong> ({plan.category.id}).
            </p>
            <p className="font-medium">Las vivas de hoy</p>
            <ul className="list-disc pl-5">
              {plan.old.map((o) => (
                <li key={o.id}>
                  {o.externalId}, {o.planLabel.toLowerCase()}, {o.price !== null ? formatPrice(o.price) : 'sin precio'}, {o.statusLabel.toLowerCase()}, {o.visits ?? 0} visitas y {o.sales ?? 0} ventas.{' '}
                  {o.closeBlocked ? <span className="text-amber-700 dark:text-amber-400">{o.closeBlocked}</span> : 'Se finaliza al final.'}
                </li>
              ))}
            </ul>
            <p className="font-medium">Se crea</p>
            <ul className="list-disc pl-5">
              {plan.toCreate.map((t) => (
                <li key={t.plan}>
                  {t.label}: {t.price !== null ? formatPrice(t.price) : 'sin precio'}
                  {t.main ? ', la principal nueva' : ''}.
                </li>
              ))}
            </ul>
            {plan.notes.map((n) => (
              <p key={n} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
            {plan.missing.length > 0 ? (
              <p className="text-destructive">Antes falta: {plan.missing.join(' ')}</p>
            ) : (
              <Button access="subir" size="sm" pending={busy === 'apply'} disabled={busy !== null} onClick={apply}>
                Recrear en {plan.category.name}
              </Button>
            )}
          </div>
        ) : null}
        {message ? <p className={message.kind === 'error' ? 'text-destructive' : ''}>{message.text}</p> : null}
      </SectionBody>
    </SectionCard>
  );
}
