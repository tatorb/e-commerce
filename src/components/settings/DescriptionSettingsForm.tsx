'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveDescriptionSettingsAction } from '@/app/a/[cuenta]/pipeline/description-actions';

// El encabezado y el pie fijos de las descripciones de la cuenta, y lo que
// Claude tiene que saber para escribirlas.

export type DescriptionSettingsValues = { header: string; footer: string; guidelines: string };

export function DescriptionSettingsForm({ accountSlug, initial }: { accountSlug: string; initial: DescriptionSettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const changed = JSON.stringify(values) !== JSON.stringify(initial);
  const set = (key: keyof DescriptionSettingsValues, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    setPending(true);
    setMessage(null);
    const r = await saveDescriptionSettingsAction(accountSlug, values).catch(() => null);
    setPending(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: 'Guardado. Las descripciones que se guarden desde ahora ya lo usan.' });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="d-header">Encabezado</Label>
        <Textarea
          id="d-header"
          rows={4}
          value={values.header}
          onChange={(e) => set('header', e.target.value)}
          placeholder="Por ejemplo: INSUR, repuestos para el motor desde 1985."
        />
        <p className="text-xs text-muted-foreground">Va arriba de todas las descripciones. Vacío, no lleva.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-footer">Pie</Label>
        <Textarea
          id="d-footer"
          rows={5}
          value={values.footer}
          onChange={(e) => set('footer', e.target.value)}
          placeholder={'Por ejemplo:\nHacemos factura A y B.\nAnte cualquier duda sobre la compatibilidad, preguntanos antes de comprar.'}
        />
        <p className="text-xs text-muted-foreground">Va abajo de todas las descripciones. Sin links, mails, teléfonos ni redes: el canal no los acepta.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-guidelines">Lo que Claude tiene que saber para escribirlas</Label>
        <Textarea
          id="d-guidelines"
          rows={6}
          value={values.guidelines}
          onChange={(e) => set('guidelines', e.target.value)}
          placeholder={'Una cosa por línea. Por ejemplo:\nLas medidas de los cojinetes están en pulgadas: 010, 020, 030.\nNombrar siempre la marca del repuesto en la primera línea.'}
        />
        <p className="text-xs text-muted-foreground">No pongas precios, costos ni datos de contacto.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} pending={pending} disabled={pending || !changed}>
          Guardar
        </Button>
        {message ? (
          <p className={`text-sm ${message.kind === 'error' ? 'text-destructive' : 'text-foreground'}`} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
