'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/section-card';
import { Textarea } from '@/components/ui/textarea';
import { StatusText } from '@/components/pipeline/StatusText';
import type { AccountVideoSettings } from '@/domain/video-edit';
import { saveAccountVideoAction } from '@/app/a/[cuenta]/protocolos/actions';

// Cómo se editan los videos de la cuenta: cuánto dura el clip, la voz en off,
// la música, los subtítulos y lo que se hace solo.

function Check({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  );
}

export function AccountVideoCard({ accountSlug, settings, steps }: { accountSlug: string; settings: AccountVideoSettings; steps: { id: string; label: string; moments: number }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(settings);
  const [seconds, setSeconds] = useState(String(settings.targetSeconds));
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const set = (patch: Partial<AccountVideoSettings>) => setV((old) => ({ ...old, ...patch }));
  const target = Number(seconds);
  const valid = Number.isInteger(target) && target >= 10 && target <= 60;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const r = await saveAccountVideoAction(accountSlug, { ...v, targetSeconds: target }).catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      setStatus(r.ok ? { kind: 'ok', text: 'Guardado.' } : { kind: 'error', text: r.error });
      router.refresh();
    });
  }

  return (
    <SectionCard
      title="Edición de videos"
      description="Cómo arma la Mac del estudio el clip de cada video de esta cuenta. Los momentos de cada video se cuentan arriba, en su paso del protocolo."
    >
      <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="video-target">Cuánto dura el clip, en segundos</Label>
            <Input id="video-target" type="number" inputMode="numeric" min={10} max={60} value={seconds} onChange={(e) => setSeconds(e.target.value)} className="w-28" />
            <p className="text-xs text-muted-foreground">De 10 a 60. Se puede cambiar al pedir cada edición.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-step">Paso del protocolo para los videos copiados al Drive</Label>
            <select id="video-step" value={v.defaultStepId ?? ''} onChange={(e) => set({ defaultStepId: e.target.value || null })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
              <option value="">Ninguno</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.moments === 0 ? ' (sin momentos)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Un video copiado a la carpeta no dice con qué paso se grabó: se edita con los momentos de este.</p>
          </div>
        </div>

        <div className="space-y-3">
          <Check checked={v.voiceOn} onChange={(voiceOn) => set({ voiceOn, subtitlesOn: voiceOn ? v.subtitlesOn : false })} label="Voz en off" help="Claude escribe el guión con la ficha del producto y ElevenLabs lo dice." />
          {v.voiceOn ? (
            <div className="space-y-1.5 pl-6">
              <Label htmlFor="video-voice">ID de la voz de ElevenLabs</Label>
              <Input id="video-voice" value={v.voiceId} onChange={(e) => set({ voiceId: e.target.value })} placeholder="Por ejemplo: 21m00Tcm4TlvDq8ikWAM" className="max-w-sm font-mono" />
              <p className="text-xs text-muted-foreground">En ElevenLabs, en Voices, abrí el menú de la voz y elegí Copy voice ID.</p>
            </div>
          ) : null}
          <Check checked={v.subtitlesOn} disabled={!v.voiceOn} onChange={(subtitlesOn) => set({ subtitlesOn })} label="Subtítulos" help="El guión escrito sobre el video, con la palabra que se dice resaltada. Necesita la voz en off." />
          {v.subtitlesOn ? (
            <div className="space-y-1.5 pl-6">
              <Label htmlFor="video-color">Color de la palabra que se está diciendo</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="video-color"
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(v.subtitleColor) ? v.subtitleColor : '#FFE633'}
                  onChange={(e) => set({ subtitleColor: e.target.value.toUpperCase() })}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
                />
                <Input aria-label="Color, en letras y números" value={v.subtitleColor} onChange={(e) => set({ subtitleColor: e.target.value })} placeholder="#6FA82C" className="w-32 font-mono" />
                <span className="rounded-md bg-neutral-600 px-3 py-1.5 text-sm font-bold text-white" style={{ WebkitTextStroke: '0.5px black' }}>
                  Así <span style={{ color: /^#[0-9a-fA-F]{6}$/.test(v.subtitleColor) ? v.subtitleColor : '#FFE633' }}>se ve</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">El color de la marca. Las demás palabras van en blanco, con borde negro.</p>
            </div>
          ) : null}
          <Check checked={v.musicOn} onChange={(musicOn) => set({ musicOn })} label="Música de fondo" help="ElevenLabs la genera para cada clip, del largo justo. Baja sola cuando habla la voz." />
          {v.musicOn ? (
            <div className="space-y-1.5 pl-6">
              <Label htmlFor="video-music">Estilo de la música</Label>
              <Textarea id="video-music" rows={2} value={v.musicStyle} maxLength={500} onChange={(e) => set({ musicStyle: e.target.value })} />
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t pt-4">
          <Check checked={v.autoEdit} onChange={(autoEdit) => set({ autoEdit })} label="Editar solo cada video nuevo" help="Al grabar un video en Registro de productos o al leer la carpeta del Drive, va a la cola del editor sin que nadie lo pida." />
          <Check checked={v.autoApprove} onChange={(autoApprove) => set({ autoApprove })} label="Aprobar solo el clip que salió sin avisos" help="Si la edición tuvo algún aviso, espera a que alguien la mire." />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} pending={pending} disabled={pending || !valid}>
            Guardar
          </Button>
          <StatusText status={status} />
        </div>
      </div>
    </SectionCard>
  );
}
