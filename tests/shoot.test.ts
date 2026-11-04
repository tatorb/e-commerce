import { describe, expect, it } from 'vitest';
import { illustrationType, inProtocolOrder, measureRows, newProductInput, photoPlacement, protocolInput, qualityOf, shotsPerStep, stepInput, videoMarks } from '@/domain/shoot';
import { addInOrder, arrangedMedia, photoKey, protocolUse, type PhotoRef } from '@/domain/media';

// Registro de productos sin la base: la calidad, los pasos hechos y adónde va cada foto.

describe('calidad', () => {
  it('nombra la calidad de los videos y deja subir desde HD, con el teléfono parado o acostado', () => {
    expect(qualityOf('VIDEO', { width: 3840, height: 2160 })).toEqual({ text: '4K, 3840 × 2160', enough: true });
    expect(qualityOf('VIDEO', { width: 2160, height: 3840 })?.text).toBe('4K, 2160 × 3840');
    expect(qualityOf('VIDEO', { width: 1080, height: 1920 })?.text).toBe('Full HD, 1080 × 1920');
    expect(qualityOf('VIDEO', { width: 1280, height: 720 })).toEqual({ text: 'HD, 1280 × 720', enough: true });
    expect(qualityOf('VIDEO', { width: 960, height: 540 })).toEqual({ text: 'Menos que HD, 960 × 540', enough: false });
  });

  it('las fotos van en megapíxeles; si no se pudo medir, no dice nada', () => {
    expect(qualityOf('PHOTO', { width: 4032, height: 3024 })).toEqual({ text: '12 MP, 4032 × 3024', enough: true });
    expect(qualityOf('PHOTO', { width: 1600, height: 1200 })).toEqual({ text: '1,9 MP, 1600 × 1200', enough: true });
    expect(qualityOf('PHOTO', { width: 1200, height: 900 })).toEqual({ text: '1,1 MP, 1200 × 900', enough: false });
    expect(qualityOf('PHOTO', null)).toBeNull();
    expect(qualityOf('PHOTO', { width: 0, height: 10 })).toBeNull();
  });
});

