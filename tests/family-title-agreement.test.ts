import { describe, expect, it } from 'vitest';
import { familyTitleAgreement, fieldState } from '@/domain/channel-sync';

// Lo acordado del título al pasar a comparar con el nombre de la familia del
// canal. Las huellas son textos de prueba.

const state = (args: Parameters<typeof familyTitleAgreement>[0]) => fieldState(args.app, args.channel, familyTitleAgreement(args));

describe('título de una familia del canal: lo que quedó de la comparación vieja', () => {
  it('si el nombre de la familia es el título de la app, no hay nada que elegir', () => {
    expect(state({ app: 'A', channel: 'A', agreed: 'viejo', approved: null, shown: 'A 0.50' })).toBe('same');
  });

  it('si el canal tiene el título aprobado, la app lo toma sin preguntar', () => {
    expect(state({ app: 'B', channel: 'aprobado', agreed: 'viejo', approved: 'aprobado', shown: 'aprobado 0.50' })).toBe('incoming');
  });

  it('si la app tiene el título aprobado y el canal otro, queda para subir el aprobado', () => {
    expect(state({ app: 'aprobado', channel: 'C', agreed: 'viejo', approved: 'aprobado', shown: 'C 0.50' })).toBe('draft');
    // Aunque la comparación vieja lo hubiera hecho tomar del canal.
    expect(state({ app: 'aprobado', channel: 'C', agreed: 'aprobado', approved: 'aprobado', shown: 'C 0.50' })).toBe('draft');
  });

  it('sin aprobado: si lo acordado era el título con la medida, lo de la app queda para subir', () => {
    expect(state({ app: 'B', channel: 'C', agreed: 'C 0.50', approved: null, shown: 'C 0.50' })).toBe('draft');
  });

  it('sin aprobado y sin pista, sigue para elegir; lo que no estaba marcado no cambia', () => {
    expect(state({ app: 'B', channel: 'C', agreed: 'viejo', approved: null, shown: 'C 0.50' })).toBe('choose');
    expect(state({ app: 'B', channel: 'C', agreed: 'C', approved: 'aprobado', shown: 'C 0.50' })).toBe('draft');
    expect(state({ app: 'B', channel: 'C', agreed: 'B', approved: 'otro', shown: 'C 0.50' })).toBe('incoming');
  });
});
