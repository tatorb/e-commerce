import { describe, expect, it } from 'vitest';
import { FAMILY_MAX_AGE_MS, familyDetails, familyRead, needsFamilyRead } from '@/domain/families';

// Las familias del canal tal como se leyeron, guardadas en la cara del canal.
// Los datos son de prueba.

describe('la familia leída del canal', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const family = { familyId: '77', channelProductIds: ['UP1', 'UP2'], listingIds: ['MLA1', 'MLA2'] };

  it('se guarda lo recién leído, y si esta vez no se leyó queda lo que estaba', () => {
    const fresh = familyDetails(family, null, now);
    expect(fresh).toEqual({ channelFamilyId: '77', familyProductIds: ['UP1', 'UP2'], familyListingIds: ['MLA1', 'MLA2'], familyReadAt: now.toISOString() });
    expect(familyDetails(undefined, { skus: ['X'], ...fresh }, new Date('2026-11-12T00:00:00Z'))).toEqual(fresh);
    // Sin familia en el canal: queda leída, sin código.
    expect(familyDetails(null, fresh, now)).toEqual({ channelFamilyId: null, familyProductIds: [], familyListingIds: [], familyReadAt: now.toISOString() });
    // Nunca se leyó: no se inventa nada.
    expect(familyDetails(undefined, { skus: ['X'] }, now)).toEqual({});
  });

  it('se lee si el canal dice de qué producto es y nunca se leyó, o hace más de una semana', () => {
    const details = familyDetails(family, null, now);
    expect(familyRead(details)).toEqual({ channelFamilyId: '77', productIds: ['UP1', 'UP2'], listingIds: ['MLA1', 'MLA2'], readAt: now.toISOString() });
    expect(familyRead({ skus: [] })).toBeNull();
    expect(needsFamilyRead(null, 'UP1', now)).toBe(true);
    expect(needsFamilyRead(details, null, now)).toBe(false);
    expect(needsFamilyRead(details, 'UP1', new Date(now.getTime() + FAMILY_MAX_AGE_MS - 1))).toBe(false);
    expect(needsFamilyRead(details, 'UP1', new Date(now.getTime() + FAMILY_MAX_AGE_MS + 1))).toBe(true);
  });
});
