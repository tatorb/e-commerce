'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveAnswerSettingsAction } from '@/app/a/[cuenta]/preguntas/answer-actions';
import { ANSWER_DELAY_MAX } from '@/domain/answers';

// Cómo responde la tienda: lo que Claude usa para proponer las respuestas.

export type AnswerSettingsValues = { greeting: string; signature: string; tone: string; notes: string; autoDraft: boolean; answerDelaySeconds: number };

export function AnswerSettingsForm({ accountSlug, initial }: { accountSlug: string; initial: AnswerSettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const changed = JSON.stringify(values) !== JSON.stringify(initial);
  const set = <K extends keyof AnswerSettingsValues>(key: K, value: AnswerSettingsValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function save() {
    const delay = values.answerDelaySeconds;
    if (!Number.isInteger(delay) || delay < 0 || delay > ANSWER_DELAY_MAX) {
      return setMessage({ kind: 'error', text: `La espera va en segundos enteros, de 0 a ${ANSWER_DELAY_MAX}.` });
    }
    setPending(true);
    setMessage(null);
    const r = await saveAnswerSettingsAction(accountSlug, values).catch(() => null);
    setPending(false);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app. Probá de nuevo.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: 'Guardado. Las próximas propuestas ya lo usan.' });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a-greeting">Saludo</Label>
          <Input id="a-greeting" value={values.greeting} onChange={(e) => set('greeting', e.target.value)} placeholder="Por ejemplo: ¡Hola! Gracias por tu consulta." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-signature">Firma</Label>
          <Input id="a-signature" value={values.signature} onChange={(e) => set('signature', e.target.value)} placeholder="Por ejemplo: Saludos, INSUR S.A." />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-tone">Tono</Label>
        <Input id="a-tone" value={values.tone} onChange={(e) => set('tone', e.target.value)} placeholder="Por ejemplo: cordial y breve, de vos, sin signos de exclamación de más." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-notes">Lo que Claude tiene que saber de la tienda</Label>
        <Textarea
          id="a-notes"
          rows={7}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder={'Una cosa por línea. Por ejemplo:\nLas medidas de los cojinetes se eligen debajo del precio y están en pulgadas: 010, 020, 030.\nEnvíos a todo el país por Mercado Envíos.\nHacemos factura A y B.'}
        />
        <p className="text-xs text-muted-foreground">
          Claude responde solo con esto, la ficha y la publicación. El precio y el stock los toma de Mercado Libre: acá no pongas precios, costos ni datos de contacto.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="a-delay">Espera mínima antes de responder solo, en segundos</Label>
        <Input
          id="a-delay"
          type="number"
          inputMode="numeric"
          min={0}
          max={ANSWER_DELAY_MAX}
          step={1}
          className="w-32"
          value={Number.isFinite(values.answerDelaySeconds) ? values.answerDelaySeconds : ''}
          onChange={(e) => set('answerDelaySeconds', e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          Desde que llega la pregunta, Claude espera al menos esto para mandar sola la respuesta, en las publicaciones con Responder solo. De 0 a {ANSWER_DELAY_MAX}.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={values.autoDraft} onChange={(e) => set('autoDraft', e.target.checked)} />
        <span>
          <span className="font-medium">Proponer las respuestas solas.</span>{' '}
          <span className="text-muted-foreground">Cuando llega una pregunta, Claude prepara la respuesta. Si lo apagás, se pide con un botón.</span>
        </span>
      </label>
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
