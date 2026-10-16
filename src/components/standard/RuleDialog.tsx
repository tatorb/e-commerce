'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CHECKS, CHECK_BY_KEY, readParams, type CheckKey } from '@/domain/standard';
import { saveRuleAction } from '@/app/a/[cuenta]/estandar/actions';

export type RuleValues = {
  id: string | null;
  name: string;
  description: string;
  check: CheckKey;
  params: Record<string, number>;
  weight: number;
  active: boolean;
};

const EMPTY: RuleValues = {
  id: null,
  name: '',
  description: '',
  check: 'min_photos',
  params: readParams('min_photos', {}),
  weight: 10,
  active: true,
};

// Diálogo para crear o editar una regla, con el mismo patrón que "Nueva
// empresa" en app.studiomrb.com.
export function RuleDialog({
  accountSlug,
  channelId,
  rule,
}: {
  accountSlug: string;
  channelId: string;
  rule?: RuleValues;
}) {
  const router = useRouter();
  const initial = rule ?? EMPTY;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<RuleValues>(initial);
  const [weightText, setWeightText] = useState(String(initial.weight));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const def = CHECK_BY_KEY.get(values.check)!;

  function reset() {
    setValues(initial);
    setWeightText(String(initial.weight));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await saveRuleAction(accountSlug, channelId, values.id, {
        name: values.name,
        description: values.description,
        check: values.check,
        params: values.params,
        weight: weightText,
        active: values.active,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      if (!rule) reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {rule ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar regla
        </Button>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regla' : 'Nueva regla'}</DialogTitle>
          <DialogDescription>
            El puntaje de cada publicación se vuelve a calcular solo con los cambios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Nombre</Label>
            <Input
              id="rule-name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="mínimo 6 fotos…"
              maxLength={120}
              disabled={pending}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-description">Descripción</Label>
            <Textarea
              id="rule-description"
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              placeholder="por qué importa…"
              maxLength={500}
              rows={2}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-check">Qué revisa</Label>
            <Select
              value={values.check}
              onValueChange={(v) =>
                setValues((prev) => ({ ...prev, check: v as CheckKey, params: readParams(v as CheckKey, prev.params) }))
              }
              disabled={pending}
            >
              <SelectTrigger id="rule-check">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHECKS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{def.help}</p>
          </div>
          {def.params.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {def.params.map((p) => (
                <div key={p.key} className="space-y-1.5">
                  <Label htmlFor={`rule-param-${p.key}`}>{p.label}</Label>
                  <Input
                    id={`rule-param-${p.key}`}
                    type="number"
                    inputMode="numeric"
                    min={p.min}
                    max={p.max}
                    value={values.params[p.key] ?? p.default}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, params: { ...v.params, [p.key]: Number(e.target.value) } }))
                    }
                    disabled={pending}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-weight">Peso</Label>
              <Input
                id="rule-weight"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={weightText}
                onChange={(e) => setWeightText(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Cuánto vale la regla en el puntaje, de 1 a 100.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-active">Estado</Label>
              <Select
                value={values.active ? 'on' : 'off'}
                onValueChange={(v) => setValues((prev) => ({ ...prev, active: v === 'on' }))}
                disabled={pending}
              >
                <SelectTrigger id="rule-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Activa</SelectItem>
                  <SelectItem value="off">Apagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !values.name.trim()}>
              {pending ? 'Guardando…' : rule ? 'Guardar regla' : 'Crear regla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
