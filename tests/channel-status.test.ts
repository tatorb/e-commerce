import { describe, expect, it } from 'vitest';
import { needsReactivation, statusActions, statusConfirm, statusHelp } from '@/domain/channel-status';
import { parseItem } from '@/channels/mercadolibre/listings';

// Los estados de una publicación en el canal y lo que se puede hacer en cada uno.

describe('los estados en el canal', () => {
  it('cada estado tiene sus acciones', () => {
    expect(statusActions('ACTIVE')).toEqual(['pause', 'close']);
    expect(statusActions('PAUSED')).toEqual(['activate', 'close']);
    expect(statusActions('CLOSED')).toEqual(['delete', 'relist']);
    expect(statusActions('INACTIVE')).toEqual(['activate', 'close']);
    expect(statusActions('UNDER_REVIEW')).toEqual([]);
    expect(statusActions('DELETED')).toEqual([]);
    expect(statusActions('UNPUBLISHED')).toEqual([]);
  });

  it('finalizar y eliminar piden confirmación; lo demás no', () => {
    expect(statusConfirm('close', 'Mercado Libre')).toBe(
      'Una publicación finalizada ya no se vende en Mercado Libre y no se puede reactivar, solo republicar con otro código. ¿Finalizar?',
    );
    expect(statusConfirm('delete', 'Mercado Libre', 3)).toBe(
      'Se eliminan 3 publicaciones de Mercado Libre para siempre. En la app quedan archivadas, con su historial. ¿Eliminar?',
    );
    expect(statusConfirm('pause', 'Mercado Libre')).toBeNull();
    expect(statusHelp('PAUSED', 'Mercado Libre')).toContain('Mercado Libre también pausa las que se quedan sin stock');
  });

  it('se leen como los maneja Mercado Libre', () => {
    const status = (raw: Record<string, unknown>) => parseItem({ id: 'MLA1', pictures: [], attributes: [], ...raw }).status;
    expect(status({ status: 'active' })).toBe('ACTIVE');
    expect(status({ status: 'paused', sub_status: ['out_of_stock'] })).toBe('PAUSED');
    expect(status({ status: 'closed' })).toBe('CLOSED');
    expect(status({ status: 'closed', sub_status: ['deleted'] })).toBe('DELETED');
    expect(status({ status: 'under_review' })).toBe('UNDER_REVIEW');
    expect(status({ status: 'payment_required' })).toBe('INACTIVE');
  });
});

describe('reponer stock a una publicación frenada', () => {
  it('pide reactivar solo si estaba pausada o inactiva sin stock y ahora tiene', () => {
    expect(needsReactivation('PAUSED', [{ quantity: 0 }], [{ quantity: 3 }])).toBe(true);
    expect(needsReactivation('INACTIVE', [{ quantity: 0 }, { quantity: 0 }], [{ quantity: 0 }, { quantity: 2 }])).toBe(true);
    // Pausada con stock: la pausó alguien.
    expect(needsReactivation('PAUSED', [{ quantity: 2 }], [{ quantity: 3 }])).toBe(false);
    expect(needsReactivation('ACTIVE', [{ quantity: 0 }], [{ quantity: 3 }])).toBe(false);
    expect(needsReactivation('PAUSED', null, [{ quantity: 3 }])).toBe(false);
    expect(needsReactivation('PAUSED', [{ quantity: 0 }], [{ quantity: 0 }])).toBe(false);
  });
});
