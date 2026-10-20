'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DotBadge, type Cfg } from '@/components/stages/StageBadge';
import { getChannelAdapter } from '@/channels';
import type { ChannelKind } from '@/generated/prisma/enums';
import { FIELD_GROUPS, FIELDS, isConfidentialHeader, type FieldKey } from '@/importers/fields';
import {
  applySavedMapping,
  assignField,
  extractRows,
  findSavedMapping,
  sampleValue,
  suggestMapping,
  type Mapping,
  type RowInput,
  type SavedMapping,
} from '@/importers/mapping';
import { readSpreadsheet, SpreadsheetError, type TableData } from '@/importers/spreadsheet';
import { toRecord, type ImportRecord } from '@/importers/transform';
import { classifyRecords, type Classification, type RowAction } from '@/importers/classify';
import type { PreviewField, RowPreview } from '@/importers/apply';
import { LISTING_FIELD_LABEL } from '@/importers/listing-fields';
import { CONTENT_FIELD_LABEL, type UpdateMode } from '@/domain/content';
import { joinEs } from '@/domain/standard';
import { plural } from '@/lib/format';
import {
  finishImportAction,
  importBatchAction,
  lookupExistingAction,
  previewUpdatesAction,
  saveMappingAction,
  startChannelImportAction,
  startImportAction,
  type RunTotals,
} from '@/app/a/[cuenta]/importar/actions';
import { ChannelSourceCard, type ChannelStoreInfo, type ReadPacing } from './ChannelSourceCard';
import { BrandMark } from '@/components/ui/brand-loader';
import { SubHeader } from '@/components/ui/section-card';

export type StoreInfo = { id: string; name: string; channelKind: ChannelKind; channelName: string };

type Step = 'file' | 'columns' | 'review' | 'running' | 'done';
// De dónde salen las filas: un archivo, o el canal leído con la cuenta conectada.
type Origin = 'file' | 'channel';
type DisplayAction = RowAction | 'update';

const NONE = '__none__';
const BATCH_SIZE = 50;

