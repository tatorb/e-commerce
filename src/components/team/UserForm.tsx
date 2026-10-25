'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import {
  levelsOf,
  PRESETS,
  SECTION_KEYS,
  SECTIONS,
  SETTINGS_SECTIONS,
  type Level,
  type Permissions,
  type PresetKey,
  type Section,
} from '@/domain/access';
import { createUserAction, updateUserAction } from '@/lib/auth/actions';
import { cn } from '@/lib/utils/cn';

// Alta y edición de un usuario: sus datos, si es administrador, qué cuentas ve
// y qué puede en cada sección.

export type UserFormValues = { name: string; email: string; isAdmin: boolean; permissions: Permissions; accountIds: string[] };

type Choice = Level | 'none';

const WORK_SECTIONS = SECTION_KEYS.filter((s) => !SETTINGS_SECTIONS.includes(s));

/** Las opciones de cada sección, con su nombre. */
function choicesOf(section: Section): { value: Choice; label: string }[] {
  const levels = levelsOf(section);
  if (!levels.includes('read')) return [{ value: 'none', label: 'No' }, { value: 'write', label: 'Puede' }];
  return [
    { value: 'none', label: 'No la ve' },
    { value: 'read', label: 'Ve' },
    ...(levels.includes('write') ? [{ value: 'write' as const, label: 'Ve y cambia' }] : []),
  ];
}

function SectionRow({ section, value, onChange, name }: { section: Section; value: Choice; onChange: (v: Choice) => void; name: string }) {
  const spec = SECTIONS[section] as { label: string; hint?: string };
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{spec.label}</p>
        {spec.hint ? <p className="text-xs text-muted-foreground">{spec.hint}</p> : null}
      </div>
      <div role="radiogroup" aria-label={spec.label} className="inline-flex shrink-0 overflow-hidden rounded-md border">
        {choicesOf(section).map((c) => (
          <label
            key={c.value}
            className={cn(
              'cursor-pointer border-l px-3 py-1.5 text-xs font-medium first:border-l-0',
              value === c.value ? 'bg-foreground text-background' : 'bg-background text-foreground/70 hover:bg-muted',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={value === c.value} onChange={() => onChange(c.value)} />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function UserForm({
  userId,
  initial,
  accounts,
  passwordMin,
}: {
  // Sin id, es un alta.
  userId?: string;
  initial: UserFormValues;
  accounts: { id: string; name: string }[];
  passwordMin: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const isNew = !userId;

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus(null);
  };
  const choice = (s: Section): Choice => values.permissions[s] ?? 'none';
  const setChoice = (s: Section, c: Choice) => {
    const next = { ...values.permissions };
    if (c === 'none') delete next[s];
    else next[s] = c;
    set('permissions', next);
  };
  const preset = (key: PresetKey) => set('permissions', { ...PRESETS[key].permissions });
  const toggleAccount = (id: string, on: boolean) =>
    set('accountIds', on ? [...new Set([...values.accountIds, id])] : values.accountIds.filter((a) => a !== id));

  function save() {
    setStatus(null);
    startTransition(async () => {
      const access = { isAdmin: values.isAdmin, permissions: values.permissions, accountIds: values.accountIds };
      if (isNew) {
        const r = await createUserAction({ name: values.name, email: values.email, password, access });
        if (!r.ok) return setStatus({ kind: 'error', text: r.error });
        router.push(`/equipo/usuarios/${r.id}?nuevo=1`);
        return;
      }
      const r = await updateUserAction(userId, { name: values.name, email: values.email, access });
      if (!r.ok) return setStatus({ kind: 'error', text: r.error });
      setStatus({ kind: 'ok', text: 'Guardado.' });
      router.refresh();
    });
  }

  const noAccounts = !values.isAdmin && values.accountIds.length === 0;
  const noSections = !values.isAdmin && Object.keys(values.permissions).length === 0;

  return (
    <div className="space-y-6">
      <SectionCard title="Datos">
        <SectionBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nombre</Label>
              <Input id="u-name" value={values.name} onChange={(e) => set('name', e.target.value)} disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} disabled={pending} />
            </div>
            {isNew ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="u-password">Contraseña temporal</Label>
                <Input
                  id="u-password"
                  type="text"
                  autoComplete="off"
                  placeholder={`Mínimo ${passwordMin} caracteres`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                  className="sm:max-w-sm"
                />
                <p className="text-xs text-muted-foreground">Pasásela a la persona. La primera vez que entre, la app le pide cambiarla por una suya.</p>
              </div>
            ) : null}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={values.isAdmin} onChange={(e) => set('isAdmin', e.target.checked)} disabled={pending} />
            <span>
              <span className="font-medium">Administrador.</span>{' '}
              <span className="text-muted-foreground">Puede todo, ve todas las cuentas y maneja los usuarios, el Drive y el trabajador de imágenes.</span>
            </span>
          </label>
        </SectionBody>
      </SectionCard>

      {values.isAdmin ? null : (
        <>
          <SectionCard title="Cuentas que ve" description="Las cuentas de clientes que aparecen en su menú. Las demás no las ve.">
            <SectionBody>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay cuentas.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {accounts.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={values.accountIds.includes(a.id)}
                        onChange={(e) => toggleAccount(a.id, e.target.checked)}
                        disabled={pending}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              )}
              {noAccounts ? <p className="text-xs text-amber-700">Sin ninguna cuenta, solo va a poder entrar a su usuario en Equipo.</p> : null}
            </SectionBody>
          </SectionCard>

          <SectionCard
            title="Qué puede en cada sección"
            description="Ve: entra y mira, pero los botones que guardan quedan apagados. Ve y cambia: también guarda. Vale igual en todas sus cuentas."
            action={
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
                  <Button key={k} type="button" size="sm" variant="outline" onClick={() => preset(k)} disabled={pending}>
                    {PRESETS[k].label}
                  </Button>
                ))}
              </div>
            }
          >
            <div className="divide-y">
              {WORK_SECTIONS.map((s) => (
                <SectionRow key={s} section={s} name={`perm-${s}`} value={choice(s)} onChange={(c) => setChoice(s, c)} />
              ))}
              <p className="bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ajustes</p>
              {SETTINGS_SECTIONS.map((s) => (
                <SectionRow key={s} section={s} name={`perm-${s}`} value={choice(s)} onChange={(c) => setChoice(s, c)} />
              ))}
            </div>
          </SectionCard>
          {noSections ? <p className="text-xs text-amber-700">Sin ninguna sección, no va a poder ver nada de las cuentas.</p> : null}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} pending={pending} disabled={pending || !values.name.trim() || !values.email.trim() || (isNew && !password)}>
          {isNew ? 'Crear usuario' : 'Guardar'}
        </Button>
        <StatusText status={status} />
      </div>
    </div>
  );
}
