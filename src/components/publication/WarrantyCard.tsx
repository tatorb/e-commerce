import { ShieldCheck } from 'lucide-react';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { WarrantyEditor } from '@/components/publication/WarrantyEditor';
import { warrantyLabel } from '@/domain/warranty';
import type { WarrantyOverview } from '@/lib/warranty';

// La garantía en el paso Publicación: la que tiene y, si todavía no está en
// el canal, con cuál se va a crear. Se cambia acá y queda para subir.

export function WarrantyCard({ accountSlug, publicationId, channelName, w }: { accountSlug: string; publicationId: string; channelName: string; w: WarrantyOverview }) {
  const shown = w.own ?? w.channel ?? (w.published ? null : w.forCreate.warranty);
  return (
    <SectionCard
      title="Garantía"
      icon={<ShieldCheck />}
      action={w.pending ? <Badge variant="secondary">Cambio sin subir</Badge> : null}
      description={
        w.published
          ? w.own
            ? `En la app: ${warrantyLabel(w.own)}. En ${channelName}: ${w.channel ? warrantyLabel(w.channel) : 'sin leer'}.${w.pending ? ' Se sube desde Por subir.' : ''}`
            : `Sigue a la de ${channelName}: ${w.channel ? warrantyLabel(w.channel) : 'todavía no se leyó'}.`
          : w.forCreate.warranty
            ? `Se va a crear con ${warrantyLabel(w.forCreate.warranty)}, ${w.forCreate.from === 'publicación' ? 'la de la publicación' : w.forCreate.from === 'cuenta' ? 'la de la cuenta' : 'la de la ficha'}.`
            : 'Sin garantía en la publicación ni en la cuenta: se crearía sin garantía.'
      }
    >
      <SectionBody>
        <WarrantyEditor
          accountSlug={accountSlug}
          target={{ kind: 'publication', publicationId }}
          initial={shown}
          channelName={channelName}
          canClear={w.own !== null}
          clearLabel={w.published ? undefined : 'Usar la de la cuenta'}
        />
      </SectionBody>
    </SectionCard>
  );
}
