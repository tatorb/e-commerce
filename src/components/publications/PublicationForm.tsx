'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RowList } from '@/components/products/RowList';
import { cn } from '@/lib/utils/cn';
import type { ChannelInfo } from '@/channels';
import type { ChannelStatus } from '@/generated/prisma/enums';
import {
  createPublicationAction,
  updatePublicationAction,
  type PublicationFormInput,
} from '@/app/a/[cuenta]/productos/actions';

export const CHANNEL_STATUS_OPTIONS: { value: ChannelStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activa' },
  { value: 'PAUSED', label: 'Pausada' },
  { value: 'INACTIVE', label: 'Inactiva' },
  { value: 'UNPUBLISHED', label: 'Sin publicar' },
];

type Status = { kind: 'idle' } | { kind: 'success' } | { kind: 'error'; message: string };

/**
 * Datos de la publicación en una tienda. Sirve para crearla (dentro del
 * diálogo) y para editarla. No conoce el canal: los rótulos y el largo del
 * título llegan en `channel`, y el ID se valida en el servidor.
 */
export function PublicationForm({
  accountSlug,
  channel,
  initial,
  mode,
  onCreated,
  onCancel,
}: {
  accountSlug: string;
  channel: ChannelInfo;
  initial: PublicationFormInput;
  mode: { kind: 'create'; productId: string; storeId: string } | { kind: 'edit'; publicationId: string };
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PublicationFormInput>(initial);
  const [saved, setSaved] = useState<PublicationFormInput>(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const prefix = mode.kind === 'edit' ? mode.publicationId : 'new';
  const titleLength = values.title.trim().length;
  const titleTooLong = channel.titleMaxLength !== null && titleLength > channel.titleMaxLength;

  function set<K extends keyof PublicationFormInput>(key: K, value: PublicationFormInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (status.kind !== 'idle') setStatus({ kind: 'idle' });
  }

  function handleSave() {
    setStatus({ kind: 'idle' });
    startTransition(async () => {
      const result =
        mode.kind === 'create'
          ? await createPublicationAction(accountSlug, mode.productId, mode.storeId, values)
          : await updatePublicationAction(accountSlug, mode.publicationId, values);
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error });
        return;
      }
      if (mode.kind === 'create') {
        onCreated?.();
      } else {
        setSaved(values);
        setStatus({ kind: 'success' });
      }
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-externalId`}>{channel.externalIdLabel}</Label>
          <Input
            id={`${prefix}-externalId`}
            value={values.externalId}
            onChange={(e) => set('externalId', e.target.value)}
            placeholder={channel.externalIdPlaceholder}
            disabled={pending}
          />
          {channel.externalIdHelp ? (
            <p className="text-xs text-muted-foreground">{channel.externalIdHelp}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-status`}>Estado en {channel.name}</Label>
          <Select
            value={values.channelStatus}
            onValueChange={(v) => set('channelStatus', v as ChannelStatus)}
            disabled={pending}
          >
            <SelectTrigger id={`${prefix}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-url`}>Link</Label>
        <Input
          id={`${prefix}-url`}
          type="url"
          value={values.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="se arma solo con el ID…"
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${prefix}-title`}>Título</Label>
          {channel.titleMaxLength !== null ? (
            <span
              className={cn(
                'text-xs tabular-nums',
                titleTooLong ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {titleLength}/{channel.titleMaxLength}
            </span>
          ) : null}
        </div>
        <Input
          id={`${prefix}-title`}
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-description`}>Descripción</Label>
        <Textarea
          id={`${prefix}-description`}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={pending}
          rows={mode.kind === 'create' ? 3 : 6}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-price`}>Precio</Label>
        <Input
          id={`${prefix}-price`}
          inputMode="decimal"
          value={values.price}
          onChange={(e) => set('price', e.target.value)}
          placeholder="125.000"
          disabled={pending}
          className="max-w-[12rem]"
        />
      </div>

      {mode.kind === 'edit' ? (
        <div className="space-y-1.5">
          <span className="text-sm font-medium leading-none">Atributos en {channel.name}</span>
          <RowList
            idPrefix={`${prefix}-attr`}
            rows={values.attributes}
            onChange={(rows) => set('attributes', rows)}
            template={{ name: '', value: '' }}
            columns={[
              { key: 'name', label: 'Atributo' },
              { key: 'value', label: 'Valor' },
            ]}
            gridClassName="sm:grid-cols-2"
            addLabel="Agregar atributo"
            emptyLabel="Sin atributos cargados."
            disabled={pending}
          />
        </div>
      ) : null}

      <div
        className={cn(
          'flex items-center gap-3',
          mode.kind === 'create' && 'flex-col-reverse items-stretch sm:flex-row sm:justify-end',
        )}
      >
        {mode.kind === 'create' ? (
          <>
            {status.kind === 'error' ? (
              <span className="text-sm text-destructive sm:mr-auto">{status.message}</span>
            ) : null}
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || titleTooLong}>
              {pending ? 'Creando…' : 'Crear publicación'}
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" disabled={pending || !dirty || titleTooLong}>
              {pending ? 'Guardando…' : 'Guardar publicación'}
            </Button>
            {status.kind === 'success' ? <span className="text-sm text-green-600">Guardado.</span> : null}
            {status.kind === 'error' ? (
              <span className="text-sm text-destructive">{status.message}</span>
            ) : null}
          </>
        )}
      </div>
    </form>
  );
}
