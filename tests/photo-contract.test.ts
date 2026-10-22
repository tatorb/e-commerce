import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heartbeatSchema, nextRequestSchema, PHOTO_PROTOCOL, resultSchema } from '@/domain/photo-contract';
import { currentRuns, PHOTO_STEPS, photoProgress, photoProgressText } from '@/domain/photo-steps';
import { DEFAULT_PHOTO_SETTINGS, parsePhotoSettings, photoSettingsSchema } from '@/domain/photo-settings';
import { mercadolibreFullSizePhoto } from '@/channels/mercadolibre/photos';
import { channelPhotoUrl } from '@/channels';

// Los ejemplos de trabajador-imagenes/contrato/ los prueban la app y el trabajador.

const example = (name: string) => JSON.parse(readFileSync(new URL(`../trabajador-imagenes/contrato/${name}`, import.meta.url), 'utf8'));

describe('lo que se dicen la app y el trabajador', () => {
  it('la app entiende el resultado y el fallo de ejemplo', () => {
    const done = resultSchema.parse(example('resultado.json'));
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.archivos).toEqual(['antes', 'vista', 'mascara', 'png', 'jpg', 'vivo']);
      expect(done.partes.map((p) => p.paso)).toEqual(PHOTO_STEPS[0].parts);
      expect(done.partes[0].parametros[0].tipo).toBe('si_no');
    }
    const failed = resultSchema.parse(example('fallo.json'));
    expect(failed).toMatchObject({ ok: false, error: 'La Mac se quedó sin memoria procesando la foto.' });
  });

  it('los ejemplos usan la versión del protocolo de la app', () => {
    expect(example('resultado.json').protocolo).toBe(PHOTO_PROTOCOL);
    expect(nextRequestSchema.safeParse({ protocolo: PHOTO_PROTOCOL + 1 }).success).toBe(false);
    expect(heartbeatSchema.safeParse({ protocolo: PHOTO_PROTOCOL, id: 'x', turno: 1 }).success).toBe(true);
    // Un trabajador con el protocolo anterior sigue andando, sin la edición en vivo.
    expect(heartbeatSchema.safeParse({ protocolo: 2, id: 'x', turno: 1 }).success).toBe(true);
    expect(nextRequestSchema.safeParse({ protocolo: 1 }).success).toBe(false);
  });

  it('rechaza archivos desconocidos y valores que no son números', () => {
    const r = example('resultado.json');
    expect(resultSchema.safeParse({ ...r, archivos: ['otro'] }).success).toBe(false);
    // Sin ningún ajuste no es un resultado.
    expect(resultSchema.safeParse({ ...r, partes: [] }).success).toBe(false);
    expect(resultSchema.safeParse({ ...r, partes: [{ ...r.partes[0], valores: { giro: 'mucho' } }] }).success).toBe(false);
  });
});

describe('pasos de una foto', () => {
  const at = (s: number) => new Date(2026, 9, 20, 10, 0, s);
  it('el vigente de cada paso es el último que no se reemplazó', () => {
    const runs = [
      { id: 'z', step: 0, status: 'REPLACED' as const, createdAt: at(0) },
      { id: 'a', step: 0, status: 'REVIEW' as const, createdAt: at(1) },
      { id: 'c', step: 1, status: 'REVIEW' as const, createdAt: at(3) },
    ];
    // Un intento de un paso que ya no existe no cuenta.
    expect(currentRuns(runs).map((r) => r?.id ?? null)).toEqual(['a']);
    expect(photoProgressText(photoProgress([{ step: 0, status: 'REVIEW' }]))).toBe('Esperando tu aprobación');
    expect(photoProgressText(photoProgress([{ step: 0, status: 'QUEUED' }]))).toBe('En cola');
    expect(photoProgressText(photoProgress([{ step: 0, status: 'APPROVED' }]))).toBe('Lista');
    expect(photoProgressText(photoProgress([{ step: 0, status: 'REPLACED' }]))).toBe('Sin empezar');
  });
});

describe('ajustes de imágenes', () => {
  it('lo guardado se lee con los valores por defecto para lo que falta o no vale', () => {
    expect(parsePhotoSettings(null)).toEqual(DEFAULT_PHOTO_SETTINGS);
    const s = parsePhotoSettings({ margen: 40, fondo: '#abcdef', calidad_jpg: 90.4, topes: { giro: 3, luces: -1 } });
    expect([s.margen, s.fondo, s.calidad_jpg, s.topes.giro, s.topes.luces]).toEqual([8, '#ABCDEF', 90, 3, 60]);
    // La sombra viene prendida si no se eligió otra cosa.
    expect([s.con_sombra, s.topes.sombra]).toEqual([true, 40]);
    expect(parsePhotoSettings({ con_sombra: false }).con_sombra).toBe(false);
  });

  it('valida lo que se carga en Ajustes', () => {
    const ok = photoSettingsSchema.safeParse({ ...DEFAULT_PHOTO_SETTINGS, margen: '12', calidad_jpg: '92' });
    expect(ok.success && ok.data.margen).toBe(12);
    expect(photoSettingsSchema.safeParse({ ...DEFAULT_PHOTO_SETTINGS, calidad_jpg: 50 }).success).toBe(false);
    expect(photoSettingsSchema.safeParse({ ...DEFAULT_PHOTO_SETTINGS, margen: 1 }).success).toBe(false);
  });
});

describe('fotos publicadas en Mercado Libre', () => {
  it('pide la foto en su tamaño más grande', () => {
    expect(mercadolibreFullSizePhoto('https://http2.mlstatic.com/D_602711-MLA79386766431_092024-O.jpg')).toBe(
      'https://http2.mlstatic.com/D_602711-MLA79386766431_092024-F.jpg',
    );
    expect(mercadolibreFullSizePhoto('http://http2.mlstatic.com/D_NQ_NP_2X_602711-MLA7_092024-V.webp?x=1')).toBe(
      'https://http2.mlstatic.com/D_602711-MLA7_092024-F.jpg',
    );
    // De Mercado Libre pero con otra forma: se baja tal cual.
    expect(mercadolibreFullSizePhoto('https://http2.mlstatic.com/otra/foto.jpg')).toBe('https://http2.mlstatic.com/otra/foto.jpg');
  });

  it('solo acepta fotos de un canal', () => {
    expect(mercadolibreFullSizePhoto('https://mlstatic.com.otro-sitio.com/D_1-O.jpg')).toBeNull();
    expect(channelPhotoUrl('https://otro-sitio.com/foto.jpg')).toBeNull();
    expect(channelPhotoUrl('no es un link')).toBeNull();
  });
});
