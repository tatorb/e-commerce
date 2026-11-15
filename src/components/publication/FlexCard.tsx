'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { readFlexAction, setFlexAction } from '@/app/a/[cuenta]/publicaciones/sync-actions';
import { flexConfirm, flexLabel } from '@/domain/flex';

// Envíos Flex en la publicación: si lo ofrece y el botón para prenderlo o
// apagarlo. Lo decide una persona, con confirmación. En una familia, el cambio
// va a todas sus medidas.
export function FlexCard({
  accountSlug,
  publicationId,
  channelName,
  flex,
  familySize = 0,
}: {
  accountSlug: string;
  publicationId: string;
  channelName: string;
  // Lo último leído del canal. Null: el canal no lo dice.
  flex: boolean | null;
  familySize?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'set' | 'read' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const on = flex !== true;

  async function change() {
    if (!window.confirm(flexConfirm(on, channelName, 1, familySize))) return;
    setBusy('set');
    setMessage(null);
    const r = await setFlexAction(accountSlug, [publicationId], on).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: `Se cortó la conexión con la app. Fijate en ${channelName} si cambió.` });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    if (r.failed.length > 0) {
      const ok = r.done.length;
      return setMessage({ kind: 'error', text: `${ok > 0 ? `Cambió en ${ok} de ${ok + r.failed.length} medidas. ` : ''}${r.failed[0].message}` });
    }
    setMessage({ kind: 'ok', text: on ? `Listo, ya ofrece Envíos Flex en ${channelName}.` : `Listo, ya no ofrece Envíos Flex en ${channelName}.` });
    router.refresh();
  }

  async function read() {
    setBusy('read');
    setMessage(null);
    const r = await readFlexAction(accountSlug, publicationId).catch(() => null);
    setBusy(null);
    if (!r) return setMessage({ kind: 'error', text: 'Se cortó la conexión con la app.' });
    if (!r.ok) return setMessage({ kind: 'error', text: r.error });
    setMessage({ kind: 'ok', text: `${channelName} dice: ${flexLabel(r.flex).toLowerCase()}.` });
    router.refresh();
  }

  const description =
    flex === true
      ? `Ofrece Envíos Flex: la entregás vos, en el día o al día siguiente.`
      : flex === false
        ? 'No ofrece Envíos Flex.'
        : `${channelName} no dice si ofrece Envíos Flex. Puede ser que la cuenta no tenga Flex activo.`;

  return (
    <SectionCard title="Envíos Flex" icon={<Truck />} description={description + (familySize >= 2 ? ` El cambio va a las ${familySize} medidas de la familia.` : '')}>
      <SectionBody className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button access="subir" size="sm" variant={on ? 'default' : 'outline'} pending={busy === 'set'} disabled={busy !== null} onClick={change}>
            <Truck />
            {on ? 'Prender Flex' : 'Apagar Flex'}
          </Button>
          <Button access="view" size="sm" variant="ghost" pending={busy === 'read'} disabled={busy !== null} onClick={read}>
            <RefreshCw />
            Consultar en {channelName}
          </Button>
        </div>
        {message ? (
          <p className={message.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-emerald-700'} role="status">
            {message.text}
          </p>
        ) : null}
      </SectionBody>
    </SectionCard>
  );
}
