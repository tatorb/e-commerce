'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addBrandAction, removeBrandAction, updateBrandAction } from '@/app/marcas-vehiculos/actions';
import { LOGO_TYPES } from '@/domain/text-images';

// La lista de marcas de vehículos: agregar, editar el nombre y los alias,
// subir o sacar el logo y borrar las que ninguna pieza usa.

type Brand = { key: string; name: string; aliases: string[]; logo: string | null; used: number };
type Status = { ok: boolean; text: string } | null;

const ACCEPT = Object.keys(LOGO_TYPES)
  .map((e) => `.${e}`)
  .join(',');

export function BrandListEditor({ brands, canWrite }: { brands: Brand[]; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', aliases: '' });

  const go = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
      setStatus(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  async function sendLogo(key: string, file: File) {
    const body = new FormData();
    body.set('logo', file);
    const res = await fetch(`/api/marcas-vehiculos/${encodeURIComponent(key)}/logo`, { method: 'POST', body }).catch(() => null);
    const r = (await res?.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    return r?.ok ? { ok: true as const, message: 'Logo subido. Ya aparece en las imágenes con texto.' } : { ok: false as const, error: r?.error ?? 'No se pudo subir el logo.' };
  }

  async function dropLogo(key: string) {
    const res = await fetch(`/api/marcas-vehiculos/${encodeURIComponent(key)}/logo`, { method: 'DELETE' }).catch(() => null);
    return res?.ok ? { ok: true as const, message: 'Logo sacado.' } : { ok: false as const, error: 'No se pudo sacar el logo.' };
  }

  return (
    <div className="space-y-3">
      {canWrite ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            go(
              () => addBrandAction({ name, aliases }),
              () => {
                setName('');
                setAliases('');
              },
            );
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva marca" aria-label="Nueva marca" maxLength={60} disabled={pending} />
          <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Alias, separados por coma" aria-label="Alias de la nueva marca" disabled={pending} />
          <Button type="submit" disabled={pending || !name.trim()}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </form>
      ) : null}
      {status ? (
        <p role="status" className={status.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>
          {status.text}
        </p>
      ) : null}
      <ul className="divide-y rounded-md border">
        {brands.map((b) => (
          <li key={b.key} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded border bg-white">
              {b.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo} alt={`Logo de ${b.name}`} className="max-h-8 max-w-14 object-contain" />
              ) : (
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{b.name}</span>
              )}
            </span>
            {editing === b.key ? (
              <form
                className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  go(() => updateBrandAction(b.key, draft), () => setEditing(null));
                }}
              >
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label={`Nombre de ${b.name}`} disabled={pending} autoFocus />
                <Input value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} aria-label={`Alias de ${b.name}`} disabled={pending} />
                <Button type="submit" size="sm" disabled={pending || !draft.name.trim()} aria-label="Guardar">
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={pending} aria-label="Cancelar">
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{b.name}</span> <span className="text-xs text-muted-foreground">· {b.key}</span>
                  {b.aliases.length > 0 ? <span className="block text-xs text-muted-foreground">También {b.aliases.join(', ')}</span> : null}
                </span>
                {!b.logo ? <Badge variant="outline">Sin logo</Badge> : null}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {b.used === 0 ? 'Sin usar' : b.used === 1 ? 'En 1 imagen' : `En ${b.used} imágenes`}
                </span>
                {canWrite ? (
                  <span className="flex items-center gap-1">
                    <LogoButton disabled={pending} label={b.logo ? 'Cambiar logo' : 'Subir logo'} onFile={(f) => go(() => sendLogo(b.key, f))} />
                    {b.logo ? (
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => go(() => dropLogo(b.key))}>
                        Sacar logo
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Editar ${b.name}`}
                      onClick={() => {
                        setEditing(b.key);
                        setDraft({ name: b.name, aliases: b.aliases.join(', ') });
                        setStatus(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending || b.used > 0}
                      title={b.used > 0 ? 'No se puede borrar: la usa alguna imagen con texto.' : undefined}
                      aria-label={`Borrar ${b.name}`}
                      onClick={() => {
                        if (window.confirm(`¿Borrar ${b.name}?`)) go(() => removeBrandAction(b.key));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogoButton({ label, disabled, onFile }: { label: string; disabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
        <ImagePlus className="h-4 w-4" />
        {label}
      </Button>
    </>
  );
}
