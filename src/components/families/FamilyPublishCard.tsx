'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { ChannelStatusBadge } from '@/components/stages/StageBadge';
import { pushDraftsAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { FACE_FIELD_LABEL, type FaceField } from '@/domain/channel-sync';
import type { ChannelStatus } from '@/generated/prisma/enums';

// El paso Publicación de una familia: cada medida es una publicación en el
// canal, con su código, su estado y sus cambios para subir. Se suben todos
// juntos, una medida después de la otra.

export type FamilyPublishRow = {
  id: string;
  measure: string | null;
  externalId: string | null;
  url: string | null;
  channelStatus: ChannelStatus;
  // Cambios de la app sin subir y datos para elegir.
  draft: boolean;
  choose: boolean;
  quantity: number | null;
};

const fieldsText = (fields: FaceField[]) => fields.map((f) => FACE_FIELD_LABEL[f].toLowerCase()).join(', ');

export function FamilyPublishCard({ accountSlug, channelName, rows }: { accountSlug: string; channelName: string; rows: FamilyPublishRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, { ok: boolean; text: string }>>({});
  const pending = rows.filter((r) => r.draft && r.externalId);

  async function pushAll() {
    setBusy(true);
    for (const r of pending) {
      const res = await pushDraftsAction(accountSlug, r.id).catch(() => null);
      const outcome = !res
        ? { ok: false, text: 'Se cortó la conexión con la app.' }
        : !res.ok
          ? { ok: false, text: res.error }
          : res.rejected.length > 0
            ? { ok: false, text: res.rejected.map((x) => `${FACE_FIELD_LABEL[x.field]}: ${x.message}`).join(' ') }
            : { ok: true, text: res.sent.length > 0 ? `Subido: ${fieldsText(res.sent)}.` : 'No había nada para subir.' };
      setOutcomes((prev) => ({ ...prev, [r.id]: outcome }));
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <SectionCard
      title="Las medidas de la familia"
      description={`Cada medida es una publicación en ${channelName}. Lo que es de la familia se cambió en todas: subí los cambios de cada una.`}
      action={
        <Button size="sm" access="subir" onClick={pushAll} disabled={busy || pending.length === 0}>
          <Upload />
          {busy ? 'Subiendo…' : pending.length > 0 ? `Subir los cambios de ${pending.length === rows.length ? 'todas' : pending.length}` : 'Nada para subir'}
        </Button>
      }
    >
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.id} className="space-y-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="w-28 shrink-0 font-medium">{r.measure ? `Medida ${r.measure}` : 'Medida sin elegir'}</span>
              <Link href={`/a/${accountSlug}/publicaciones/${r.id}`} className="text-xs tabular-nums text-muted-foreground underline-offset-4 hover:underline">
                {r.externalId ?? 'Sin publicar'}
              </Link>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Ver en ${channelName}`} className="text-primary">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <ChannelStatusBadge status={r.channelStatus} />
              <span className="text-xs text-muted-foreground">{r.quantity === null ? 'Cantidad sin leer' : `${r.quantity} disponibles`}</span>
              <span className="ml-auto flex gap-1">
                {r.draft ? <Badge variant="secondary">Cambios sin subir</Badge> : null}
                {r.choose ? <Badge variant="destructive">Para elegir</Badge> : null}
              </span>
            </div>
            {outcomes[r.id] ? <p className={outcomes[r.id].ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{outcomes[r.id].text}</p> : null}
          </li>
        ))}
      </ul>
      {rows.some((r) => r.choose) ? (
        <SectionBody className="py-3">
          <p className="text-xs text-muted-foreground">Lo que está para elegir se resuelve en la página de cada medida.</p>
        </SectionBody>
      ) : null}
    </SectionCard>
  );
}
