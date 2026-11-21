'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { OctagonPause, Percent, SlidersHorizontal, Timer, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import type { PromoRules, Recipe, Thresholds } from '@/domain/promo/rules';
import { LIFECYCLES, LIFECYCLE_LABEL, type Lifecycle } from '@/domain/promo/tags';
import { saveRulesAction, saveThresholdsAction, setPausedAction } from '@/app/a/[cuenta]/promociones/actions';

// Las reglas de Promociones: la rentabilidad saludable y el piso, la receta
// del almanaque de cada ciclo de vida, los números con los que la regla
// propone las etiquetas y los tiempos. Todo se cambia a mano.

const SELECT = 'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm';
const num = (s: string) => Number(s.replace(',', '.'));
const text = (n: number | null) => (n === null ? '' : String(n));

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function Field({ label, hint, value, onChange, suffix }: { label: string; hint?: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <Input className="w-24" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
      </span>
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function RulesForm({ accountSlug, thresholds, rules, paused }: { accountSlug: string; thresholds: Thresholds; rules: PromoRules; paused: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [healthy, setHealthy] = useState(String(thresholds.healthyMarginPct));
  const [floor, setFloor] = useState(String(thresholds.floorMarginPct));
  const [recipes, setRecipes] = useState(() =>
    Object.fromEntries(
      LIFECYCLES.map((l) => [l, { ...rules.recipes[l], baseMarginPct: text(rules.recipes[l].baseMarginPct), eventMarginPct: text(rules.recipes[l].eventMarginPct), peakMarginPct: text(rules.recipes[l].peakMarginPct), steps: rules.recipes[l].baseSteps.map((s) => `${s.daysBefore}:${s.marginPct}`).join(', ') }]),
    ) as unknown as Record<Lifecycle, Omit<Recipe, 'baseMarginPct' | 'eventMarginPct' | 'peakMarginPct' | 'baseSteps'> & { baseMarginPct: string; eventMarginPct: string; peakMarginPct: string; steps: string }>,
  );
  const [classify, setClassify] = useState(() => Object.fromEntries(Object.entries(rules.classify).map(([k, v]) => [k, String(v)])) as Record<keyof PromoRules['classify'], string>);
  // Si la regla propone "a liquidar": apagado, esa etiqueta se pone solo a mano.
  const [clearanceAuto, setClearanceAuto] = useState(rules.classify.clearanceAuto);
  const [timing, setTiming] = useState(() => Object.fromEntries(Object.entries(rules.timing).map(([k, v]) => [k, String(v)])) as Record<keyof PromoRules['timing'], string>);
  const setRecipe = (l: Lifecycle, patch: Partial<(typeof recipes)[Lifecycle]>) => setRecipes((r) => ({ ...r, [l]: { ...r[l], ...patch } }));

  const done = (r: { ok: true } | { ok: false; error: string } | null, ok: string) => {
    setNotice(!r ? { kind: 'error', text: 'Se cortó la conexión con la app.' } : r.ok ? { kind: 'ok', text: ok } : { kind: 'error', text: r.error });
    if (r?.ok) router.refresh();
  };
  const saveThresholds = () => start(async () => done(await saveThresholdsAction(accountSlug, { healthyMarginPct: num(healthy), floorMarginPct: num(floor) }).catch(() => null), 'Rentabilidad guardada. Vale desde el próximo armado del almanaque.'));
  const margin = (s: string) => (s.trim() === '' ? null : num(s));
  const saveRules = () =>
    start(async () => {
      const steps = (s: string) =>
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => {
            const [d, m] = x.split(':');
            return { daysBefore: Math.round(num(d ?? '')), marginPct: num(m ?? '') };
          });
      const patch = {
        recipes: Object.fromEntries(
          LIFECYCLES.map((l) => {
            const r = recipes[l];
            return [l, { base: r.base, baseMarginPct: margin(r.baseMarginPct), baseSteps: steps(r.steps), events: r.events, eventMarginPct: margin(r.eventMarginPct), peaks: r.peaks, peakMarginPct: margin(r.peakMarginPct), volume: r.volume }];
          }),
        ),
        classify: { ...Object.fromEntries(Object.entries(classify).filter(([k]) => k !== 'clearanceAuto').map(([k, v]) => [k, num(v)])), clearanceAuto },
        timing: Object.fromEntries(Object.entries(timing).map(([k, v]) => [k, num(v)])),
      };
      done(await saveRulesAction(accountSlug, patch as Parameters<typeof saveRulesAction>[1]).catch(() => null), 'Reglas guardadas. Valen desde el próximo armado del almanaque: lo que ya está prendido no se toca.');
    });

  return (
    <div className="space-y-4">
      {notice ? <p className={`rounded-lg border px-3 py-2 text-sm ${notice.kind === 'error' ? 'border-alert/40 bg-alert/10' : 'border-primary/30 bg-primary/5'}`}>{notice.text}</p> : null}

      <SectionCard
        title="Freno de emergencia"
        icon={<OctagonPause />}
        description="Pausa toda la ejecución de la cuenta: mientras está puesto, la app no prende ni apaga nada en el canal, en ningún producto. No borra nada ni saca nada de donde está. Al soltarlo, sigue desde donde estaba."
        action={
          <Button
            size="sm"
            variant={paused ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => {
              const text = paused
                ? 'Se suelta el freno: la app vuelve a prender y apagar sola lo que marca el almanaque de cada producto, con la lectura de cada hora. ¿Lo soltás?'
                : 'Se pone el freno: la app deja de prender y apagar en el canal, en todos los productos. Lo que ya está prendido sigue como está. ¿Lo ponés?';
              if (!window.confirm(text)) return;
              start(async () => done(await setPausedAction(accountSlug, !paused).catch(() => null), paused ? 'Freno suelto: la app vuelve a ejecutar los almanaques.' : 'Freno puesto: la app no manda nada al canal.'));
            }}
          >
            {paused ? 'Soltar el freno' : 'Poner el freno'}
          </Button>
        }
      >
        <p className="px-4 py-3 text-sm">{paused ? 'Está puesto. La app no manda nada al canal.' : 'Está suelto. La app ejecuta el almanaque de cada producto.'}</p>
      </SectionCard>

      <SectionCard
        title="Rentabilidad"
        icon={<Percent />}
        description="Sobre el costo, por forma de cobro, con el costo de sus cuotas. El descuento se mide por lo que deja, no por el % que muestra el canal."
        action={
          <Button size="sm" disabled={busy} pending={busy} onClick={saveThresholds}>
            Guardar
          </Button>
        }
      >
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Saludable" suffix="%" value={healthy} onChange={setHealthy} hint="Lo que busca una oferta cuando la receta no dice otra cosa: los eventos y los picos." />
          <Field label="Piso" suffix="%" value={floor} onChange={setFloor} hint="Ninguna oferta entra si deja menos. Si el tope del canal deja el piso o más, entra al tope; si no, queda afuera con el motivo." />
        </div>
      </SectionCard>

      <SectionCard
        title="Recetas del almanaque"
        icon={<WandSparkles />}
        description="Para los productos en Automático: qué capas lleva cada ciclo de vida y qué rentabilidad busca cada una. Una rentabilidad vacía es la saludable."
        action={
          <Button size="sm" disabled={busy} pending={busy} onClick={saveRules}>
            Guardar reglas
          </Button>
        }
      >
        <div className="divide-y">
          {LIFECYCLES.map((l) => {
            const r = recipes[l];
            return (
              <div key={l} className="grid gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p className="font-semibold sm:col-span-2 lg:col-span-4">{LIFECYCLE_LABEL[l]}</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={r.base} onChange={(e) => setRecipe(l, { base: e.target.checked })} />
                    <span className="font-medium">Base, con el descuento propio</span>
                  </label>
                  <Field label="Rentabilidad de la base" suffix="%" value={r.baseMarginPct} onChange={(v) => setRecipe(l, { baseMarginPct: v })} />
                </div>
                <label className="space-y-1">
                  <span className="block font-medium">Escalones hacia el evento</span>
                  <Input value={r.steps} placeholder="60:22, 30:18" onChange={(e) => setRecipe(l, { steps: e.target.value })} />
                  <span className="block text-xs text-muted-foreground">Días antes y rentabilidad, separados por coma. 60:22 es 22 % cuando faltan 60 días o menos.</span>
                </label>
                <div className="space-y-2">
                  <label className="space-y-1">
                    <span className="block font-medium">Eventos del canal</span>
                    <select className={`${SELECT} w-full`} value={r.events} onChange={(e) => setRecipe(l, { events: e.target.value as Recipe['events'] })}>
                      <option value="always">Siempre</option>
                      <option value="with_sales">Solo si ya tiene ventas</option>
                      <option value="never">Nunca</option>
                    </select>
                  </label>
                  <Field label="Rentabilidad en eventos" suffix="%" value={r.eventMarginPct} onChange={(v) => setRecipe(l, { eventMarginPct: v })} />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={r.peaks} onChange={(e) => setRecipe(l, { peaks: e.target.checked })} />
                    <span className="font-medium">Picos: relámpago y oferta del día</span>
                  </label>
                  <Field label="Rentabilidad en picos" suffix="%" value={r.peakMarginPct} onChange={(v) => setRecipe(l, { peakMarginPct: v })} />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={r.volume} onChange={(e) => setRecipe(l, { volume: e.target.checked })} />
                    <span className="font-medium">Descuento por cantidad</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Cómo propone las etiquetas la regla" icon={<SlidersHorizontal />} description="Los números del ciclo de vida y de la competencia. Lo puesto a mano no se pisa. Se guardan con el botón Guardar reglas.">
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nueva a posicionar" suffix="días" value={classify.newDays} onChange={(v) => setClassify((c) => ({ ...c, newDays: v }))} hint="Publicada hace menos de estos días." />
          <Field label="Madurada" suffix="unidades en 90 días" value={classify.matureUnits90} onChange={(v) => setClassify((c) => ({ ...c, matureUnits90: v }))} hint="Con estas ventas o más y ventas parejas." />
          <Field label="Ventas parejas" suffix="%" value={classify.matureGrowthPct} onChange={(v) => setClassify((c) => ({ ...c, matureGrowthPct: v }))} hint="Lo del último mes no pasa por más de este % al promedio mensual de los 90 días." />
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={clearanceAuto} onChange={(e) => setClearanceAuto(e.target.checked)} />
              <span>
                <span className="font-medium">La regla propone «A liquidar»</span>
                <span className="block text-xs text-muted-foreground">Apagado, esa etiqueta se pone solo a mano.</span>
              </span>
            </label>
            {clearanceAuto ? <Field label="A liquidar" suffix="días sin vender" value={classify.clearanceDays} onChange={(v) => setClassify((c) => ({ ...c, clearanceDays: v }))} hint="Sin ventas en ese plazo y con stock." /> : null}
          </div>
          <Field label="Pelea por precio" suffix="%" value={classify.priceFightPct} onChange={(v) => setClassify((c) => ({ ...c, priceFightPct: v }))} hint="El competidor más barato está a este % o menos por encima del sin cuotas." />
          <Field label="Relevar la competencia" suffix="días" value={classify.competitorDays} onChange={(v) => setClassify((c) => ({ ...c, competitorDays: v }))} hint="Cada cuánto hay que volver a mirar los precios de la competencia." />
        </div>
      </SectionCard>

      <SectionCard title="Tiempos" icon={<Timer />} description="Se guardan con el botón Guardar reglas.">
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Hasta dónde se arma el almanaque" suffix="días" value={timing.horizonDays} onChange={(v) => setTiming((t) => ({ ...t, horizonDays: v }))} />
          <Field label="Cada tramo de la base" suffix="días" value={timing.baseDays} onChange={(v) => setTiming((t) => ({ ...t, baseDays: v }))} hint="De 7 a 14: la base no se mueve antes. El canal no deja un descuento propio de más de 14 días." />
          <Field label="Empujar baja en los picos" suffix="puntos" value={timing.pushStepPct} onChange={(v) => setTiming((t) => ({ ...t, pushStepPct: v }))} hint="Con la prioridad Empujar, cuánto menos de rentabilidad busca en las ofertas relámpago y del día, sin pasar el piso." />
          <Field label="La base deja más que el evento" suffix="puntos" value={timing.baseOverEventPct} onChange={(v) => setTiming((t) => ({ ...t, baseOverEventPct: v }))} hint="Así el descuento de la base queda por debajo del descuento del evento." />
          <Field label="Control de stock" suffix="unidades" value={timing.stockMin} onChange={(v) => setTiming((t) => ({ ...t, stockMin: v }))} hint="Con estas unidades o menos, la medida no entra a ofertas nuevas." />
          <Field label="Entrar a una campaña" suffix="días antes" value={timing.joinLeadDays} onChange={(v) => setTiming((t) => ({ ...t, joinLeadDays: v }))} hint="O antes, si la invitación vence primero." />
          <Field label="Medir el resultado" suffix="días" value={timing.measureDays} onChange={(v) => setTiming((t) => ({ ...t, measureDays: v }))} hint="Se compara ese plazo de antes con el de después." />
          <Field label="Reclasificar" suffix="días" value={timing.reclassifyDays} onChange={(v) => setTiming((t) => ({ ...t, reclassifyDays: v }))} hint="Cada cuánto la regla vuelve a proponer etiquetas y se rearma el almanaque." />
        </div>
      </SectionCard>
    </div>
  );
}
