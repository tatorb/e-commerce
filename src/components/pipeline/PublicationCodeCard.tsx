'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OpenLinkButton } from '@/components/ui/open-link-button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import type { ChannelInfo } from '@/channels';
import { savePublicationCodeAction } from '@/app/a/[cuenta]/pipeline/actions';
import { StatusText } from './StatusText';
import { useStepAction } from './useStepAction';

// Paso Publicación: el ID del canal, cuando la publicación ya se publicó. Sin
// ID no se puede marcar como corregida.
export function PublicationCodeCard({
  accountSlug,
  publicationId,
  channel,
  externalId,
  url,
}: {
  accountSlug: string;
  publicationId: string;
  channel: ChannelInfo;
  externalId: string | null;
  url: string | null;
}) {
  const [editing, setEditing] = useState(externalId === null);
  const [value, setValue] = useState('');
  const action = useStepAction();

  function save() {
    action.run(
      () => savePublicationCodeAction(accountSlug, publicationId, value),
      () => {
        setValue('');
        setEditing(false);
      },
    );
  }

  return (
    <SectionCard
      title={`${channel.externalIdLabel} en ${channel.name}`}
      description={
        externalId
          ? 'La publicación ya está en el canal.'
          : `Cuando la publiques en ${channel.name}, cargá acá su ID. Sin el ID no se puede marcar como corregida.`
      }
      action={
        externalId && !editing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Cambiar
          </Button>
        ) : null
      }
    >
      <SectionBody>
        {externalId ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{externalId}</span>
            {url ? <OpenLinkButton url={url} label={`Abrir ${externalId} en una pestaña nueva`} className="h-7 w-7" /> : null}
          </div>
        ) : null}
        {editing ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) save();
            }}
          >
            <Label htmlFor={`code-${publicationId}`}>{externalId ? 'ID nuevo' : channel.externalIdLabel}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={`code-${publicationId}`}
                className="w-full sm:w-80"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  action.clear();
                }}
                placeholder={channel.externalIdPlaceholder}
                disabled={action.pending}
              />
              <Button type="submit" disabled={action.pending || !value.trim()}>
                {action.pending ? 'Guardando…' : 'Guardar'}
              </Button>
              {externalId ? (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={action.pending}>
                  Cancelar
                </Button>
              ) : null}
            </div>
            {channel.externalIdHelp ? <p className="text-xs text-muted-foreground">{channel.externalIdHelp}</p> : null}
          </form>
        ) : null}
        <StatusText status={action.status} />
      </SectionBody>
    </SectionCard>
  );
}
