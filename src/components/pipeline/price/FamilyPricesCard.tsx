'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { useReadOnly } from '@/components/access/AccessProvider';
import { setMeasurePriceAction } from '@/app/a/[cuenta]/pipeline/price-actions';
import { formatPrice } from '@/domain/money';
import type { FamilyMember } from '@/lib/families';

// El precio de cada medida de una familia. Por defecto todas llevan el de la
// familia, que se decide arriba; una medida puede tener el suyo, y volver
// después al de la familia. Queda en el borrador para subir, como el de arriba.

function MeasureRow({ accountSlug, member, familyPrice }: { accountSlug: string; member: FamilyMember; familyPrice: number | null }) {
  const router = useRouter();
  const readOnly = useReadOnly('pipeline');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(member.price !== null ? String(member.price).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(own: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await setMeasurePriceAction(accountSlug, member.id, { own, price: value });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-28 shrink-0 font-medium">{member.measure ? `Medida ${member.measure}` : 'Medida sin elegir'}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{member.externalId ?? 'Sin publicar'}</span>
        <span className="ml-auto text-sm tabular-nums">
          {member.ownPrice ? formatPrice(member.price) : familyPrice !== null ? formatPrice(familyPrice) : 'Sin precio'}
        </span>
        <span className="text-xs text-muted-foreground">{member.lead ? 'Principal, precio de la familia' : member.ownPrice ? 'Precio propio' : 'Precio de la familia'}</span>
      </div>
      {!member.lead && !readOnly ? (
        editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Precio de la medida ${member.measure ?? ''}`}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-40"
              placeholder="Por ejemplo 99.627,50"
            />
            <Button size="sm" access="pipeline" onClick={() => save(true)} disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" access="view" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" access="pipeline" onClick={() => setEditing(true)} disabled={pending}>
              {member.ownPrice ? 'Cambiar su precio' : 'Ponerle precio propio'}
            </Button>
            {member.ownPrice ? (
              <Button size="sm" variant="ghost" access="pipeline" onClick={() => save(false)} disabled={pending}>
                Volver al precio de la familia
              </Button>
            ) : null}
          </div>
        )
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  );
}

export function FamilyPricesCard({ accountSlug, members }: { accountSlug: string; members: FamilyMember[] }) {
  const familyPrice = members.find((m) => m.lead)?.price ?? null;
  return (
    <SectionCard
      title="Precio por medida"
      description="Por defecto, todas las medidas llevan el precio de la familia. Si una medida tiene que tener otro, ponele su precio. Las cuotas y el descuento son de la familia."
    >
      <ul className="divide-y text-sm">
        {members.map((m) => (
          <MeasureRow key={m.id} accountSlug={accountSlug} member={m} familyPrice={familyPrice} />
        ))}
      </ul>
      <SectionBody className="py-3">
        <p className="text-xs text-muted-foreground">El precio de cada medida queda en Por subir, para subirlo a su publicación.</p>
      </SectionBody>
    </SectionCard>
  );
}
