'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RowList } from '@/components/products/RowList';
import type { TitleRules } from '@/domain/title-rules';
import { resetTitleRulesAction, saveTitleRulesAction } from '@/app/a/[cuenta]/reglas-titulo/actions';

// Las reglas de título de una cuenta en un canal, para editar.

type Values = { maxLength: string; forbiddenChars: string; forbiddenWords: string; structures: { family: string; structure: string }[] };

function toValues(r: TitleRules): Values {
  return {
    maxLength: r.maxLength?.toString() ?? '',
    forbiddenChars: [...r.forbiddenChars].join(' '),
    forbiddenWords: r.forbiddenWords.join('\n'),
    structures: r.structures.map((s) => ({ family: s.family, structure: s.structure })),
  };
}

export function TitleRulesForm({
  accountSlug,
  channelId,
  channelName,
  rules,
  defaults,
  custom,
  families,
}: {
  accountSlug: string;
  channelId: string;
  channelName: string;
  rules: TitleRules;
  // Las del canal, para volver a ellas.
  defaults: TitleRules;
  custom: boolean;
  families: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => toValues(rules));
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus(null);
  }

  function save() {
    startTransition(async () => {
      const r = await saveTitleRulesAction(accountSlug, channelId, {
        maxLength: values.maxLength,
        forbiddenChars: values.forbiddenChars,
        forbiddenWords: values.forbiddenWords.split('\n'),
        structures: values.structures,
      });
      setStatus(r.ok ? { kind: 'ok', text: 'Reglas guardadas.' } : { kind: 'error', text: r.error });
      if (r.ok) router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      const r = await resetTitleRulesAction(accountSlug, channelId);
      if (!r.ok) {
        setStatus({ kind: 'error', text: r.error });
        return;
      }
      setValues(toValues(defaults));
      setStatus({ kind: 'ok', text: `Volvieron las reglas de ${channelName}.` });
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`max-${channelId}`}>Largo máximo</Label>
          <Input
            id={`max-${channelId}`}
            inputMode="numeric"
            value={values.maxLength}
            onChange={(e) => set('maxLength', e.target.value)}
            placeholder="60"
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">Caracteres, con espacios.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`chars-${channelId}`}>Signos no permitidos</Label>
          <Input
            id={`chars-${channelId}`}
            value={values.forbiddenChars}
            onChange={(e) => set('forbiddenChars', e.target.value)}
            placeholder="! ¡ * $"
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">Todos juntos o separados por espacios.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`words-${channelId}`}>Palabras no permitidas</Label>
        <Textarea
          id={`words-${channelId}`}
          rows={6}
          value={values.forbiddenWords}
          onChange={(e) => set('forbiddenWords', e.target.value)}
          placeholder={'envío gratis\noferta'}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">Una por línea. También pueden ser frases.</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Estructura sugerida por familia</p>
        <p className="text-xs text-muted-foreground">
          En qué orden van los datos en el título. Con la familia vacía vale para todas.
          {families.length > 0 ? ` Familias de la cuenta: ${families.join(', ')}.` : ''}
        </p>
        <RowList
          idPrefix={`structure-${channelId}`}
          rows={values.structures}
          onChange={(rows) => set('structures', rows)}
          template={{ family: '', structure: '' }}
          columns={[
            { key: 'family', label: 'Familia', placeholder: 'Vacía = todas' },
            { key: 'structure', label: 'Estructura', placeholder: 'Tipo de producto + Modelo + Motor…' },
          ]}
          gridClassName="sm:grid-cols-[14rem_1fr]"
          addLabel="Agregar estructura"
          emptyLabel="Sin estructura sugerida."
          disabled={pending}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button pending={pending} type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar reglas'}
        </Button>
        {custom ? (
          <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
            Volver a las de {channelName}
          </Button>
        ) : null}
        {status ? (
          <span className={status.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} role="status">
            {status.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
