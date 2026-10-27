import Link from 'next/link';
import { ExternalLink, Layers } from 'lucide-react';
import { ChannelStatusBadge } from '@/components/stages/StageBadge';
import type { FamilyMember } from '@/lib/families';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils/cn';

// Las medidas de una familia, en una línea: cada una con su código, que lleva
// a su publicación en la app, su link al canal y su estado si no está activa.

export function FamilyMembersRow({
  members,
  accountSlug,
  channelName,
  currentId,
  linkToApp = true,
}: {
  members: FamilyMember[];
  accountSlug: string;
  channelName: string;
  // La que se está mirando, que no lleva link a sí misma.
  currentId?: string;
  linkToApp?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      <span className="inline-flex items-center gap-1 font-medium">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        Familia de {plural(members.length, 'medida', 'medidas')}:
      </span>
      {members.map((m) => (
        <span
          key={m.id}
          className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5', m.id === currentId && 'border-primary/40 bg-primary/5')}
        >
          <span className={m.measure ? 'font-medium' : 'text-amber-700 dark:text-amber-400'}>{m.measure ?? 'Medida sin elegir'}</span>
          {linkToApp && m.id !== currentId ? (
            <Link href={`/a/${accountSlug}/publicaciones/${m.id}`} className="text-xs tabular-nums text-muted-foreground underline-offset-4 hover:underline">
              {m.externalId ?? 'Sin publicar'}
            </Link>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground">{m.externalId ?? 'Sin publicar'}</span>
          )}
          {m.url ? (
            <a href={m.url} target="_blank" rel="noreferrer" aria-label={`Ver la medida ${m.measure ?? ''} en ${channelName}`} className="text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {m.channelStatus !== 'ACTIVE' ? <ChannelStatusBadge status={m.channelStatus} /> : null}
        </span>
      ))}
    </div>
  );
}
