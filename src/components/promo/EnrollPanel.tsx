'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from '@/components/ui/section-card';
import { formatPrice } from '@/domain/money';
import { quote, type PriceBy } from '@/domain/promo/quote';
import type { ProductGrid } from '@/lib/promo/view';
import { cn } from '@/lib/utils/cn';
import { enrollAction, type EnrollForm } from '@/app/a/[cuenta]/promociones/actions';
import { inputDay, lastDay, pct, shortDate } from './format';

// Inscribir a mano las publicaciones elegidas a una promoción: primero cuál,
// después desde qué fecha hasta qué fecha, y por último el precio de cada
// una, que se carga como rentabilidad, como precio o como % de descuento: al
// mover uno se actualizan los otros dos. Debajo del piso avisa y deja seguir.
// Lo que el canal no va a aceptar se ve antes de guardar. Al guardar no se
// manda nada: queda en el almanaque y la app lo ejecuta en su fecha.

const SELECT = 'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-sm';
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const BY_LABEL: Record<PriceBy, string> = { MARGIN: 'Rentabilidad', PRICE: 'Precio', PCT: '% de descuento' };

type RowState = { by: PriceBy; text: string; stock: string };
type Overlap = { publicationId: string; externalId: string | null; name: string; start: Date; finish: Date; canCut: boolean };