describe('protocolos', () => {
  it('pide nombre y título, y solo foto o video', () => {
    expect(protocolInput.safeParse({ name: '  ' }).success).toBe(false);
    expect(protocolInput.parse({ name: ' Aros ' })).toEqual({ name: 'Aros', description: '' });
    expect(stepInput.safeParse({ title: 'Frente', kind: 'AUDIO' }).success).toBe(false);
    expect(stepInput.parse({ title: 'Limpiar el lugar', kind: 'CHECK' })).toEqual({ title: 'Limpiar el lugar', kind: 'CHECK', explanation: '', editorNotes: '' });
    // Las indicaciones para el editor, sin espacios de más y con un largo máximo.
    expect(stepInput.parse({ title: 'Frente', kind: 'PHOTO', editorNotes: '  Sin brillos.  ' }).editorNotes).toBe('Sin brillos.');
    expect(stepInput.safeParse({ title: 'Frente', kind: 'PHOTO', editorNotes: 'x'.repeat(2001) }).success).toBe(false);
    expect(stepInput.parse({ title: 'Frente', kind: 'VIDEO', explanation: ' Girarlo ' })).toEqual({ title: 'Frente', kind: 'VIDEO', explanation: 'Girarlo', editorNotes: '' });
  });

  it('las ilustraciones son imágenes comunes de hasta 15 MB', () => {
    expect(illustrationType({ name: 'frente.PNG', size: 1000 })).toEqual({ ok: true, type: 'image/png' });
    expect(illustrationType({ name: 'guia.pdf', size: 1000 }).ok).toBe(false);
    expect(illustrationType({ name: 'grande.jpg', size: 16 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe('pasos hechos', () => {
  it('lo de todas las medidas cuenta para cada una; lo de una medida, solo para esa', () => {
    const shots = [
      { stepId: 'frente', variantKey: null },
      { stepId: 'frente', variantKey: 'medida:0.50' },
      { stepId: 'perfil', variantKey: 'medida:std' },
      { stepId: null, variantKey: 'medida:0.50' },
    ];
    expect(shotsPerStep(shots, 'medida:0.50')).toEqual({ frente: 2 });
    expect(shotsPerStep(shots, 'medida:std')).toEqual({ frente: 1, perfil: 1 });
    expect(shotsPerStep(shots, null)).toEqual({ frente: 1 });
  });
});

describe('adónde va cada foto', () => {
  const both = { measures: ['medida:std', 'medida:0.50'], sole: null };

  it('en una publicación con varias medidas, marcada para la suya; sin medida, para todas', () => {
    expect(photoPlacement(both, 'medida:0.50')).toEqual({ add: true, variants: ['medida:0.50'] });
    expect(photoPlacement(both, null)).toEqual({ add: true, variants: [] });
    // Una medida que la publicación no tiene no aparece en las otras.
    expect(photoPlacement(both, 'medida:1.00')).toEqual({ add: false });
  });

  it('en una publicación que vende una sola medida, solo las de esa medida y las de todas', () => {
    const sole = { measures: [], sole: 'medida:0.50' };
    expect(photoPlacement(sole, 'medida:0.50')).toEqual({ add: true, variants: [] });
    expect(photoPlacement(sole, null)).toEqual({ add: true, variants: [] });
    expect(photoPlacement(sole, 'medida:std')).toEqual({ add: false });
  });

  it('sin medidas para marcar, va sin marca', () => {
    expect(photoPlacement({ measures: [], sole: null }, 'medida:std')).toEqual({ add: true, variants: [] });
  });

  it('los videos solo se marcan donde hay varias medidas', () => {
    expect(videoMarks(both, 'medida:std')).toEqual(['medida:std']);
    expect(videoMarks(both, null)).toEqual([]);
    expect(videoMarks({ measures: [], sole: 'medida:std' }, 'medida:std')).toEqual([]);
  });
});

describe('producto nuevo y medidas desde el registro', () => {
  it('el nombre es lo único obligatorio', () => {
    expect(newProductInput.safeParse({ name: ' ' }).success).toBe(false);
    expect(newProductInput.parse({ name: ' Bujía de encendido ' })).toEqual({ name: 'Bujía de encendido', partNumber: '', brand: '', productType: '', measures: [] });
  });

  it('cada medida necesita su nombre y no se repite, ni con las que ya tiene', () => {
    expect(measureRows([{ measure: 'STD', sku: 'BJ-1' }, { measure: '', sku: '' }, { measure: '0.50', sku: '' }])).toEqual({
      ok: true,
      rows: [
        { measure: 'STD', sku: 'BJ-1' },
        { measure: '0.50', sku: '' },
      ],
    });
    expect(measureRows([{ measure: '', sku: 'BJ-1' }])).toEqual({ ok: false, error: 'Cada medida necesita su nombre, por ejemplo STD o 0.50.' });
    expect(measureRows([{ measure: 'std', sku: '' }, { measure: 'STD', sku: '' }])).toEqual({ ok: false, error: 'La medida STD ya está.' });
    expect(measureRows([{ measure: '0.50', sku: 'bj-1' }], [{ measure: 'STD', sku: 'BJ-1' }])).toEqual({ ok: false, error: 'El SKU bj-1 ya está en otra medida.' });
    expect(measureRows([{ measure: 'std', sku: '' }], [{ measure: 'STD', sku: null }]).ok).toBe(false);
  });
});

describe('orden en multimedia', () => {
  const A = 'sku:A medida:std';
  const B = 'sku:A medida:0.50';
  const edit = (editId: string, more: { variants?: string[]; positions?: Record<string, number> } = {}): PhotoRef => ({ kind: 'edit', editId, ...more });

  it('primero las de un paso, por su lugar en multimedia; las demás al final, como estaban', () => {
    const items = [
      { id: 'suelta', place: null },
      { id: 'caja', place: { protocol: 0, step: 1 } },
      { id: 'frente1', place: { protocol: 0, step: 0 } },
      { id: 'otro', place: { protocol: 1, step: 0 } },
      { id: 'frente2', place: { protocol: 0, step: 0 } },
    ];
    expect(inProtocolOrder(items, (i) => i.place).map((i) => i.id)).toEqual(['frente1', 'frente2', 'caja', 'otro', 'suelta']);
  });

  it('cada foto va a su medida, y no va donde no se vende esa medida', () => {
    expect(protocolUse(A, [A, B], [A, B])).toEqual([A]);
    expect(protocolUse(null, [A, B], [A, B])).toEqual([]);
    expect(protocolUse(A, [B], [A, B])).toBeNull();
    expect(protocolUse(B, [B], [A, B])).toEqual([]);
    // Una medida que ya no está en la ficha cuenta como de todas.
    expect(protocolUse('sku:VIEJA', [A, B], [A, B])).toEqual([]);
  });

  it('armadas en orden, cada medida con su lugar', () => {
    expect(arrangedMedia([{ ref: edit('fa'), use: [A] }, { ref: edit('fb'), use: [B] }, { ref: edit('caja'), use: [] }], [A, B])).toEqual([
      edit('fa', { variants: [A], positions: { [A]: 0 } }),
      edit('fb', { variants: [B], positions: { [B]: 0 } }),
      edit('caja', { positions: { [A]: 1, [B]: 1 } }),
    ]);
    expect(arrangedMedia([{ ref: edit('x', { variants: [A] }), use: [] }], [])).toEqual([edit('x')]);
  });

  it('suma la nueva en su lugar sin deshacer lo que se ordenó a mano', () => {
    const places: Record<string, number[]> = { frente: [0, 0, 0], perfil: [0, 1, 0], caja: [0, 2, 0] };
    const placeOf = (r: PhotoRef) => (r.kind === 'edit' ? (places[r.editId] ?? null) : null);
    // A mano, la caja quedó antes que el frente, y una del canal en el medio.
    const current: PhotoRef[] = [edit('caja'), { kind: 'channel', id: 'C1', url: '' }, edit('frente')];
    expect(addInOrder(current, [{ ref: edit('perfil'), place: places.perfil }], placeOf, []).map(photoKey)).toEqual([
      'corregida:caja',
      'canal:C1',
      'corregida:frente',
      'corregida:perfil',
    ]);
    // Sin otras del protocolo, al final.
    expect(addInOrder([{ kind: 'channel', id: 'C1', url: '' }], [{ ref: edit('caja'), place: places.caja }], placeOf, []).map(photoKey)).toEqual([
      'canal:C1',
      'corregida:caja',
    ]);
  });
});
