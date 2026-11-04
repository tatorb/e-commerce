'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { saveMeasuresAction } from '@/app/a/[cuenta]/pipeline/measure-actions';
import type { MeasureCheck } from '@/lib/photo-measures';
import { cn } from '@/lib/utils/cn';

// Medidas de las fotos: avisa cuando una foto, un video o una publicación de
// la familia apunta a una medida que ya no está en la ficha, y deja elegir a
// cuál va cada uno. Propone la que parece, pero nada se guarda sin tocar Guardar.

const ALL = '__todas__';

export function MeasureCheckCard({ accountSlug, publicationId, check }: { accountSlug: string; publicationId: string; check: MeasureCheck }) {
  const router = useRouter();
  const guessOf = (s: MeasureCheck['photos'][number]['state'] | MeasureCheck['members'][number]['state']) => (s.kind === 'unknown' && s.guess ? s.guess.key : '');
  const [photos, setPhotos] = useState<Record<string, string>>(() => Object.fromEntries(check.unknownPhotos.map((p) => [p.editId, guessOf(p.state)])));
  const [videos, setVideos] = useState<Record<string, string>>(() => Object.fromEntries(check.unknownVideos.map((v) => [v.videoId, guessOf(v.state)])));
  const [members, setMembers] = useState<Record<string, string>>(() =>
    Object.fromEntries([...check.memberIssues, ...check.repeatedMembers].map((m) => [m.publicationId, m.state.kind === 'measure' ? m.state.key : guessOf(m.state)])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!check.hasIssues) return null;

  const labelOf = (key: string) => (key === ALL ? 'todas las medidas' : (check.measures.find((m) => m.key === key)?.label ?? key));
  const missing = [...Object.values(photos), ...Object.values(videos), ...Object.values(members)].some((v) => !v);
  const memberKeys = Object.values(members).filter(Boolean);
  const clash = new Set(memberKeys).size !== memberKeys.length && check.memberIssues.length + check.repeatedMembers.length === check.members.length;
  // Lo que va a cambiar, dicho antes de guardar.
  const summary = Object.entries(
    [...Object.values(photos), ...Object.values(videos)].filter(Boolean).reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {}),
  ).map(([k, n]) => `${n} a ${labelOf(k)}`);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await saveMeasuresAction(accountSlug, publicationId, {
      photos: Object.entries(photos).map(([editId, k]) => ({ editId, variantKey: k === ALL ? null : k })),
      videos: Object.entries(videos).map(([videoId, k]) => ({ videoId, variantKey: k === ALL ? null : k })),
      members: Object.entries(members).map(([id, k]) => ({ publicationId: id, variantKey: k })),
    }).catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  }

  const select = (value: string, onChange: (v: string) => void, label: string, withAll: boolean) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 rounded-md border bg-background px-2 text-sm">
      <option value="">Elegí la medida</option>
      {check.measures.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
      {withAll ? <option value={ALL}>Todas las medidas</option> : null}
    </select>
  );

  return (
    <SectionCard
      title="Medidas de las fotos"
      icon={<Ruler />}
      className="border-alert/50"
      description="Hay fotos o publicaciones de la familia que apuntan a una medida que ya no está en la ficha, por ejemplo porque la medida cambió de nombre. Mientras tanto no se sabe de cuál son: no aparecen en ninguna medida. Elegí a cuál va cada una. Te propongo la que parece por su nombre o su SKU."
    >
      <SectionBody>
        {check.memberIssues.length + check.repeatedMembers.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Qué medida vende cada publicación de la familia</p>
            <ul className="divide-y rounded-md border">
              {[...check.memberIssues, ...check.repeatedMembers].map((m) => (
                <li key={m.publicationId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.title ?? 'Sin título'}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.externalId ?? 'Sin publicar'} ·{' '}
                      {m.state.kind === 'none' ? 'sin medida' : m.state.kind === 'unknown' ? `«${m.state.label}», que ya no está en la ficha` : `${m.state.label}, repetida en la familia`}
                    </span>
                  </span>
                  {select(members[m.publicationId] ?? '', (v) => setMembers((x) => ({ ...x, [m.publicationId]: v })), `Medida de ${m.title ?? m.externalId ?? 'la publicación'}`, false)}
                </li>
              ))}
            </ul>
            {clash ? <p className="text-sm text-destructive">Dos publicaciones de la familia no pueden vender la misma medida.</p> : null}
          </div>
        ) : null}

        {check.unknownPhotos.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {check.unknownPhotos.length === 1 ? '1 foto' : `${check.unknownPhotos.length} fotos`} con una medida que ya no está
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {check.unknownPhotos.map((p) => (
                <li key={p.editId} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded border bg-muted object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{p.name}</span>
                    <span className="text-xs text-destructive">Dice «{p.state.kind === 'unknown' ? p.state.label : ''}»</span>
                  </span>
                  {select(photos[p.editId] ?? '', (v) => setPhotos((x) => ({ ...x, [p.editId]: v })), `Medida de ${p.name}`, true)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {check.unknownVideos.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{check.unknownVideos.length === 1 ? '1 video' : `${check.unknownVideos.length} videos`} con una medida que ya no está</p>
            <ul className="space-y-2">
              {check.unknownVideos.map((v) => (
                <li key={v.videoId} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-xs">{v.name}</span>
                  {select(videos[v.videoId] ?? '', (x) => setVideos((y) => ({ ...y, [v.videoId]: x })), `Medida de ${v.name}`, true)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.length > 0 ? <p className="text-sm text-muted-foreground">Al guardar: {summary.join(', ')}.</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={busy || missing || clash} pending={busy}>
            Guardar las medidas
          </Button>
          {missing ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Falta elegir alguna.
            </span>
          ) : null}
        </div>
        {msg ? (
          <p role="status" className={cn('text-sm', msg.ok ? 'text-emerald-700' : 'text-destructive')}>
            {msg.text}
          </p>
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