export function EnrollPanel({ accountSlug, timeZone, grid, publicationIds, onClose, onDone }: { accountSlug: string; timeZone: string; grid: ProductGrid; publicationIds: string[]; onClose: () => void; onDone: (text: string) => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  // Qué promoción: el descuento propio, una campaña del canal ("c:grupo") o una reserva para un evento ("e:id").
  const [target, setTarget] = useState('own');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [all, setAll] = useState<{ by: PriceBy; text: string }>({ by: 'MARGIN', text: String(grid.thresholds.healthyMarginPct) });
  const [error, setError] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<Overlap[] | null>(null);

  const options = useMemo(() => grid.measures.flatMap((m) => m.options.map((o) => ({ ...o, measure: m.measure }))).filter((o) => publicationIds.includes(o.publicationId)), [grid, publicationIds]);
  const campaign = target.startsWith('c:') ? (grid.enroll.campaigns.find((c) => c.group === target.slice(2)) ?? null) : null;
  const event = target.startsWith('e:') ? (grid.enroll.events.find((e) => e.id === target.slice(2)) ?? null) : null;
  const kind: EnrollForm['kind'] = campaign ? 'CAMPAIGN' : event ? 'RESERVE' : 'OWN_DISCOUNT';
  const floor = grid.thresholds.floorMarginPct;
  const today = inputDay(grid.now, timeZone);

  // Cada fila: lo que se cargó, los otros dos números que salen de eso, y si el canal la va a aceptar.
  const view = options.map((o) => {
    const calc = grid.enroll.calc[o.publicationId];
    const invite = campaign?.invites[o.publicationId] ?? null;
    const listPrice = invite?.listPrice ?? calc?.listPrice ?? null;
    const state = rows[o.publicationId] ?? { by: all.by, text: all.text, stock: '' };
    let problem: string | null = null;
    if (!calc || listPrice === null) problem = 'No tiene precio de lista en el canal.';
    else if (campaign && !invite) problem = 'El canal no la invita a esta campaña.';
    else if (invite && invite.status !== 'invited') problem = 'Ya está en esta campaña.';
    else if (invite && !invite.fixedPrice && invite.join === null) problem = 'Solo se suma desde el canal.';
    // El precio lo pone el canal: no hay nada que elegir.
    const fixed = invite?.fixedPrice ? (invite.price ?? (listPrice !== null ? Math.round(listPrice * (1 - ((invite.sellerPct ?? 0) + (invite.channelPct ?? 0)) / 100)) : null)) : null;
    const q = !calc || problem ? { price: null, pct: null, marginPct: null } : fixed !== null ? quote(calc, 'PRICE', fixed, invite?.channelPct ?? null, listPrice) : quote(calc, state.by, num(state.text), invite?.channelPct ?? null, listPrice);
    if (!problem && q.price === null) problem = state.by === 'MARGIN' && calc?.cost === null ? 'Sin costo cargado: cargá el precio o el %.' : 'Revisá el valor.';
    if (!problem && q.price !== null && listPrice !== null) {
      if (q.price >= listPrice) problem = 'Tiene que quedar más barato que el precio de lista.';
      else if (kind === 'OWN_DISCOUNT' && (q.pct ?? 0) < 5) problem = 'El canal no acepta un descuento propio de menos de 5 %.';
      else if (kind === 'OWN_DISCOUNT' && (q.pct ?? 0) >= 80) problem = 'El canal no acepta un descuento propio de 80 % o más.';
      else if (invite && !invite.fixedPrice && invite.maxPrice !== null && q.price > invite.maxPrice) problem = `El canal pide ${formatPrice(invite.maxPrice)} o menos.`;
      else if (invite && !invite.fixedPrice && invite.minPrice !== null && q.price < invite.minPrice) problem = `El canal no acepta menos de ${formatPrice(invite.minPrice)}.`;
    }
    const warning = !problem && q.marginPct !== null && q.marginPct < floor ? `Deja menos que el piso de ${pct(floor)}.` : !problem && q.marginPct === null ? 'Sin costo: no se sabe cuánto deja.' : null;
    const money = q.marginPct !== null && calc?.cost ? formatPrice(Math.round((calc.cost * q.marginPct) / 100)) : null;
    return { o, calc, invite, listPrice, state, fixed, q, problem, warning, money, lightning: campaign?.type === 'LIGHTNING' };
  });
  const good = view.filter((v) => !v.problem);

  // Al escribir en uno de los tres, ese pasa a ser el que manda y los otros dos se calculan.
  const edit = (id: string, by: PriceBy, text: string) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { stock: '' }), by, text } }));
  const shown = (v: (typeof view)[number], by: PriceBy) => {
    if (v.fixed === null && v.state.by === by) return v.state.text;
    const n = by === 'MARGIN' ? v.q.marginPct : by === 'PRICE' ? v.q.price : v.q.pct;
    return n === null ? '' : String(n).replace('.', ',');
  };

  const pickTarget = (value: string) => {
    setTarget(value);
    setOverlaps(null);
    setError(null);
    const c = value.startsWith('c:') ? grid.enroll.campaigns.find((x) => x.group === value.slice(2)) : null;
    const e = value.startsWith('e:') ? grid.enroll.events.find((x) => x.id === value.slice(2)) : null;
    // Las fechas de una campaña o de un evento vienen cargadas: son las del canal.
    setFrom(c?.start ? inputDay(new Date(Math.max(new Date(c.start).getTime(), new Date(grid.now).getTime())), timeZone) : e ? inputDay(e.start, timeZone) : '');
    setTo(c?.finish ? inputDay(new Date(new Date(c.finish).getTime() - 1), timeZone) : e ? inputDay(new Date(new Date(e.finish).getTime() - 1), timeZone) : '');
  };

  const save = (overlap?: 'keep' | 'cut') =>
    start(async () => {
      setError(null);
      const form: EnrollForm = {
        kind,
        group: campaign?.group ?? null,
        eventId: event?.id ?? null,
        start: from || undefined,
        finish: to || undefined,
        rows: good.map((v) => ({ publicationId: v.o.publicationId, by: v.fixed !== null ? 'PRICE' : v.state.by, value: v.fixed !== null ? v.fixed : num(v.state.text), stock: v.lightning && v.state.stock ? Number(v.state.stock) : null })),
        overlap,
      };
      const r = await enrollAction(accountSlug, grid.productId, form).catch(() => null);
      if (!r || !r.ok) return setError(r ? r.error : 'Se cortó la conexión con la app.');
      if (!r.saved) return setOverlaps(r.overlaps);
      router.refresh();
      onDone(
        `Quedaron ${r.enrolled} ${r.enrolled === 1 ? 'publicación' : 'publicaciones'} en el almanaque. La app las ${kind === 'RESERVE' ? 'inscribe cuando llegue la invitación del canal' : 'prende sola en su fecha'}.${r.cut > 0 ? ` Se cortaron ${r.cut} promociones anteriores.` : ''}${r.skipped.length > 0 ? ` No entraron: ${r.skipped.join(' ')}` : ''}`,
      );
    });

  return (
    <SectionCard
      title={`Inscribir ${options.length} ${options.length === 1 ? 'publicación' : 'publicaciones'} a una promoción`}
      icon={<CalendarPlus />}
      description="Queda en el almanaque y la app lo ejecuta sola en su fecha. Al guardar no se manda nada al canal."
      action={
        <Button size="sm" variant="ghost" access="view" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="grid gap-4 p-4 text-sm lg:grid-cols-3">
        <label className="space-y-1">
          <span className="block font-medium">1. A qué promoción</span>
          <select className={cn(SELECT, 'w-full')} value={target} onChange={(e) => pickTarget(e.target.value)}>
            <option value="own">Descuento propio</option>
            {grid.enroll.campaigns.length > 0 ? (
              <optgroup label={`Campañas de ${grid.channelName}`}>
                {grid.enroll.campaigns.map((c) => {
                  const invited = options.filter((o) => c.invites[o.publicationId]?.status === 'invited').length;
                  return (
                    <option key={c.group} value={`c:${c.group}`}>
                      {c.name}, {shortDate(c.start, timeZone)} a {lastDay(c.finish, timeZone)}: invita a {invited} de {options.length}
                    </option>
                  );
                })}
              </optgroup>
            ) : null}
            {grid.enroll.events.length > 0 ? (
              <optgroup label="Reserva para un evento del calendario">
                {grid.enroll.events.map((e) => (
                  <option key={e.id} value={`e:${e.id}`}>
                    {e.name}, {shortDate(e.start, timeZone)} a {lastDay(e.finish, timeZone)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <span className="block text-xs text-muted-foreground">
            {campaign
              ? `${campaign.kindLabel}. Las fechas las pone el canal: se puede entrar más tarde o salir antes.`
              : event
                ? 'Todavía no hay invitación del canal. Cuando llegue, la app inscribe las publicaciones invitadas con el precio que cargues acá.'
                : 'Las fechas las elegís vos. Sin fecha de fin, sigue hasta que la saques.'}
          </span>
        </label>
        <div className="space-y-1">
          <span className="block font-medium">2. Desde y hasta</span>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-40" type="date" aria-label="Desde" value={from} min={today} disabled={!!event} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted-foreground">a</span>
            <Input className="w-40" type="date" aria-label="Hasta" value={to} min={from || today} disabled={!!event} onChange={(e) => setTo(e.target.value)} />
          </div>
          <span className="block text-xs text-muted-foreground">
            {event ? 'Son las fechas del evento.' : `Sin desde, ${campaign ? 'cuando empieza la campaña' : 'hoy'}. Sin hasta, ${campaign ? 'cuando termina la campaña' : 'sin fin'}. El último día va entero.`}
          </span>
        </div>
        <div className="space-y-1">
          <span className="block font-medium">3. El precio, para todas</span>
          <div className="flex flex-wrap items-center gap-2">
            <select className={SELECT} value={all.by} onChange={(e) => setAll({ ...all, by: e.target.value as PriceBy })}>
              <option value="MARGIN">Rentabilidad, en %</option>
              <option value="PCT">Descuento, en %</option>
              <option value="PRICE">Precio</option>
            </select>
            <Input className="w-24" inputMode="decimal" aria-label="Valor para todas" value={all.text} onChange={(e) => setAll({ ...all, text: e.target.value })} />
            <Button size="sm" variant="outline" access="view" onClick={() => setRows({})}>
              Poner en todas
            </Button>
            {campaign && options.some((o) => campaign.invites[o.publicationId]?.maxPrice != null && !campaign.invites[o.publicationId]?.fixedPrice) ? (
              <Button
                size="sm"
                variant="outline"
                access="view"
                title="Pone en cada una el precio más alto que acepta el canal en esta campaña: es el que más deja."
                onClick={() =>
                  setRows(
                    Object.fromEntries(
                      options.flatMap((o) => {
                        const max = campaign.invites[o.publicationId]?.maxPrice;
                        return max != null && !campaign.invites[o.publicationId]?.fixedPrice ? [[o.publicationId, { by: 'PRICE' as const, text: String(Math.floor(max)), stock: '' }]] : [];
                      }),
                    ),
                  )
                }
              >
                Al tope del canal
              </Button>
            ) : null}
          </div>
          <span className="block text-xs text-muted-foreground">Después se puede cambiar el de cada una abajo. Al mover uno de los tres números, los otros dos se actualizan.</span>
        </div>
      </div>

      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Publicación</th>
              <th className="px-2 py-2 font-medium">Precio de lista</th>
              {(['MARGIN', 'PRICE', 'PCT'] as const).map((by) => (
                <th key={by} className="px-2 py-2 font-medium">
                  {BY_LABEL[by]}
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Deja</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {view.map((v) => (
              <tr key={v.o.publicationId} className={cn(v.problem && 'text-muted-foreground')}>
                <td className="px-4 py-2">
                  <span className="block font-medium">
                    {v.o.planLabel}
                    {v.o.measure ? `, ${v.o.measure}` : ''}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{v.o.externalId ?? 'Sin publicar'}</span>
                </td>
                <td className="px-2 py-2 tabular-nums">{v.listPrice !== null ? formatPrice(v.listPrice) : '—'}</td>
                {(['MARGIN', 'PRICE', 'PCT'] as const).map((by) => (
                  <td key={by} className="px-2 py-2">
                    <Input
                      className={cn('w-28 tabular-nums', v.fixed === null && v.state.by === by && 'border-foreground/50')}
                      inputMode="decimal"
                      aria-label={`${BY_LABEL[by]} de ${v.o.externalId ?? v.o.planLabel}`}
                      disabled={!!v.problem && v.q.price === null ? !!(v.invite === null && campaign) : v.fixed !== null}
                      value={shown(v, by)}
                      onChange={(e) => edit(v.o.publicationId, by, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-2 py-2 tabular-nums">{v.money ?? '—'}</td>
                <td className="px-4 py-2 text-xs">
                  {v.problem ? <span className="text-destructive">{v.problem}</span> : v.warning ? <span className="font-medium">{v.warning}</span> : v.fixed !== null ? 'El precio lo pone el canal.' : ''}
                  {v.lightning && !v.problem ? (
                    <label className="mt-1 flex items-center gap-1">
                      Reserva
                      <Input
                        className="h-7 w-16"
                        inputMode="numeric"
                        placeholder={String(v.invite?.stockMin ?? 1)}
                        value={v.state.stock}
                        onChange={(e) => setRows((r) => ({ ...r, [v.o.publicationId]: { ...(r[v.o.publicationId] ?? { by: all.by, text: all.text }), stock: e.target.value } }))}
                      />
                      unidades
                    </label>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overlaps ? (
        <div className="border-t p-4 text-sm">
          <p className="font-medium">Se pisa con otras promociones de las mismas publicaciones</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {overlaps.slice(0, 12).map((o, i) => (
              <li key={i}>
                {o.externalId}: {o.name}, {shortDate(o.start, timeZone)} a {new Date(o.finish).getFullYear() >= 2099 ? 'sin fin' : lastDay(o.finish, timeZone)}
                {o.canCut ? '' : ', no se puede cortar'}
              </li>
            ))}
            {overlaps.length > 12 ? <li>y {overlaps.length - 12} más</li> : null}
          </ul>
          <p className="mt-2 text-muted-foreground">
            Cuál se le muestra al comprador lo decide {grid.channelName}: el descuento más grande, y una campaña tradicional frena el descuento propio mientras dura. Lo que podés elegir es si conviven
            o si la anterior se corta cuando empieza esta.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" access="promociones" disabled={busy} onClick={() => save('keep')}>
              Que convivan
            </Button>
            {overlaps.some((o) => o.canCut) ? (
              <Button size="sm" variant="outline" access="promociones" disabled={busy} onClick={() => save('cut')}>
                Cortar la anterior cuando empieza esta
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" access="view" disabled={busy} onClick={() => setOverlaps(null)}>
              Volver
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {good.length} de {view.length} se pueden inscribir{good.some((v) => v.warning) ? ', algunas debajo del piso' : ''}.
          </span>
          {error ? <span className="text-destructive">{error}</span> : null}
          <Button className="ml-auto" size="sm" access="promociones" disabled={busy || good.length === 0} pending={busy} onClick={() => save()}>
            Guardar en el almanaque
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
