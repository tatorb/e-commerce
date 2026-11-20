'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { StatusText } from '@/components/pipeline/StatusText';
import { saveBranchAction } from '@/app/a/[cuenta]/alarmas-stock/actions';

// Las sucursales de la cuenta, cada una con su depósito: prender o apagar su
// Flex, elegir la principal y sumar una nueva. Con sucursales, el stock del
// producto es la suma del de cada una y Envíos Flex sigue al stock de las
// sucursales con Flex.

type Branch = { id: string; name: string; flex: boolean; main: boolean };

export function BranchesCard({ accountSlug, branches, canEdit }: { accountSlug: string; branches: Branch[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [name, setName] = useState('');
  const [asking, setAsking] = useState<{ branch: Branch; flex: boolean } | null>(null);

  function save(branch: { id?: string; name?: string; flex?: boolean; main?: boolean }, after?: () => void) {
    setStatus(null);
    start(async () => {
      const r = await saveBranchAction(accountSlug, branch);
      setStatus(r.ok ? { kind: 'ok', text: r.message } : { kind: 'error', text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <SectionCard
      title="Sucursales"
      description={
        branches.length === 0
          ? 'Sin sucursales, el stock es uno solo y Flex se cambia a mano en cada publicación. La primera sucursal que se crea se queda con todo el stock cargado.'
          : 'El stock de cada producto es la suma del de cada sucursal. Las ventas Flex salen de una sucursal con Flex y las demás de la principal. Envíos Flex se prende y se apaga solo en cada publicación según haya stock en una sucursal con Flex.'
      }
    >
      <SectionBody>
        {branches.length > 0 ? (
          <ul className="divide-y rounded-md border text-sm">
            {branches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {b.name}
                  {b.flex ? <Badge variant="secondary">Con Flex</Badge> : <Badge variant="outline">Sin Flex</Badge>}
                  {b.main ? <Badge variant="outline">Principal</Badge> : null}
                </span>
                {canEdit ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {asking?.branch.id === b.id ? (
                      <>
                        <span>
                          {asking.flex
                            ? `¿Prender Flex en ${b.name}? Se prende en Mercado Libre en las publicaciones con stock en ${b.name}.`
                            : `¿Apagar Flex en ${b.name}? Se apaga en Mercado Libre en las publicaciones que no tengan stock en otra sucursal con Flex.`}
                        </span>
                        <Button size="sm" access="productos" pending={pending} disabled={pending} onClick={() => save({ id: b.id, flex: asking.flex }, () => setAsking(null))}>
                          Sí
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setAsking(null)}>
                          No
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" access="productos" disabled={pending} onClick={() => setAsking({ branch: b, flex: !b.flex })}>
                          {b.flex ? 'Apagar Flex' : 'Prender Flex'}
                        </Button>
                        {!b.main ? (
                          <Button size="sm" variant="ghost" access="productos" disabled={pending} onClick={() => save({ id: b.id, main: true })}>
                            Hacer principal
                          </Button>
                        ) : null}
                      </>
                    )}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {canEdit ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save({ name: name.trim() }, () => setName(''));
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la sucursal" className="max-w-60" disabled={pending} aria-label="Nombre de la sucursal" />
            <Button type="submit" size="sm" variant="outline" access="productos" pending={pending} disabled={pending || !name.trim()}>
              Sumar sucursal
            </Button>
          </form>
        ) : null}
        <StatusText status={status} />
      </SectionBody>
    </SectionCard>
  );
}
