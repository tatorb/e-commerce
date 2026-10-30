import { describe, expect, it } from 'vitest';
import { asIsProblem, photoSizeProblem, photoSizeWarning, type ChannelPhotoRules } from '@/domain/media';

// El tamaño que pide el canal para las fotos. Datos inventados.

const rules: ChannelPhotoRules = { types: ['image/jpeg', 'image/png'], typesLabel: 'JPG o PNG', maxBytes: 10 * 1024 * 1024, minSide: 500, recommendedSide: 1200 };

describe('el tamaño de la foto frente al canal', () => {
  it('una chica no sirve, una mediana avisa que no va a tener zoom, una grande pasa', () => {
    expect(photoSizeProblem({ width: 420, height: 380 }, rules, 'Mercado Libre')).toBe(
      'Es chica para Mercado Libre: tiene 420 × 380 px y Mercado Libre pide al menos 500 × 500. La edición no la agranda: hace falta una foto más grande.',
    );
    // Cuenta el lado más chico.
    expect(photoSizeProblem({ width: 1600, height: 450 }, rules, 'Mercado Libre')).toContain('Es chica');
    expect(photoSizeProblem({ width: 800, height: 600 }, rules, 'Mercado Libre')).toBeNull();
    expect(photoSizeWarning({ width: 800, height: 600 }, rules, 'Mercado Libre')).toBe(
      'Tiene 800 × 600 px: Mercado Libre recomienda 1200 × 1200 para que el comprador pueda hacer zoom.',
    );
    expect(photoSizeWarning({ width: 420, height: 380 }, rules, 'Mercado Libre')).toBeNull();
    expect(photoSizeWarning({ width: 4032, height: 3024 }, rules, 'Mercado Libre')).toBeNull();
    expect(photoSizeProblem({ width: 4032, height: 3024 }, rules, 'Mercado Libre')).toBeNull();
  });

  it('sin tamaño, o si el canal no pide uno, no dice nada', () => {
    expect(photoSizeProblem(null, rules, 'Mercado Libre')).toBeNull();
    expect(photoSizeProblem({ width: 10, height: 10 }, { ...rules, minSide: null, recommendedSide: null }, 'Otro')).toBeNull();
    expect(photoSizeWarning({ width: 10, height: 10 }, null, 'Otro')).toBeNull();
  });

  it('la que se usa tal cual también tiene que ser grande', () => {
    expect(asIsProblem({ type: 'image/jpeg', size: 1000, width: 420, height: 380 }, rules, 'Mercado Libre')).toContain('Es chica');
    expect(asIsProblem({ type: 'image/jpeg', size: 1000, width: 1200, height: 1200 }, rules, 'Mercado Libre')).toBeNull();
    // Sin medir todavía, pasa: la mide la Mac.
    expect(asIsProblem({ type: 'image/jpeg', size: 1000 }, rules, 'Mercado Libre')).toBeNull();
  });
});
