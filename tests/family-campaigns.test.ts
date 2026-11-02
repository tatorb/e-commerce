import { describe, expect, it } from 'vitest';
import type { ChannelCampaign } from '@/channels/publish-types';
import { familyCampaigns, membersText, planFamilyAction, splitText } from '@/domain/family-campaigns';
import { formatPrice } from '@/domain/money';

// La misma campaña en cada medida de una familia: cada una con su invitación,
// su código para sumarse y su rango de precio.

const campaign = (over: Partial<ChannelCampaign> = {}): ChannelCampaign => ({
  ref: '["DEAL","P-CYBER",null]',
  group: 'DEAL:P-CYBER',
  name: 'Cyber Monday',
  kind: 'Campaña tradicional',
  status: 'invited',
  price: null,
  channelPct: null,
  sellerPct: null,
  start: null,
  finish: null,
  join: 'price',
  range: { minPrice: 50, maxPrice: 90, suggestedPrice: 85 },
  canLeave: false,
  pausesOwnDiscount: true,
  listPrice: 100,
  ...over,
});

const opts = { channelName: 'Mercado Libre' };

describe('campañas en una familia', () => {
  it('junta la misma campaña de todas las medidas, con una fila por medida aunque no la inviten', () => {
    const groups = familyCampaigns([
      { publicationId: 'std', label: 'STD', campaigns: [campaign({ status: 'active', ref: 'std-ref' }), campaign({ group: 'SMART:P-S', name: 'Compartida', join: 'accept', range: null })] },
      { publicationId: 'p50', label: '0,50', campaigns: [campaign({ ref: 'p50-ref' })] },
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Cyber Monday', 'Compartida']);
    const [cyber, smart] = groups;
    expect(cyber.members.map((m) => [m.label, m.campaign?.ref])).toEqual([
      ['STD', 'std-ref'],
      ['0,50', 'p50-ref'],
    ]);
    expect(cyber.split).toBe(true);
    expect(membersText(cyber)).toBe('STD: adentro · 0,50: la invitan');
    expect(splitText(cyber)).toBe('Cyber Monday: STD adentro, 0,50 la invitan');
    // A la 0,50 no la invitan a la Compartida: igual tiene su fila, y la familia no está partida, porque ninguna está adentro.
    expect(smart.members.map((m) => m.campaign)).toEqual([expect.anything(), null]);
    expect(smart.split).toBe(false);
    expect(membersText(smart)).toBe('STD: la invitan · 0,50: no la invitan');
  });

  it('con las dos medidas adentro, o una programada, no está partida', () => {
    const [both] = familyCampaigns([
      { publicationId: 'std', label: 'STD', campaigns: [campaign({ status: 'active' })] },
      { publicationId: 'p50', label: '0,50', campaigns: [campaign({ status: 'scheduled' })] },
    ]);
    expect(both.split).toBe(false);
    expect(membersText(both)).toBe('STD: adentro · 0,50: programada');
  });

  it('las campañas con alguna medida adentro van primero', () => {
    const groups = familyCampaigns([{ publicationId: 'a', label: 'A', campaigns: [campaign({ group: 'g1', name: 'Invitada' }), campaign({ group: 'g2', name: 'Adentro', status: 'active' })] }]);
    expect(groups.map((g) => g.name)).toEqual(['Adentro', 'Invitada']);
  });

  it('sin código de grupo, reconoce la campaña por su tipo y nombre', () => {
    const groups = familyCampaigns([
      { publicationId: 'a', label: 'A', campaigns: [campaign({ group: null })] },
      { publicationId: 'b', label: 'B', campaigns: [campaign({ group: null })] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('Campaña tradicional|Cyber Monday');
  });

  it('sumarse con un precio: cada medida con su código y su rango; la que no entra dice por qué', () => {
    const [g] = familyCampaigns([
      { publicationId: 'std', label: 'STD', campaigns: [campaign({ ref: 'std-ref' })] },
      { publicationId: 'p50', label: '0,50', campaigns: [campaign({ ref: 'p50-ref', range: { minPrice: 50, maxPrice: 80, suggestedPrice: 75 } })] },
    ]);
    const plan = planFamilyAction(g, { ...opts, action: 'join', price: 85.4, samePrice: ['std', 'p50'] });
    expect(plan).toEqual([
      { publicationId: 'std', label: 'STD', outcome: 'do', ref: 'std-ref', price: 85, message: null },
      { publicationId: 'p50', label: '0,50', outcome: 'skip', ref: null, price: null, message: `Medida 0,50: Es más alto de lo que acepta el canal. Acepta de ${formatPrice(50)} a ${formatPrice(80)}.` },
    ]);
  });

  it('sumarse con un precio: la medida de otro precio se suma desde su pestaña', () => {
    const [g] = familyCampaigns([
      { publicationId: 'std', label: 'STD', campaigns: [campaign({ ref: 'std-ref' })] },
      { publicationId: 'p50', label: '0,50', campaigns: [campaign({ ref: 'p50-ref' })] },
    ]);
    const plan = planFamilyAction(g, { ...opts, action: 'join', price: 85, samePrice: ['std'] });
    expect(plan.map((p) => [p.label, p.outcome, p.message])).toEqual([
      ['STD', 'do', null],
      ['0,50', 'elsewhere', 'La medida 0,50 tiene otro precio: sumala desde la pestaña de su precio.'],
    ]);
  });

  it('sumarse aceptando: van todas las medidas, aunque tengan otro precio; la que ya está o no invitan lo dice', () => {
    const accept = (over: Partial<ChannelCampaign>) => campaign({ group: 'SMART:P-S', name: 'Compartida', join: 'accept', range: null, ...over });
    const [g] = familyCampaigns([
      { publicationId: 'a', label: 'STD', campaigns: [accept({ ref: 'a-ref' })] },
      { publicationId: 'b', label: '0,25', campaigns: [accept({ ref: 'b-ref', status: 'active' })] },
      { publicationId: 'c', label: '0,50', campaigns: [] },
      { publicationId: 'd', label: '0,75', campaigns: [accept({ ref: null, join: null })] },
      { publicationId: 'e', label: '1,00', campaigns: [accept({ ref: 'e-ref' })] },
    ]);
    const plan = planFamilyAction(g, { ...opts, action: 'join', price: null, samePrice: ['a'] });
    expect(plan.map((p) => [p.label, p.outcome, p.ref, p.message])).toEqual([
      ['STD', 'do', 'a-ref', null],
      ['0,25', 'already', null, 'La medida 0,25 ya está en Compartida.'],
      ['0,50', 'skip', null, 'A la medida 0,50 no la invitan a Compartida.'],
      ['0,75', 'skip', null, 'La medida 0,75 se suma a Compartida solo desde Mercado Libre.'],
      ['1,00', 'do', 'e-ref', null],
    ]);
  });

  it('salir: de todas las medidas que están adentro', () => {
    const [g] = familyCampaigns([
      { publicationId: 'a', label: 'STD', campaigns: [campaign({ ref: 'a-ref', status: 'active', canLeave: true })] },
      { publicationId: 'b', label: '0,50', campaigns: [campaign({ ref: 'b-ref', status: 'scheduled', canLeave: true })] },
      { publicationId: 'c', label: '1,00', campaigns: [campaign({ ref: 'c-ref' })] },
      { publicationId: 'd', label: '1,50', campaigns: [campaign({ ref: 'd-ref', status: 'active', canLeave: false })] },
    ]);
    const plan = planFamilyAction(g, { ...opts, action: 'leave', price: null, samePrice: ['a'] });
    expect(plan.map((p) => [p.label, p.outcome, p.ref, p.message])).toEqual([
      ['STD', 'do', 'a-ref', null],
      ['0,50', 'do', 'b-ref', null],
      ['1,00', 'already', null, 'La medida 1,00 no está en Cyber Monday.'],
      ['1,50', 'skip', null, 'La medida 1,50 sale de Cyber Monday solo desde Mercado Libre.'],
    ]);
  });

  it('sin familia, los motivos hablan de la publicación', () => {
    const [g] = familyCampaigns([{ publicationId: 'a', label: 'MLA1', campaigns: [campaign({ ref: 'a-ref' })] }]);
    expect(g.split).toBe(false);
    expect(planFamilyAction(g, { ...opts, action: 'join', price: 95, samePrice: ['a'] })[0].message).toBe(`Es más alto de lo que acepta el canal. Acepta de ${formatPrice(50)} a ${formatPrice(90)}.`);
    expect(planFamilyAction(g, { ...opts, action: 'leave', price: null, samePrice: ['a'] })[0].message).toBe('La publicación no está en Cyber Monday.');
  });
});
