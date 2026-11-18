'use client';

import { useState } from 'react';
import { Scissors, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOMENT_LEVEL_LABEL, planSeconds, SPEED_MAX, SPEED_MIN, type MomentLevel, type VideoPlan } from '@/domain/video-edit';

// Los cortes de un clip, para corregirlos a mano y pedirlo de nuevo: de dónde
// a dónde va cada tramo del original y a qué velocidad.

type Row = { inicio: string; fin: string; velocidad: string; nombre: string; importancia: MomentLevel | null };

const num = (n: number) => String(Math.round(n * 100) / 100);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** En qué segundo del clip empieza cada tramo. */
function startsOf(plan: VideoPlan): number[] {
  const out: number[] = [];
  let t = 0;
  for (const tramo of plan.tramos) {
    out.push(t);
    t += (tramo.fin - tramo.inicio) / tramo.velocidad;
  }
  return out;
}

export function VideoPlanEditor({
  plan,
  range,
  pending,
  onSubmit,
}: {
  plan: VideoPlan;
  range: { min: number; max: number };
  pending: boolean;
  onSubmit: (ask: { plan: VideoPlan }) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    plan.tramos.map((t) => ({ inicio: num(t.inicio), fin: num(t.fin), velocidad: num(t.velocidad), nombre: t.nombre, importancia: t.importancia ?? null })),
  );
  const [cierre, setCierre] = useState(num(plan.cierre));

  const set = (i: number, patch: Partial<Row>) =>
    setRows((old) =>
      old.map((r, j) => {
        if (j === i) return { ...r, ...patch };
        // Los tramos van pegados: donde termina uno empieza el siguiente.
        if (j === i + 1 && patch.fin !== undefined) return { ...r, inicio: patch.fin };
        return r;
      }),
    );
  const split = (i: number) =>
    setRows((old) => {
      const r = old[i];
      const mid = num((Number(r.inicio) + Number(r.fin)) / 2);
      return [...old.slice(0, i), { ...r, fin: mid }, { ...r, inicio: mid }, ...old.slice(i + 1)];
    });
  const remove = (i: number) =>
    setRows((old) => {
      if (old.length <= 1) return old;
      const next = old.filter((_, j) => j !== i);
      // El tramo de al lado se queda con su parte del video.
      if (i > 0) next[i - 1] = { ...next[i - 1], fin: old[i].fin };
      else next[0] = { ...next[0], inicio: old[0].inicio };
      return next;
    });

  const built: VideoPlan = {
    imagen: plan.imagen,
    tramos: rows.map((r) => ({ inicio: Number(r.inicio), fin: Number(r.fin), velocidad: Number(r.velocidad), nombre: r.nombre.trim(), importancia: r.importancia })),
    cierre: Number(cierre),
  };
  const problems: string[] = [];
  rows.forEach((r, i) => {
    const a = Number(r.inicio);
    const b = Number(r.fin);
    const v = Number(r.velocidad);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b - a < 0.2) problems.push(`El tramo ${i + 1} tiene que terminar después de donde empieza.`);
    if (!Number.isFinite(v) || v < SPEED_MIN || v > SPEED_MAX) problems.push(`La velocidad del tramo ${i + 1} tiene que ir de ${String(SPEED_MIN).replace('.', ',')} a ${SPEED_MAX}.`);
  });
  if (!Number.isFinite(built.cierre) || built.cierre < 0 || built.cierre > 6) problems.push('La imagen quieta del final va de 0 a 6 segundos.');
  const seconds = problems.length === 0 ? planSeconds(built) : null;
  if (seconds !== null && (seconds < range.min || seconds > range.max)) {
    problems.push(`Así el clip dura ${Math.round(seconds)} segundos y tiene que durar de ${range.min} a ${range.max}.`);
  }
  const starts = problems.length === 0 ? startsOf(built) : [];
  const input = 'h-8 rounded-md border bg-background px-2 text-sm';

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cada tramo es un pedazo del video original, en segundos del original. Con velocidad 1 va normal, con 4 va cuatro veces más rápido. La voz dice el guión
        del clip, que se corrige arriba, en Guión del clip: si lo cambiaste, sale con el cambio.
      </p>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="space-y-2 rounded-md border bg-background p-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-40 flex-1 space-y-0.5 text-xs">
                <span className="text-muted-foreground">
                  Tramo {i + 1}
                  {r.importancia ? ` · ${MOMENT_LEVEL_LABEL[r.importancia]}` : ''}
                  {starts[i] !== undefined ? ` · en el clip desde ${clock(starts[i])}` : ''}
                </span>
                <input className={`${input} w-full`} value={r.nombre} maxLength={120} onChange={(e) => set(i, { nombre: e.target.value })} />
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-muted-foreground">Desde</span>
                <input className={`${input} w-20`} type="number" step="0.5" min={0} value={r.inicio} disabled={i > 0} onChange={(e) => set(i, { inicio: e.target.value })} />
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-muted-foreground">Hasta</span>
                <input className={`${input} w-20`} type="number" step="0.5" min={0} value={r.fin} onChange={(e) => set(i, { fin: e.target.value })} />
              </label>
              <label className="space-y-0.5 text-xs">
                <span className="text-muted-foreground">Velocidad</span>
                <input className={`${input} w-20`} type="number" step="0.1" min={SPEED_MIN} max={SPEED_MAX} value={r.velocidad} onChange={(e) => set(i, { velocidad: e.target.value })} />
              </label>
              <Button type="button" size="sm" variant="ghost" title="Partir en dos" onClick={() => split(i)} disabled={pending}>
                <Scissors />
              </Button>
              <Button type="button" size="sm" variant="ghost" title="Sacar: su parte pasa al tramo de al lado" onClick={() => remove(i)} disabled={pending || rows.length <= 1}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <label className="flex items-center gap-2 text-sm">
        Imagen quieta al final, en segundos
        <input className={`${input} w-20`} type="number" step="0.5" min={0} max={6} value={cierre} onChange={(e) => setCierre(e.target.value)} />
      </label>
      {problems.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-destructive">
          {problems.slice(0, 4).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Así el clip dura {Math.round(seconds ?? 0)} segundos.</p>
      )}
      <div className="flex justify-end">
        <Button size="sm" pending={pending} disabled={pending || problems.length > 0} onClick={() => onSubmit({ plan: built })}>
          Rehacer con estos cortes
        </Button>
      </div>
    </div>
  );
}
