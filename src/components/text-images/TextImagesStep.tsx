'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDown, ArrowUp, Download, GripVertical, ImageIcon, Plus, Sparkles, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { completeTextImageAction, generateTextImageAction, removeTextImageAction, saveTextImageAction } from '@/app/a/[cuenta]/pipeline/text-image-actions';
import { DEFAULT_DOUBTS_TITLE, MAX_ITEMS_A, pieceVersion, TEXT_LIMITS, type PieceContent, type PieceDoubt, type PieceItem } from '@/domain/text-images';
import { formatDateTime } from '@/lib/format';
import type { PieceFit } from '@/lib/text-images/piece-html';
import type { TextImageStep } from '@/lib/text-images/step';
import { cn } from '@/lib/utils/cn';
import { PiecePreview } from './PiecePreview';

// El paso Imágenes con texto: a la izquierda la pieza en vivo, a la derecha
// lo que dice. Completar con IA llena todo desde el paso Información; Generar
// PNG la arma en el servidor, igual a la vista previa, y queda para elegir en
// Organización de multimedia.

type Msg = { ok: boolean; text: string } | null;

export function TextImagesStep({
  accountSlug,
  data,
  timeZone,
  aiDisabledReason,
  photosHref,
  infoHref,
  stepHref,
}: {
  accountSlug: string;
  data: TextImageStep;
  timeZone: string;
  aiDisabledReason: string | null;
  photosHref: string;
  infoHref: string;
  // El paso, para ir a otra imagen con &imagen=n.
  stepHref: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState<PieceContent>(data.content);
  const [photoEditId, setPhotoEditId] = useState<string | null>(data.photoEditId);
  const [place, setPlace] = useState(data.mediaPlace ? String(data.mediaPlace) : '');
  const [loaded, setLoaded] = useState(data);
  const [fit, setFit] = useState<PieceFit | null>(null);
  const [busy, setBusy] = useState<'save' | 'ai' | 'png' | 'remove' | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  // Después de guardar llega lo guardado: la pantalla arranca de ahí.
  if (loaded !== data) {
    setLoaded(data);
    setContent(data.content);
    setPhotoEditId(data.photoEditId);
    setPlace(data.mediaPlace ? String(data.mediaPlace) : '');
  }

  const placeValue = place.trim() === '' ? null : Number(place);
  const placeBad = placeValue !== null && !(Number.isInteger(placeValue) && placeValue >= 1 && placeValue <= 30);
  const dirty = JSON.stringify(content) !== JSON.stringify(data.content) || photoEditId !== data.photoEditId || placeValue !== data.mediaPlace;
  const saved = data.pieces.some((p) => p.slot === data.slot);
  const nextSlot = [...Array(data.maxPieces)].map((_, i) => i + 1).find((n) => !data.pieces.some((p) => p.slot === n) && n !== data.slot) ?? null;
  const photo = data.photos.find((p) => p.editId === photoEditId) ?? null;
  const brandMap = Object.fromEntries(data.brands.map((b) => [b.key, { nombre: b.name, logo: b.logo }]));
  const version = pieceVersion(content);
  const filled = Boolean(content.TIPO_PRODUCTO || content.MOTOR || content.compatible.length || content.no_compatible.length || content.dudas.length);
  const missingNow = [
    ...(!photo ? ['Elegí la foto del producto.'] : []),
    ...(!content.TIPO_PRODUCTO ? ['Falta el tipo de producto.'] : []),
    ...(!content.MOTOR ? ['Falta el motor.'] : []),
    ...(content.compatible.length === 0 ? ['Falta al menos un ítem en Compatible con.'] : []),
  ];
  const tooBig = fit !== null && !fit.fits;

  async function run(kind: 'save' | 'ai' | 'png' | 'remove', action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setBusy(kind);
    setMsg(null);
    const r = await action().catch(() => ({ ok: false as const, error: 'Se cortó la conexión con la app. Probá de nuevo.' }));
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
    return r.ok;
  }

  const save = () =>
    placeBad
      ? Promise.resolve((setMsg({ ok: false, text: 'El lugar va del 1 al 30, o vacío para no fijarlo.' }), false))
      : run('save', () => saveTextImageAction(accountSlug, data.publication.id, { slot: data.slot, content, photoEditId, mediaPlace: placeValue }));

  async function generate() {
    // Lo que está en la pantalla es lo que va: si hay cambios, primero se guardan.
    if (dirty && !(await save())) return;
    await run('png', () => generateTextImageAction(accountSlug, data.publication.id, data.slot));
  }

  function complete() {
    if (filled && !window.confirm('Ya hay contenido cargado. ¿Reemplazarlo por lo que proponga Claude? La foto queda como está.')) return;
    run('ai', () => completeTextImageAction(accountSlug, data.publication.id, filled, data.slot));
  }

  async function remove() {
    if (!window.confirm(`¿Sacar la imagen con texto ${data.slot}? Se saca también de Organización de multimedia.`)) return;
    if (await run('remove', () => removeTextImageAction(accountSlug, data.publication.id, data.slot))) router.push(`${stepHref}&imagen=1`);
  }

  const set = (patch: Partial<PieceContent>) => setContent((c) => ({ ...c, ...patch }));
  const notes = [
    ...data.unknownBrands.map((k) => `La marca ${k} ya no está en la base de marcas.`),
    ...(data.withoutLogo.length > 0 ? [`Sin logo todavía: ${data.withoutLogo.join(', ')}. Va su nombre en chico hasta que se suba el logo en Marcas de vehículos.`] : []),
    ...(photo && !photo.transparent ? ['La foto elegida tiene fondo: la pieza necesita un PNG sin fondo. Elegí una corregida en el paso Fotos.'] : []),
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <PiecePreview paint={{ content, photoUrl: photo?.href ?? null, brands: brandMap, preview: true }} onFit={setFit} />
        <FitLine fit={fit} version={version} />
        {data.png ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span>PNG generado el {formatDateTime(new Date(data.png.at), timeZone)}</span>
            {data.png.outdated || dirty ? <Badge variant="outline" className="border-alert text-alert">Desactualizado</Badge> : <Badge variant="outline">Al día</Badge>}
            <a href={data.png.href} target="_blank" rel="noreferrer" className="ml-auto text-xs underline">
              Ver
            </a>
            <a href={`${data.png.href}&descargar=1`} className="inline-flex items-center gap-1 text-xs underline">
              <Download className="h-3 w-3" aria-hidden />
              Bajar
            </a>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {/* Las imágenes con texto de la publicación: cada una con su número y su lugar en multimedia. */}
        <nav aria-label="Imágenes con texto" className="flex flex-wrap items-center gap-2">
          {[...data.pieces.map((p) => p.slot), ...(saved ? [] : [data.slot])]
            .sort((a, b) => a - b)
            .map((n) => {
              const piece = data.pieces.find((p) => p.slot === n);
              const on = n === data.slot;
              return (
                <Link
                  key={n}
                  href={`${stepHref}&imagen=${n}`}
                  aria-current={on ? 'page' : undefined}
                  className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  Imagen {n}
                  {piece?.mediaPlace ? <span className="opacity-80"> · lugar {piece.mediaPlace}</span> : null}
                  {piece && !piece.generated ? <span className="opacity-80"> · sin PNG</span> : null}
                </Link>
              );
            })}
          {nextSlot && saved ? (
            <Link href={`${stepHref}&imagen=${nextSlot}`} className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm hover:bg-muted">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Otra imagen
            </Link>
          ) : null}
        </nav>

        <SectionCard
          title={`Imagen con texto ${data.slot}`}
          icon={<Type />}
          description={
            data.sharedBy > 1
              ? `Es de la familia: se guarda una sola vez para las ${data.sharedBy} medidas, y el PNG queda para todas.`
              : 'Le da seguridad al comprador: con qué es compatible, con qué no y lo que tiene que saber. Todo sale del paso Información.'
          }
        >
          <SectionBody>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="lugar-multimedia">Lugar en Organización de multimedia</Label>
                <Input
                  id="lugar-multimedia"
                  inputMode="numeric"
                  value={place}
                  placeholder="Sin lugar fijo"
                  onChange={(e) => setPlace(e.target.value)}
                  className="w-36 tabular-nums"
                />
              </div>
              <p className="max-w-sm pb-1 text-xs text-muted-foreground">
                Le gana al orden del protocolo: por ejemplo, en el lugar 2 va segunda y las fotos del protocolo llenan los demás lugares. Vacío, se elige a mano.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={complete}
                disabled={busy !== null || aiDisabledReason !== null}
                pending={busy === 'ai'}
                title={aiDisabledReason ?? undefined}
              >
                <Sparkles />
                Completar con IA
              </Button>
              <Button size="sm" variant="outline" onClick={save} disabled={busy !== null || !dirty} pending={busy === 'save'}>
                Guardar
              </Button>
              <Button size="sm" onClick={generate} disabled={busy !== null || missingNow.length > 0 || tooBig} pending={busy === 'png'}>
                <ImageIcon />
                Generar PNG
              </Button>
              {saved ? (
                <Button size="sm" variant="ghost" onClick={remove} disabled={busy !== null} pending={busy === 'remove'}>
                  <Trash2 />
                  Sacar esta imagen
                </Button>
              ) : null}
              {dirty ? <span className="text-xs text-muted-foreground">Hay cambios sin guardar.</span> : null}
            </div>
            {busy === 'ai' ? <p className="text-xs text-muted-foreground">Claude está leyendo el paso Información. Tarda alrededor de un minuto.</p> : null}
            {msg ? (
              <p role="status" className={cn('text-sm', msg.ok ? 'text-emerald-700' : 'text-destructive')}>
                {msg.text}
              </p>
            ) : null}
            <Warnings items={[...(tooBig ? ['No entra todo ni achicando los ítems al 55 %. Juntá ítems de la misma marca y el mismo motor, o acortá los textos.'] : []), ...missingNow, ...notes]} />
            <p className="text-xs text-muted-foreground">
              ¿Falta algún dato? Se carga en el{' '}
              <Link href={infoHref} className="underline">
                paso Información
              </Link>
              .
            </p>
          </SectionBody>
        </SectionCard>

        <SectionCard title="Foto del producto" icon={<ImageIcon />} description="Va arriba a la derecha. Tiene que ser un PNG sin fondo: las corregidas en el paso Fotos lo tienen.">
          <SectionBody>
            {data.photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay fotos listas. Se corrigen en el{' '}
                <Link href={photosHref} className="underline">
                  paso Fotos
                </Link>
                .
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {data.photos.map((p) => {
                  const on = p.editId === photoEditId;
                  return (
                    <li key={p.editId}>
                      <button
                        type="button"
                        onClick={() => setPhotoEditId(on ? null : p.editId)}
                        aria-pressed={on}
                        className={cn('w-full space-y-1 rounded-md border p-1 text-left', on ? 'border-primary ring-2 ring-primary' : 'hover:bg-muted')}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.href} alt={p.label} loading="lazy" className="aspect-square w-full rounded bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] object-contain" />
                        <span className="block truncate text-[11px]">{p.label}</span>
                        <span className={cn('block text-[11px]', p.transparent ? 'text-muted-foreground' : 'text-alert')}>{p.transparent ? 'Sin fondo' : 'Con fondo'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionBody>
        </SectionCard>

        <SectionCard title="Encabezado" icon={<Type />}>
          <SectionBody>
            <TextField id="ti-tipo" label="Tipo de producto" value={content.TIPO_PRODUCTO} limit={TEXT_LIMITS.type} onChange={(v) => set({ TIPO_PRODUCTO: v })} hint="Por ejemplo, Subconjunto para motor" />
            <TextField id="ti-motor" label="Motor" value={content.MOTOR} limit={TEXT_LIMITS.engine} onChange={(v) => set({ MOTOR: v })} hint="Como lo busca el comprador" />
            <TextField id="ti-sello" label="Sello" value={content.SELLO} limit={12} onChange={(v) => set({ SELLO: v })} />
          </SectionBody>
        </SectionCard>

        <SectionCard
          title="Compatible con"
          count={content.compatible.length}
          description={`Con más de ${MAX_ITEMS_A} ítems en alguna columna, la pieza pasa a la versión B: sin el bloque de dudas.`}
        >
          <SectionBody>
            <ItemsEditor items={content.compatible} brands={data.brands} onChange={(compatible) => set({ compatible })} label="compatible" />
          </SectionBody>
        </SectionCard>

        <SectionCard title="No compatible con" count={content.no_compatible.length} description="Las confusiones reales: el mismo modelo con otro motor, turbo contra aspirado, otros años.">
          <SectionBody>
            <ItemsEditor items={content.no_compatible} brands={data.brands} onChange={(no_compatible) => set({ no_compatible })} label="no compatible" />
          </SectionBody>
        </SectionCard>

        <SectionCard
          title="Lo que tiene que saber"
          count={content.dudas.length}
          description={
            version === 'B'
              ? 'En la versión B no se muestran, pero quedan guardadas por si juntás ítems y pasa a la A.'
              : 'Van de la más a la menos importante: si no entran las 4, quedan las 2 primeras.'
          }
        >
          <SectionBody>
            <TextField id="ti-dudas" label="Título del bloque" value={content.TITULO_DUDAS} limit={30} onChange={(v) => set({ TITULO_DUDAS: v })} hint={DEFAULT_DOUBTS_TITLE} />
            <DoubtsEditor doubts={content.dudas} onChange={(dudas) => set({ dudas })} />
          </SectionBody>
        </SectionCard>
      </div>
    </div>
  );
}

function FitLine({ fit, version }: { fit: PieceFit | null; version: 'A' | 'B' }) {
  if (!fit) return <p className="text-xs text-muted-foreground">Versión {version}.</p>;
  const parts = [`Versión ${fit.version}`, fit.version === 'A' ? `${fit.doubts} ${fit.doubts === 1 ? 'duda' : 'dudas'}` : 'sin bloque de dudas', fit.scale < 1 ? `ítems al ${Math.round(fit.scale * 100)} %` : null];
  return (
    <p className={cn('text-xs', fit.fits ? 'text-muted-foreground' : 'text-destructive')}>
      {parts.filter(Boolean).join(' · ')}
      {fit.fits ? '' : ' · no entra'}
    </p>
  );
}

function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-md bg-alert/10 px-3 py-2 text-sm">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

function TextField({ id, label, value, limit, onChange, hint }: { id: string; label: string; value: string; limit: number; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Count value={value} limit={limit} />
      </div>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} maxLength={160} />
    </div>
  );
}

function Count({ value, limit }: { value: string; limit: number }) {
  return <span className={cn('text-[11px] tabular-nums', value.length > limit ? 'text-alert' : 'text-muted-foreground')}>{`${value.length}/${limit}`}</span>;
}

/** Los ítems de una columna: tipo, marca, título y detalle. Se ordenan arrastrando o con las flechas. */
function ItemsEditor({
  items,
  brands,
  onChange,
  label,
}: {
  items: PieceItem[];
  brands: TextImageStep['brands'];
  onChange: (items: PieceItem[]) => void;
  label: string;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const update = (i: number, patch: Partial<PieceItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay ítems.</p> : null}
      <ol className="space-y-2">
        {items.map((x, i) => (
          <li
            key={i}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
              setDragging(i);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              if (over !== i) setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null);
              setOver(null);
            }}
            className={cn('space-y-2 rounded-md border p-2', dragging === i && 'opacity-40', over === i && dragging !== i && 'ring-2 ring-primary')}
            aria-label={`Ítem ${i + 1} de ${label}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" aria-hidden />
              <select
                value={x.tipo}
                onChange={(e) => update(i, e.target.value === 'motor' ? { tipo: 'motor', marca: null } : { tipo: 'vehiculo' })}
                aria-label={`Tipo del ítem ${i + 1}`}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="vehiculo">Vehículo</option>
                <option value="motor">Motor</option>
              </select>
              {x.tipo === 'vehiculo' ? (
                <select
                  value={x.marca ?? ''}
                  onChange={(e) => update(i, { marca: e.target.value || null })}
                  aria-label={`Marca del ítem ${i + 1}`}
                  className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Elegí la marca</option>
                  {brands.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.name}
                      {b.logo ? '' : ' (sin logo)'}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-xs text-muted-foreground">Va el ícono de motor</span>
              )}
              <span className="ml-auto flex items-center">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Borrar el ítem ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-0.5">
                <Input value={x.titulo} onChange={(e) => update(i, { titulo: e.target.value })} placeholder="Título, por ejemplo Uno · Duna · Fiorino" aria-label={`Título del ítem ${i + 1}`} maxLength={120} />
                <Count value={x.titulo} limit={TEXT_LIMITS.itemTitle} />
              </div>
              <div className="space-y-0.5">
                <Input value={x.detalle} onChange={(e) => update(i, { detalle: e.target.value })} placeholder="Detalle, por ejemplo 1.7 diésel aspirado" aria-label={`Detalle del ítem ${i + 1}`} maxLength={200} />
                <Count value={x.detalle} limit={TEXT_LIMITS.itemDetail} />
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { tipo: 'vehiculo', marca: null, titulo: '', detalle: '' }])}>
        <Plus />
        Agregar ítem
      </Button>
    </div>
  );
}

function DoubtsEditor({ doubts, onChange }: { doubts: PieceDoubt[]; onChange: (d: PieceDoubt[]) => void }) {
  const update = (i: number, patch: Partial<PieceDoubt>) => onChange(doubts.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= doubts.length) return;
    const next = [...doubts];
    const [d] = next.splice(from, 1);
    next.splice(to, 0, d);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {doubts.map((d, i) => (
          <li key={i} className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <Input value={d.titulo} onChange={(e) => update(i, { titulo: e.target.value })} placeholder="La duda, como la diría el comprador" aria-label={`Duda ${i + 1}`} maxLength={120} />
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Bajar" disabled={i === doubts.length - 1} onClick={() => move(i, i + 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Borrar la duda ${i + 1}`} onClick={() => onChange(doubts.filter((_, k) => k !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <Input value={d.respuesta} onChange={(e) => update(i, { respuesta: e.target.value })} placeholder="La respuesta, una certeza concreta" aria-label={`Respuesta ${i + 1}`} maxLength={300} />
              <Count value={d.respuesta} limit={TEXT_LIMITS.doubtAnswer} />
            </div>
          </li>
        ))}
      </ol>
      {doubts.length < 4 ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...doubts, { titulo: '', respuesta: '' }])}>
          <Plus />
          Agregar duda
        </Button>
      ) : null}
    </div>
  );
}