const ACTION_BADGE: Record<DisplayAction, { label: string; cfg: Cfg }> = {
  new: { label: 'Producto nuevo', cfg: { cls: 'border-primary/40 bg-primary/10 text-primary', dot: 'bg-primary' } },
  link: {
    label: 'Se suma a uno existente',
    cfg: { cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700', dot: 'bg-emerald-500' },
  },
  existing: { label: 'Ya estaba', cfg: { cls: 'border-border bg-muted text-muted-foreground', dot: 'bg-muted-foreground' } },
  update: { label: 'Se completa', cfg: { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700', dot: 'bg-amber-500' } },
  error: { label: 'Error', cfg: { cls: 'border-transparent bg-alert text-alert-foreground', dot: 'bg-[hsl(6_38%_73%)]' } },
};

function StepTitle({ n, title, active }: { n?: number; title: string; active: boolean }) {
  return (
    <CardTitle className={active ? '' : 'text-muted-foreground'}>
      {n ? `${n}. ` : ''}
      {title}
    </CardTitle>
  );
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const FIELD_LABEL: Record<PreviewField, string> = { ...CONTENT_FIELD_LABEL, attributes: LISTING_FIELD_LABEL.attributes };
const fieldNames = (fields: PreviewField[]) => joinEs(fields.map((f) => lowerFirst(FIELD_LABEL[f])));

/** Qué campos cambian en una fila según el modo elegido. */
function changesFor(preview: RowPreview | undefined, mode: UpdateMode): { fill: PreviewField[]; replace: PreviewField[] } {
  if (!preview) return { fill: [], replace: [] };
  return {
    fill: preview.fill,
    replace: mode === 'REPLACE' ? preview.replace.filter((f) => !preview.fill.includes(f)) : [],
  };
}

function ChangeList({ preview, mode }: { preview: RowPreview | undefined; mode: UpdateMode }) {
  const { fill, replace } = changesFor(preview, mode);
  if (fill.length === 0 && replace.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs">
      {fill.length > 0 ? `Completa ${fieldNames(fill)}.` : ''}
      {fill.length > 0 && replace.length > 0 ? ' ' : ''}
      {replace.length > 0 ? `Reemplaza ${fieldNames(replace)}.` : ''}
    </span>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function ImportWizard({
  accountSlug,
  stores,
  channelStores = [],
  readPacing,
  savedMappings,
  defaultDate,
}: {
  accountSlug: string;
  stores: StoreInfo[];
  // Las tiendas conectadas de las que se pueden traer publicaciones.
  channelStores?: ChannelStoreInfo[];
  readPacing?: ReadPacing;
  savedMappings: SavedMapping[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('file');
  const [origin, setOrigin] = useState<Origin>('file');
  const [missing, setMissing] = useState(0);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '');
  const [table, setTable] = useState<TableData | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [dataDate, setDataDate] = useState(defaultDate);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const [mapping, setMapping] = useState<Mapping>({});
  const [appliedMapping, setAppliedMapping] = useState<SavedMapping | null>(null);
  const [mappingName, setMappingName] = useState('');
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [mappingStatus, setMappingStatus] = useState<{ kind: 'idle' | 'saved' } | { kind: 'error'; message: string }>({
    kind: 'idle',
  });

  const [rows, setRows] = useState<RowInput[]>([]);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [previews, setPreviews] = useState<Map<number, RowPreview>>(new Map());
  const [mode, setMode] = useState<UpdateMode>('FILL_EMPTY');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runErrors, setRunErrors] = useState<{ row: number; message: string }[]>([]);
  const [result, setResult] = useState<RunTotals | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const store = stores.find((s) => s.id === storeId);
  const sheet = table?.sheets.find((s) => s.name === sheetName) ?? null;
  const adapter = useMemo(
    () => (store ? getChannelAdapter(store.channelKind, store.channelName) : null),
    [store],
  );
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const usedFields = new Set(Object.values(mapping).filter(Boolean));
  const hasTitle = usedFields.has('pub.title') || usedFields.has('product.name');

  function reset() {
    setStep('file');
    setOrigin('file');
    setMissing(0);
    setTable(null);
    setSheetName('');
    setFileError(null);
    setMapping({});
    setAppliedMapping(null);
    setMappingId(null);
    setMappingStatus({ kind: 'idle' });
    setRecords([]);
    setRows([]);
    setClassification(null);
    setPreviews(new Map());
    setMode('FILL_EMPTY');
    setProgress({ done: 0, total: 0 });
    setRunErrors([]);
    setResult(null);
    setRunError(null);
  }

  async function onFile(file: File | undefined) {
    setFileError(null);
    setTable(null);
    if (!file) return;
    setReading(true);
    try {
      const data = await readSpreadsheet(file.name, await file.arrayBuffer());
      setTable(data);
      // Por defecto, la hoja que más columnas reconoce; si empatan, la de más filas.
      const score = (s: (typeof data.sheets)[number]) =>
        Object.values(suggestMapping(s.headers)).filter(Boolean).length;
      const best = [...data.sheets].sort((a, b) => score(b) - score(a) || b.rows.length - a.rows.length)[0];
      setSheetName(best.name);
    } catch (e) {
      setFileError(e instanceof SpreadsheetError ? e.message : 'No se pudo leer el archivo.');
    } finally {
      setReading(false);
    }
  }

  function goToColumns() {
    if (!sheet || !table) return;
    const saved = findSavedMapping(sheet.headers, savedMappings);
    setAppliedMapping(saved);
    setMapping(saved ? applySavedMapping(sheet.headers, saved) : suggestMapping(sheet.headers));
    setMappingId(saved?.id ?? null);
    setMappingName(saved?.name ?? `${table.fileName.replace(/\.[^.]+$/, '')} · ${sheet.name}`);
    setMappingStatus({ kind: 'idle' });
    setStep('columns');
  }

  function saveMapping() {
    if (!sheet) return;
    setMappingStatus({ kind: 'idle' });
    startTransition(async () => {
      const r = await saveMappingAction(accountSlug, { name: mappingName, headers: sheet.headers, fields: mapping });
      if (r.ok) {
        setMappingId(r.id);
        setMappingStatus({ kind: 'saved' });
      } else {
        setMappingStatus({ kind: 'error', message: r.error });
      }
    });
  }

  function goToReview() {
    if (!sheet || !adapter || !store) return;
    review(extractRows(sheet, mapping), store, 'file');
  }

  function readFromChannel(channelStore: ChannelStoreInfo, read: { rows: RowInput[]; missing: number }) {
    const target = stores.find((s) => s.id === channelStore.id);
    if (!target) return;
    setStoreId(target.id);
    setDataDate(defaultDate);
    setMissing(read.missing);
    review(read.rows, target, 'channel');
  }

  /** Clasifica las filas y pide al servidor qué cambiaría en lo que ya está. */
  function review(extracted: RowInput[], target: StoreInfo, from: Origin) {
    const channelAdapter = getChannelAdapter(target.channelKind, target.channelName);
    setReviewError(null);
    const recs = extracted.map((r) => toRecord(r, channelAdapter));
    startTransition(async () => {
      const lookup = await lookupExistingAction(accountSlug, target.id, {
        externalIds: recs.map((r) => r.publication.externalId).filter((id): id is string => Boolean(id)),
        skus: recs.flatMap((r) => r.skus),
      });
      if (!lookup.ok) {
        setReviewError(lookup.error);
        return;
      }
      const classified = classifyRecords(recs, lookup.existing);

      // Lo que cambiaría en lo que ya está: lo calcula el servidor, por tandas.
      const toPreview = extracted.filter(
        (_, i) => classified.actions[i] === 'existing' || classified.actions[i] === 'link',
      );
      const found = new Map<number, RowPreview>();
      for (let i = 0; i < toPreview.length; i += BATCH_SIZE) {
        try {
          const r = await previewUpdatesAction(accountSlug, target.id, toPreview.slice(i, i + BATCH_SIZE), from === 'channel');
          if (!r.ok) {
            setReviewError(r.error);
            return;
          }
          for (const p of r.previews) found.set(p.rowNumber, p);
        } catch {
          setReviewError('Se cortó la conexión con la app.');
          return;
        }
      }
      // Filas con SKU de productos distintos: no se suman a ninguno, crean una ficha nueva.
      recs.forEach((r, i) => {
        if (classified.actions[i] === 'link' && found.get(r.rowNumber)?.newProduct) {
          classified.actions[i] = 'new';
          classified.summary.linked--;
          classified.summary.newProducts++;
        }
      });

      setRows(extracted);
      setRecords(recs);
      setClassification(classified);
      setPreviews(found);
      setMode('FILL_EMPTY');
      setOrigin(from);
      setStep('review');
    });
  }

  async function runImport() {
    if (!store || (origin === 'file' && (!sheet || !table))) return;
    setStep('running');
    setRunError(null);
    setRunErrors([]);
    setProgress({ done: 0, total: rows.length });

    const start =
      origin === 'channel'
        ? await startChannelImportAction(accountSlug, { storeId: store.id, rowsTotal: rows.length, updateMode: mode })
        : await startImportAction(accountSlug, {
            storeId: store.id,
            fileName: table!.fileName,
            sheetName: sheet!.name,
            dataDate,
            mappingId,
            rowsTotal: rows.length,
            updateMode: mode,
          });
    if (!start.ok) {
      setRunError(start.error);
      setStep('review');
      return;
    }

    let failed: string | null = null;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      try {
        const r = await importBatchAction(accountSlug, start.runId, batch);
        if (!r.ok) {
          failed = r.error;
          break;
        }
        setRunErrors((prev) => [...prev, ...r.errors]);
        setProgress({ done: Math.min(i + batch.length, rows.length), total: rows.length });
      } catch {
        failed = 'Se cortó la conexión con la app.';
        break;
      }
    }

    const finish = await finishImportAction(accountSlug, start.runId, failed !== null);
    if (failed) setRunError(`${failed} La importación quedó a medias: podés deshacerla desde el historial.`);
    if (finish.ok) setResult(finish.run);
    setStep('done');
    router.refresh();
  }

  const fieldOptions = (
    <>
      <SelectItem value={NONE}>No importar</SelectItem>
      {FIELD_GROUPS.map((group) => (
        <SelectGroup key={group}>
          <SelectLabel>{group}</SelectLabel>
          {FIELDS.filter((f) => f.group === group).map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );

  // ───────────────────────────── Desde el canal ─────────────────────────────
  const channelCards =
    step === 'file' && channelStores.length > 0 ? (
      <>
        {channelStores.map((s) => (
          <ChannelSourceCard
            key={s.id}
            accountSlug={accountSlug}
            store={s}
            disabled={pending}
            pacing={readPacing}
            onRead={(read) => readFromChannel(s, read)}
          />
        ))}
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrandMark />
            Revisando qué cambia en lo que ya está en la app…
          </p>
        ) : null}
        {reviewError && !pending ? <p className="text-sm text-destructive">{reviewError}</p> : null}
      </>
    ) : null;

  const channelSummary =
    origin === 'channel' && step !== 'file' ? (
      <Card>
        <CardHeader>
          <StepTitle title={`Traer de ${store?.channelName ?? 'el canal'}`} active={false} />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {store?.name} · {plural(rows.length, 'publicación leída', 'publicaciones leídas')}
            {missing > 0 ? ` · ${plural(missing, 'no se pudo leer', 'no se pudieron leer')}` : ''} · datos del{' '}
            {formatDate(dataDate)}
          </p>
        </CardContent>
      </Card>
    ) : null;

  // ───────────────────────────── 1. Archivo ─────────────────────────────
  const fileCard = origin === 'channel' && step !== 'file' ? null : (
    <Card>
      <CardHeader>
        <StepTitle n={1} title="Archivo" active={step === 'file'} />
        <CardDescription>
          Excel (.xlsx) o CSV. Desde Google Sheets, bajalo con Archivo, Descargar, Microsoft Excel: así se conservan
          los links.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'file' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="imp-store">Tienda</Label>
                {stores.length > 1 ? (
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger id="imp-store">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.channelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p id="imp-store" className="text-sm py-2">
                    {store ? `${store.name} · ${store.channelName}` : 'Esta cuenta no tiene tiendas.'}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imp-date">Fecha de los datos</Label>
                <Input
                  id="imp-date"
                  type="date"
                  value={dataDate}
                  onChange={(e) => setDataDate(e.target.value)}
                  className="max-w-[12rem]"
                />
                <p className="text-xs text-muted-foreground">
                  El día en que se sacaron visitas y ventas. Queda como fecha de la medición.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-file">Archivo</Label>
              <Input
                id="imp-file"
                type="file"
                accept=".xlsx,.xlsm,.csv,.txt"
                onChange={(e) => onFile(e.target.files?.[0])}
                disabled={reading}
                className="max-w-md"
              />
              {reading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BrandMark />
                  Leyendo el archivo…
                </p>
              ) : null}
              {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
            </div>
            {table ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="imp-sheet">Hoja</Label>
                  <Select value={sheetName} onValueChange={setSheetName}>
                    <SelectTrigger id="imp-sheet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {table.sheets.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name} · {plural(s.rows.length, 'fila')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sheet ? (
                    <p className="text-xs text-muted-foreground">
                      {plural(sheet.rows.length, 'fila')} y {plural(sheet.headers.length, 'columna')}.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={goToColumns}
                disabled={!sheet || sheet.rows.length === 0 || !store || !dataDate}
              >
                Siguiente: columnas
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {table?.fileName} · hoja {sheetName} · {store?.name} · datos del {formatDate(dataDate)}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // ───────────────────────────── 2. Columnas ─────────────────────────────
  const columnsCard =
    step === 'file' || origin === 'channel' ? null : (
      <Card>
        <CardHeader>
          <StepTitle n={2} title="Columnas" active={step === 'columns'} />
          <CardDescription>
            A qué campo de la app va cada columna. Solo viajan a la app las columnas con un campo asignado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'columns' && sheet ? (
            <>
              {appliedMapping ? (
                <p className="text-sm">
                  Se aplicó la relación guardada <strong>{appliedMapping.name}</strong>.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {plural(mappedCount, 'columna')} de {sheet.headers.length} se van a importar.
              </p>

              <div className="rounded-md border overflow-hidden">
                <div className="md:hidden divide-y">
                  {sheet.headers.map((header, index) => {
                    const locked = isConfidentialHeader(header);
                    return (
                      <div key={header} className="px-3 py-3 space-y-1.5">
                        <div className="text-sm font-medium">{header}</div>
                        <ColumnSample locked={locked} sample={locked ? null : sampleValue(sheet, index)} />
                        <ColumnSelect
                          header={header}
                          locked={locked}
                          value={mapping[header] ?? null}
                          onChange={(f) => setMapping((m) => assignField(m, header, f))}
                          options={fieldOptions}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="hidden md:block max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Columna del archivo</TableHead>
                        <TableHead>Ejemplo</TableHead>
                        <TableHead className="w-72">Va a</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.headers.map((header, index) => {
                        const locked = isConfidentialHeader(header);
                        return (
                          <TableRow key={header}>
                            <TableCell className="font-medium">{header}</TableCell>
                            <TableCell className="max-w-[16rem]">
                              <ColumnSample locked={locked} sample={locked ? null : sampleValue(sheet, index)} />
                            </TableCell>
                            <TableCell>
                              <ColumnSelect
                                header={header}
                                locked={locked}
                                value={mapping[header] ?? null}
                                onChange={(f) => setMapping((m) => assignField(m, header, f))}
                                options={fieldOptions}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {!hasTitle ? (
                <p className="text-sm text-destructive">Asigná la columna del título o la del nombre del producto.</p>
              ) : null}
              {!usedFields.has('pub.externalId') ? (
                <p className="text-sm text-muted-foreground">
                  Sin columna de ID, cada publicación nueva se crea sin ID y se reconoce solo por el SKU.
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="imp-mapping-name">Guardar esta relación para la próxima vez</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="imp-mapping-name"
                    value={mappingName}
                    onChange={(e) => {
                      setMappingName(e.target.value);
                      setMappingStatus({ kind: 'idle' });
                    }}
                    className="max-w-sm"
                    maxLength={120}
                  />
                  <Button pending={pending} type="button" variant="outline" onClick={saveMapping} disabled={pending || !mappingName.trim()}>
                    {pending ? 'Guardando…' : 'Guardar relación'}
                  </Button>
                  {mappingStatus.kind === 'saved' ? <span className="text-sm text-green-600">Guardada.</span> : null}
                  {mappingStatus.kind === 'error' ? (
                    <span className="text-sm text-destructive">{mappingStatus.message}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setStep('file')} disabled={pending}>
                  Volver
                </Button>
                <Button pending={pending} type="button" onClick={goToReview} disabled={pending || !hasTitle}>
                  {pending ? 'Revisando…' : 'Siguiente: revisión'}
                </Button>
                {reviewError ? <span className="text-sm text-destructive">{reviewError}</span> : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {plural(mappedCount, 'columna')} con campo asignado
              {mappingId ? ` · relación «${mappingName}»` : ''}.
            </p>
          )}
        </CardContent>
      </Card>
    );

  // ───────────────────────────── 3. Revisión e importación ─────────────────────────────
  const notes = records.flatMap((r) => {
    const own = [
      ...(r.error ? [{ row: r.rowNumber, message: r.error, error: true }] : []),
      ...r.warnings.map((w) => ({ row: r.rowNumber, message: w, error: false })),
    ];
    const preview = previews.get(r.rowNumber);
    const fromPreview = [...(preview?.warnings ?? []).map((w) => `Medidas: ${w}`), ...(preview?.notes ?? [])]
      .filter((w) => !r.warnings.includes(w))
      .map((w) => ({ row: r.rowNumber, message: w, error: false }));
    return [...own, ...fromPreview];
  });
  const rowsWithWarnings = new Set(notes.filter((n) => !n.error).map((n) => n.row)).size;
  const importable = classification ? records.length - classification.summary.errors : 0;

  // Cuántas filas y campos cambian en lo que ya estaba, en cada modo.
  const totals = (m: UpdateMode) => {
    let changedRows = 0;
    let fields = 0;
    for (const p of previews.values()) {
      const { fill, replace } = changesFor(p, m);
      if (fill.length + replace.length > 0) {
        changedRows++;
        fields += fill.length + replace.length;
      }
    }
    return { rows: changedRows, fields };
  };
  const fillTotals = totals('FILL_EMPTY');
  const replaceTotals = totals('REPLACE');
  const current = mode === 'REPLACE' ? replaceTotals : fillTotals;

  const actionAt = (i: number): DisplayAction => {
    const action = classification!.actions[i];
    if (action !== 'existing') return action;
    const { fill, replace } = changesFor(previews.get(records[i].rowNumber), mode);
    return fill.length + replace.length > 0 ? 'update' : 'existing';
  };
  const existingUnchanged = classification
    ? records.filter((_, i) => actionAt(i) === 'existing').length
    : 0;

  const reviewCard =
    step === 'review' || step === 'running' || step === 'done' ? (
      <Card>
        <CardHeader>
          <StepTitle n={origin === 'channel' ? undefined : 3} title="Revisión" active={step !== 'done'} />
          <CardDescription>
            {origin === 'channel'
              ? `Lo que va a pasar al importar. Un dato que ${store?.channelName ?? 'el canal'} no informa nunca borra lo que ya está en la app.`
              : 'Lo que va a pasar al importar. Una celda vacía nunca borra lo que ya está en la app.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {classification ? (
            <ul className="space-y-1 text-sm">
              <li>
                <strong className="tabular-nums">{classification.summary.newProducts}</strong>{' '}
                {classification.summary.newProducts === 1 ? 'producto nuevo' : 'productos nuevos'}, cada uno con su
                publicación.
              </li>
              <li>
                <strong className="tabular-nums">{classification.summary.linked}</strong>{' '}
                {classification.summary.linked === 1 ? 'publicación se suma' : 'publicaciones se suman'} a un producto
                que ya existe, por tener el mismo SKU.
              </li>
              {current.rows > 0 ? (
                <li>
                  <strong className="tabular-nums">{current.rows}</strong>{' '}
                  {current.rows === 1 ? 'fila completa' : 'filas completan'} datos de lo que ya estaba,{' '}
                  {plural(current.fields, 'campo')} en total.
                </li>
              ) : null}
              <li>
                <strong className="tabular-nums">{existingUnchanged}</strong>{' '}
                {existingUnchanged === 1 ? 'publicación ya estaba y queda' : 'publicaciones ya estaban y quedan'} igual.
              </li>
              <li>
                <strong className="tabular-nums">{classification.summary.withMetrics}</strong>{' '}
                {classification.summary.withMetrics === 1 ? 'medición' : 'mediciones'} con fecha {formatDate(dataDate)}.
              </li>
              {classification.summary.errors > 0 ? (
                <li className="text-destructive">
                  <strong className="tabular-nums">{classification.summary.errors}</strong>{' '}
                  {classification.summary.errors === 1 ? 'fila con errores no se importa' : 'filas con errores no se importan'}.
                </li>
              ) : null}
              {rowsWithWarnings > 0 ? (
                <li>
                  <strong className="tabular-nums">{rowsWithWarnings}</strong>{' '}
                  {rowsWithWarnings === 1 ? 'fila con avisos' : 'filas con avisos'}.
                </li>
              ) : null}
              {origin === 'channel' && missing > 0 ? (
                <li>
                  <strong className="tabular-nums">{missing}</strong>{' '}
                  {missing === 1 ? 'publicación no se pudo leer' : 'publicaciones no se pudieron leer'} y no se
                  {missing === 1 ? ' importa' : ' importan'}.
                </li>
              ) : null}
            </ul>
          ) : null}

          {origin === 'channel' && step === 'review' ? (
            <p className="text-sm text-muted-foreground">
              En las que ya estaban, el estado, el link y el precio se actualizan siempre con lo que dice{' '}
              {store?.channelName ?? 'el canal'}. La ficha del producto solo se completa: lo que ya tiene no se reemplaza.
            </p>
          ) : null}

          {replaceTotals.fields > 0 && step === 'review' ? (
            <div className="space-y-1.5">
              <Label htmlFor="imp-mode">Lo que ya está en la app</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as UpdateMode)}>
                <SelectTrigger id="imp-mode" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FILL_EMPTY">
                    Solo completar lo vacío · {plural(fillTotals.fields, 'campo')}
                  </SelectItem>
                  <SelectItem value="REPLACE">
                    Completar y reemplazar · {plural(replaceTotals.fields, 'campo')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {mode === 'REPLACE'
                  ? origin === 'channel'
                    ? `Si ${store?.channelName ?? 'el canal'} dice algo distinto en el título, la descripción o los datos de catálogo, gana ${store?.channelName ?? 'el canal'}.`
                    : 'Si el archivo dice algo distinto, gana el archivo. En medidas, ficha técnica, compatibilidades y fotos, la lista del archivo reemplaza la lista entera. Las filas que son otra publicación de un producto que ya está solo completan lo vacío de su ficha.'
                  : 'Solo se cargan los campos que hoy están vacíos. Lo que ya tiene la app no se toca.'}{' '}
                Lo podés deshacer después desde el historial.
              </p>
            </div>
          ) : null}

          {notes.length > 0 && step === 'review' ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-md border">
                <SubHeader title="Avisos y errores" count={notes.length} />
                <ul className="max-h-48 overflow-y-auto divide-y text-sm">
                  {notes.slice(0, 100).map((n, i) => (
                    <li key={i} className="px-3 py-2">
                      <span className="text-muted-foreground tabular-nums">Fila {n.row}: </span>
                      <span className={n.error ? 'text-destructive' : ''}>{n.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {notes.length > 100 ? (
                <p className="text-xs text-muted-foreground">Y {notes.length - 100} más.</p>
              ) : null}
            </div>
          ) : null}

          {classification && step === 'review' ? (
            <div className="space-y-2">
              <div className="rounded-md border overflow-hidden">
                <SubHeader title="Filas" count={records.length} />
                <div className="md:hidden divide-y max-h-[60vh] overflow-y-auto">
                  {records.map((r, i) => (
                    <div key={r.rowNumber} className="px-3 py-3 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm truncate">{r.product?.name ?? '—'}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">Fila {r.rowNumber}</span>
                      </div>
                      <DotBadge {...ACTION_BADGE[actionAt(i)]} />
                      <div className="text-xs text-muted-foreground truncate">
                        {[r.publication.externalId, r.skus.join(' / ')].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {previews.has(r.rowNumber) ? (
                        <div>
                          <ChangeList preview={previews.get(r.rowNumber)} mode={mode} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="hidden md:block max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fila</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Qué pasa</TableHead>
                        <TableHead>Qué cambia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r, i) => (
                        <TableRow key={r.rowNumber}>
                          <TableCell className="tabular-nums text-muted-foreground">{r.rowNumber}</TableCell>
                          <TableCell className="max-w-[18rem]">
                            <div className="font-medium truncate">{r.product?.name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground truncate">{r.skus.join(' / ') || '—'}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.publication.externalId ?? '—'}</TableCell>
                          <TableCell>
                            <DotBadge {...ACTION_BADGE[actionAt(i)]} />
                          </TableCell>
                          <TableCell className="max-w-[18rem]">
                            <ChangeList preview={previews.get(r.rowNumber)} mode={mode} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}

          {step === 'review' ? (
            <div className="flex flex-wrap items-center gap-3">
              {origin === 'channel' ? (
                <Button type="button" variant="outline" onClick={reset}>
                  Volver
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => setStep('columns')}>
                  Volver a columnas
                </Button>
              )}
              <Button type="button" onClick={runImport} disabled={importable === 0}>
                Importar {plural(importable, 'fila')}
              </Button>
              {runError ? <span className="text-sm text-destructive">{runError}</span> : null}
            </div>
          ) : null}

          {step === 'running' ? (
            <p className="text-sm tabular-nums">
              Importando {progress.done} de {progress.total}… No cierres esta pestaña.
            </p>
          ) : null}

          {step === 'done' ? (
            <div className="space-y-3">
              {runError ? <p className="text-sm text-destructive">{runError}</p> : null}
              {result ? (
                <p className="text-sm">
                  {runError ? 'Hasta donde llegó, se crearon' : 'Listo. Se crearon'} <strong>{plural(result.productsCreated, 'producto')}</strong> y{' '}
                  <strong>{plural(result.publicationsCreated, 'publicación', 'publicaciones')}</strong>.{' '}
                  {result.publicationsLinked > 0
                    ? `${plural(result.publicationsLinked, 'publicación se sumó', 'publicaciones se sumaron')} a productos que ya existían. `
                    : ''}
                  {result.publicationsExisting > 0
                    ? `${plural(result.publicationsExisting, 'publicación ya estaba', 'publicaciones ya estaban')}. `
                    : ''}
                  {result.fieldsChanged > 0
                    ? `Se completaron ${plural(result.fieldsChanged, 'campo')} en ${plural(result.publicationsUpdated, 'fila', 'filas')} de lo que ya estaba. `
                    : ''}
                  Se guardaron {plural(result.measurementsSaved, 'medición', 'mediciones')}.
                  {result.rowsWithErrors > 0 ? ` ${plural(result.rowsWithErrors, 'fila', 'filas')} con errores.` : ''}
                </p>
              ) : null}
              {runErrors.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto divide-y rounded-md border text-sm">
                  {runErrors.slice(0, 100).map((e, i) => (
                    <li key={i} className="px-3 py-2">
                      <span className="text-muted-foreground tabular-nums">Fila {e.row}: </span>
                      <span className="text-destructive">{e.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link href={`/a/${accountSlug}/publicaciones`}>Ver publicaciones</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/a/${accountSlug}/productos`}>Ver productos</Link>
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  {origin === 'channel' ? 'Hacer otra importación' : 'Importar otro archivo'}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    ) : null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {channelCards}
      {channelSummary}
      {fileCard}
      {columnsCard}
      {reviewCard}
    </div>
  );
}

function ColumnSample({ locked, sample }: { locked: boolean; sample: string | null }) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Confidencial, no se importa
      </span>
    );
  }
  return <span className="block truncate text-sm text-muted-foreground">{sample ? sample.slice(0, 60) : '—'}</span>;
}

function ColumnSelect({
  header,
  locked,
  value,
  onChange,
  options,
}: {
  header: string;
  locked: boolean;
  value: FieldKey | null;
  onChange: (field: FieldKey | null) => void;
  options: React.ReactNode;
}) {
  return (
    <Select
      value={locked ? NONE : (value ?? NONE)}
      onValueChange={(v) => onChange(v === NONE ? null : (v as FieldKey))}
      disabled={locked}
    >
      <SelectTrigger aria-label={`Campo para ${header}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{options}</SelectContent>
    </Select>
  );
}
