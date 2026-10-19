'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/pipeline/StatusText';
import {
  capMax,
  DEFAULT_PHOTO_SETTINGS,
  JPG_QUALITY_RANGE,
  MARGIN_RANGE,
  PHOTO_CAPS,
  type PhotoCapKey,
  type PhotoSettingsValues,
} from '@/domain/photo-settings';
import { resetPhotoSettingsAction, savePhotoSettingsAction } from '@/app/a/[cuenta]/imagenes/actions';

// Los ajustes de la línea de imágenes de una cuenta: el estándar del recorte y
// la exportación, y lo máximo que se puede corregir en cada ajuste.

type Values = { margen: string; fondo: string; calidad_jpg: string; topes: Record<PhotoCapKey, string> };

const toValues = (s: PhotoSettingsValues): Values => ({
  margen: String(s.margen),
  fondo: s.fondo,
  calidad_jpg: String(s.calidad_jpg),
  topes: Object.fromEntries(PHOTO_CAPS.map((c) => [c.key, String(s.topes[c.key])])) as Record<PhotoCapKey, string>,
});

export function PhotoSettingsForm({ accountSlug, settings, custom }: { accountSlug: string; settings: PhotoSettingsValues; custom: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => toValues(settings));
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function set(patch: Partial<Values>) {
    setValues((v) => ({ ...v, ...patch }));
    setStatus(null);
  }

  function save() {
    startTransition(async () => {
      const r = await savePhotoSettingsAction(accountSlug, values);
      setStatus(r.ok ? { kind: 'ok', text: 'Ajustes guardados.' } : { kind: 'error', text: r.error });
      if (r.ok) router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      const r = await resetPhotoSettingsAction(accountSlug);
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error });
        return;
      }
      setValues(toValues(DEFAULT_PHOTO_SETTINGS));
      setStatus({ kind: 'ok', text: 'Volvieron los ajustes de siempre.' });
      router.refresh();
    });
  }

  const colorOk = /^#[0-9a-fA-F]{6}$/.test(values.fondo);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="space-y-3">
        <p className="text-sm font-medium">Estándar de la foto final</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="margen">Margen del recorte</Label>
            <div className="flex items-center gap-2">
              <Input
                id="margen"
                inputMode="decimal"
                className="w-24"
                value={values.margen}
                onChange={(e) => set({ margen: e.target.value })}
                disabled={pending}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Espacio alrededor de la pieza, de cada lado. De {MARGIN_RANGE.min} a {MARGIN_RANGE.max}.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fondo">Color de fondo del JPG</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Elegir el color de fondo"
                className="h-9 w-10 cursor-pointer rounded border bg-background p-0.5"
                value={colorOk ? values.fondo.toLowerCase() : '#ffffff'}
                onChange={(e) => set({ fondo: e.target.value.toUpperCase() })}
                disabled={pending}
              />
              <Input id="fondo" className="w-28" value={values.fondo} onChange={(e) => set({ fondo: e.target.value })} disabled={pending} />
            </div>
            <p className="text-xs text-muted-foreground">Blanco puro es #FFFFFF, el que pide Mercado Libre.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calidad">Calidad del JPG</Label>
            <Input
              id="calidad"
              inputMode="numeric"
              className="w-24"
              value={values.calidad_jpg}
              onChange={(e) => set({ calidad_jpg: e.target.value })}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              De {JPG_QUALITY_RANGE.min} a {JPG_QUALITY_RANGE.max}. Con 95 no se notan diferencias y pesa menos que 100.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Topes de cada ajuste</p>
          <p className="text-xs text-muted-foreground">
            Lo máximo que se puede corregir en cada paso. Ni Claude ni una persona pueden pasarlos: si se pide más, se usa el tope y se avisa.
          </p>
        </div>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {PHOTO_CAPS.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_6rem] items-start gap-2">
              <div>
                <Label htmlFor={`tope-${c.key}`}>{c.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {c.help} De 0 a {capMax(c.key)}
                  {c.unit}.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  id={`tope-${c.key}`}
                  inputMode="decimal"
                  value={values.topes[c.key]}
                  onChange={(e) => set({ topes: { ...values.topes, [c.key]: e.target.value } })}
                  disabled={pending}
                />
                {c.unit.trim() ? <span className="text-xs text-muted-foreground">{c.unit.trim()}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar ajustes'}
        </Button>
        {custom ? (
          <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
            Volver a los de siempre
          </Button>
        ) : null}
        <StatusText status={status} />
      </div>
    </form>
  );
}
