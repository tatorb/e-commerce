'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { assignSaleBranchAction } from '@/app/a/[cuenta]/alarmas-stock/actions';

// En la tarea de una venta que no es Flex: elegir de qué sucursal salió cada
// línea. Al guardar baja el stock de esa sucursal y la tarea se cierra.

type Part = { moveId: number; product: string; measure: string | null; units: number };

export function SaleBranchCard({
  accountSlug,
  saleId,
  orderId,
  parts,
  branches,
  canEdit,
}: {
  accountSlug: string;
  saleId: string;
  orderId: string;
  parts: Part[];
  branches: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = (branchId: string) => setChosen(Object.fromEntries(parts.map((p) => [p.moveId, branchId])));
  const ready = parts.every((p) => chosen[p.moveId]);

  return (
    <SectionCard title="De qué sucursal sale" description={`La venta ${orderId} ya se descontó del stock total. Elegí la sucursal de cada línea: baja su stock y la tarea se cierra.`}>
      <SectionBody>
        {parts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ya no queda nada por elegir.</p>
        ) : (
          <>
            {parts.length > 1 && canEdit ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                Todo de:
                {branches.map((b) => (
                  <Button key={b.id} size="sm" variant="outline" disabled={pending} onClick={() => all(b.id)}>
                    {b.name}
                  </Button>
                ))}
              </div>
            ) : null}
            <ul className="divide-y rounded-md border text-sm">
              {parts.map((p) => (
                <li key={p.moveId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {p.units === 1 ? '1 unidad' : `${p.units} unidades`} de <span className="font-medium">{p.product}</span>
                    {p.measure ? ` (${p.measure})` : ''}
                  </span>
                  {canEdit ? (
                    <span className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Sucursal de ${p.product}`}>
                      {branches.map((b) => (
                        <Button
                          key={b.id}
                          size="sm"
                          role="radio"
                          aria-checked={chosen[p.moveId] === b.id}
                          variant={chosen[p.moveId] === b.id ? 'default' : 'outline'}
                          disabled={pending}
                          onClick={() => setChosen((c) => ({ ...c, [p.moveId]: b.id }))}
                        >
                          {b.name}
                        </Button>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  access="productos"
                  pending={pending}
                  disabled={pending || !ready}
                  onClick={() =>
                    start(async () => {
                      setStatus(null);
                      const r = await assignSaleBranchAction(accountSlug, saleId, chosen);
                      setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
                      if (r.ok) router.refresh();
                    })
                  }
                >
                  Guardar
                </Button>
                <StatusText status={status} />
              </div>
            ) : null}
          </>
        )}
      </SectionBody>
    </SectionCard>
  );
}
