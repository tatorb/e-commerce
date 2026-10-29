import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { DraftBar } from '@/components/publication/FaceControls';
import { FACE_FIELD_LABEL } from '@/domain/channel-sync';
import type { PublicationFaces } from '@/lib/queries/publication-faces';

// En el paso Publicación: lo que cambió en la app y falta subir al canal, con
// el botón para subir todo. El detalle de cada dato está en la página de la
// publicación.
export function PendingChangesCard({
  accountSlug,
  faces,
  campaigns = [],
}: {
  accountSlug: string;
  faces: PublicationFaces;
  // Sumarse a una campaña o salir, pedido desde el paso Precio.
  campaigns?: { text: string; rejection: string | null }[];
}) {
  const { publication: p, channelName, summary } = faces;
  const pushable = summary.draft.filter((f) => faces.publishable.includes(f));
  const href = `/a/${accountSlug}/publicaciones/${p.id}?cara=borrador`;
  const pending = summary.draft.length + summary.choose.length + campaigns.length;
  return (
    <SectionCard
      title={`Cambios para subir a ${channelName}`}
      description="Lo que se cambió en la app y todavía no está en el canal."
      action={
        <Button size="sm" variant="outline" asChild>
          <Link href={href}>Ver cada dato</Link>
        </Button>
      }
    >
      <SectionBody className="space-y-3">
        {faces.pushBlocked && pending === 0 ? (
          <p className="text-sm text-muted-foreground">{faces.pushBlocked}</p>
        ) : pending === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cambios sin subir: lo de la app ya está en {channelName}.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {summary.draft.map((f) => (
                <Badge key={f} variant="secondary">
                  {FACE_FIELD_LABEL[f]}: sin subir
                </Badge>
              ))}
              {summary.choose.map((f) => (
                <Badge key={f} variant="destructive">
                  {FACE_FIELD_LABEL[f]}: para elegir
                </Badge>
              ))}
              {campaigns.map((c) => (
                <Badge key={c.text} variant="secondary">
                  Campaña: {c.text.charAt(0).toLowerCase() + c.text.slice(1)}
                </Badge>
              ))}
            </div>
            {campaigns
              .filter((c) => c.rejection)
              .map((c) => (
                <p key={c.text} className="text-sm text-destructive">
                  Campaña: {c.rejection}
                </p>
              ))}
            {summary.rejected.map((r) => (
              <p key={r.field} className="text-sm text-destructive">
                {FACE_FIELD_LABEL[r.field]}: {r.message}
              </p>
            ))}
            {/* También con solo datos para elegir: así no se pierde lo que dijo la última subida. */}
            <DraftBar
              accountSlug={accountSlug}
              publicationId={p.id}
              channelName={channelName}
              canPush={!faces.pushBlocked && (pushable.length > 0 || campaigns.length > 0)}
              canDiscard={false}
            />
            {faces.pushBlocked ? <p className="text-xs text-muted-foreground">{faces.pushBlocked}</p> : null}
          </>
        )}
      </SectionBody>
    </SectionCard>
  );
}
