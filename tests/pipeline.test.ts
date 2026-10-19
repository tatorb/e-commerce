import { describe, expect, it } from 'vitest';
import { getChannelAdapter } from '@/channels';
import {
  entryStep,
  findDuplicates,
  nextStep,
  normalizeTitle,
  pipelineLabel,
  PIPELINE_STEPS,
  PIPELINE_STEP_SLUG,
  previousStep,
  stepFromSlug,
} from '@/domain/pipeline';
import { resolveTitleLock } from '@/domain/title-lock';

describe('pasos del pipeline', () => {
  it('van en orden, sin anterior al primero ni siguiente al último', () => {
    expect(nextStep('INFO')).toBe('TITLE');
    expect(nextStep('DESCRIPTION')).toBe('PUBLISH');
    expect(nextStep('PUBLISH')).toBeNull();
    expect(previousStep('TITLE')).toBe('INFO');
    expect(previousStep('INFO')).toBeNull();
  });

  it('cada paso tiene su nombre en la dirección, de ida y vuelta', () => {
    for (const step of PIPELINE_STEPS) expect(stepFromSlug(PIPELINE_STEP_SLUG[step])).toBe(step);
    expect(stepFromSlug('informacion')).toBe('INFO');
    expect(stepFromSlug(' Titulo ')).toBe('TITLE');
    expect(stepFromSlug(['multimedia', 'titulo'])).toBe('MEDIA');
    expect(stepFromSlug('otro')).toBeNull();
    expect(stepFromSlug(undefined)).toBeNull();
  });

  it('una descartada retoma en su paso; el resto empieza en Información', () => {
    expect(entryStep({ pipelineStatus: 'DISCARDED', pipelineStep: 'IMAGES', pipelineRemoval: 'LATER' })).toBe('IMAGES');
    expect(entryStep({ pipelineStatus: 'CORRECTED', pipelineStep: null, pipelineRemoval: null })).toBe('INFO');
    expect(entryStep({ pipelineStatus: 'UNTOUCHED', pipelineStep: null, pipelineRemoval: null })).toBe('INFO');
  });

  it('la etiqueta dice el paso o el motivo', () => {
    expect(pipelineLabel({ pipelineStatus: 'IN_PIPELINE', pipelineStep: 'TITLE', pipelineRemoval: null })).toBe(
      'En pipeline · Título',
    );
    expect(pipelineLabel({ pipelineStatus: 'DISCARDED', pipelineStep: 'TITLE', pipelineRemoval: 'NOT_WORTH' })).toBe(
      'Descartada · no vale la pena',
    );
    expect(pipelineLabel({ pipelineStatus: 'UNTOUCHED', pipelineStep: null, pipelineRemoval: null })).toBe('Sin tocar');
  });
});

describe('duplicadas', () => {
  it('compara títulos sin mayúsculas, tildes ni signos', () => {
    expect(normalizeTitle('  Kit de Distribución, Fiat 1.4! ')).toBe('kit de distribucion fiat 1 4');
    expect(normalizeTitle(null)).toBe('');
  });

  it('avisa si es del mismo producto o tiene el mismo título que una que ya está', () => {
    const inPipeline = [{ id: 'a', productId: 'p1', title: 'Kit Embrague Gol' }];
    const dups = findDuplicates(
      [
        { id: 'b', productId: 'p1', title: 'Otro título' },
        { id: 'c', productId: 'p2', title: 'kit embrague GOL' },
        { id: 'd', productId: 'p3', title: 'Pistones Corsa' },
      ],
      inPipeline,
    );
    expect(dups.map((d) => [d.id, d.other.id, d.reason, d.other.inPipeline])).toEqual([
      ['b', 'a', 'product', true],
      ['c', 'a', 'title', true],
    ]);
  });

  it('también entre las que se agregan juntas', () => {
    const dups = findDuplicates(
      [
        { id: 'x', productId: 'p1', title: 'Uno' },
        { id: 'y', productId: 'p1', title: 'Dos' },
      ],
      [],
    );
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ id: 'y', other: { id: 'x', inPipeline: false }, reason: 'product' });
  });

  it('un título vacío no cuenta como igual', () => {
    expect(findDuplicates([{ id: 'b', productId: 'p2', title: '' }], [{ id: 'a', productId: 'p1', title: '' }])).toEqual([]);
  });
});

describe('título bloqueado', () => {
  const ml = getChannelAdapter('MERCADOLIBRE');

  it('Mercado Libre: bloqueado si tiene vendidos o ventas en 90 días', () => {
    expect(ml.titleLock({ sold_visible: 3 })).toBe(true);
    expect(ml.titleLock({ sold_visible: 0, sales_90d: 2 })).toBe(true);
    expect(ml.titleLock({ sales_90d: 1 })).toBe(true);
    expect(ml.titleLock({ sold_visible: 0, sales_90d: 0 })).toBe(false);
    expect(ml.titleLock({ sold_visible: 0 })).toBe(false);
  });

  it('Mercado Libre: sin vendidos visibles, cero ventas en 90 días no alcanza para saber', () => {
    expect(ml.titleLock({ sales_90d: 0 })).toBeNull();
    expect(ml.titleLock({})).toBeNull();
  });

  it('un canal sin regla propia no sabe', () => {
    expect(getChannelAdapter('WEB_STORE', 'Tienda web').titleLock({ sold_visible: 5 })).toBeNull();
  });

  it('los datos ganan; la marca a mano vale cuando no hay datos', () => {
    expect(resolveTitleLock(true, false)).toEqual({ locked: true, source: 'data' });
    expect(resolveTitleLock(null, true)).toEqual({ locked: true, source: 'manual' });
    expect(resolveTitleLock(null, null)).toEqual({ locked: null, source: null });
  });
});
