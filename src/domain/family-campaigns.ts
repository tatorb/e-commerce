import type { ChannelCampaign } from '@/channels/publish-types';
import { formatPrice } from './money';
import { campaignPrice, campaignPriceProblem } from './promotions';

// Las campañas de una familia: la misma campaña del canal en cada una de sus
// medidas, que en el canal son publicaciones aparte, cada una con su invitación
// y su rango de precio. Sumarse o salir se pide para todas las medidas juntas,
// y la que no puede entrar lo dice. Si las medidas quedan en estados
// distintos, la familia está partida. Sin la base de datos, para poder
// probarlo solo.

/** Lo que el canal informa de una medida: su publicación, cómo se llama la medida y sus campañas. */
export type MeasureCampaigns = { publicationId: string; label: string; campaigns: ChannelCampaign[] };

/** Cómo está una medida en la campaña. null: no la invitan. */
export type MemberState = 'active' | 'scheduled' | 'invited' | null;

export type FamilyCampaignMember = { publicationId: string; label: string; campaign: ChannelCampaign | null };

export type FamilyCampaign = {
  key: string;
  name: string;
  kind: string;
  members: FamilyCampaignMember[];
  // Unas medidas adentro y otras no.
  split: boolean;
};

/** Cómo se reconoce la misma campaña en las demás medidas. */
export const campaignKey = (c: Pick<ChannelCampaign, 'group' | 'kind' | 'name'>) => c.group ?? `${c.kind}|${c.name ?? ''}`;

/** Si la medida está en la campaña: adentro o anotada para cuando empiece. */
export const isIn = (c: ChannelCampaign | null) => c?.status === 'active' || c?.status === 'scheduled';

export const MEMBER_STATE_TEXT: Record<'active' | 'scheduled' | 'invited' | 'none', string> = {
  active: 'adentro',
  scheduled: 'programada',
  invited: 'la invitan',
  none: 'no la invitan',
};

export const memberStateText = (c: ChannelCampaign | null) => MEMBER_STATE_TEXT[c?.status ?? 'none'];

/**
 * Junta la misma campaña de todas las medidas, en el orden en que aparecen
 * (primero las que tienen alguna medida adentro). Cada campaña lleva una fila
 * por medida, aunque a esa medida no la inviten.
 */
export function familyCampaigns(measures: MeasureCampaigns[]): FamilyCampaign[] {
  const out = new Map<string, FamilyCampaign>();
  for (const m of measures) {
    for (const c of m.campaigns) {
      const key = campaignKey(c);
      let g = out.get(key);
      if (!g) {
        g = { key, name: c.name ?? c.kind, kind: c.kind, members: measures.map((x) => ({ publicationId: x.publicationId, label: x.label, campaign: null })), split: false };
        out.set(key, g);
      }
      const member = g.members.find((x) => x.publicationId === m.publicationId)!;
      member.campaign ??= c;
    }
  }
  const groups = [...out.values()].map((g) => ({ ...g, split: g.members.length > 1 && new Set(g.members.map((x) => isIn(x.campaign))).size > 1 }));
  const rank = (g: FamilyCampaign) => (g.members.some((x) => x.campaign?.status === 'active') ? 0 : g.members.some((x) => isIn(x.campaign)) ? 1 : 2);
  return groups.sort((a, b) => rank(a) - rank(b));
}

/** "STD: adentro · 0,50: la invitan". */
export function membersText(g: Pick<FamilyCampaign, 'members'>): string {
  return g.members.map((m) => `${m.label}: ${memberStateText(m.campaign)}`).join(' · ');
}

/** El aviso de una familia partida: "MKP T1 CYBER MONDAY NOV: STD adentro, 0,50 la invitan". */
export function splitText(g: FamilyCampaign): string {
  return `${g.name}: ${g.members.map((m) => `${m.label} ${memberStateText(m.campaign)}`).join(', ')}`;
}

/** Qué pasa con cada medida al sumarse o salir. do: se pide; already: ya estaba; skip: no puede; elsewhere: tiene otro precio. */
export type MemberPlan = {
  publicationId: string;
  label: string;
  outcome: 'do' | 'already' | 'skip' | 'elsewhere';
  // Lo que se pide para esa medida, con su propia campaña del canal.
  ref: string | null;
  price: number | null;
  message: string | null;
};

/**
 * Qué se pide para cada medida. En las campañas donde se elige el precio, solo
 * las medidas que comparten precio (sameprice): las demás se suman desde su
 * pestaña, con su precio. El precio se revisa contra el rango de cada medida.
 */
export function planFamilyAction(
  g: FamilyCampaign,
  args: { action: 'join' | 'leave'; price: number | null; samePrice: string[]; channelName: string },
): MemberPlan[] {
  const withPrice = args.action === 'join' && g.members.some((m) => m.campaign?.join === 'price');
  // Sin familia, una sola publicación: los motivos no nombran la medida.
  const one = g.members.length === 1;
  return g.members.map((m): MemberPlan => {
    const c = m.campaign;
    const base = { publicationId: m.publicationId, label: m.label, ref: null, price: null };
    const it = one ? 'La publicación' : `La medida ${m.label}`;
    if (args.action === 'join') {
      if (!c) return { ...base, outcome: 'skip', message: `${one ? 'A la publicación' : `A la medida ${m.label}`} no la invitan a ${g.name}.` };
      if (isIn(c)) return { ...base, outcome: 'already', message: `${it} ya está en ${g.name}.` };
      if (withPrice && !args.samePrice.includes(m.publicationId)) {
        return { ...base, outcome: 'elsewhere', message: `${it} tiene otro precio: sumala desde la pestaña de su precio.` };
      }
      if (!c.join || !c.ref) return { ...base, outcome: 'skip', message: `${it} se suma a ${g.name} solo desde ${args.channelName}.` };
      if (c.join === 'price') {
        const problem = campaignPriceProblem(args.price ?? 0, c.range, c.listPrice);
        if (problem) return { ...base, outcome: 'skip', message: `${one ? '' : `Medida ${m.label}: `}${problem}${rangeText(c) ? ` Acepta ${rangeText(c)}.` : ''}` };
        return { ...base, outcome: 'do', ref: c.ref, price: campaignPrice(args.price!), message: null };
      }
      return { ...base, outcome: 'do', ref: c.ref, price: null, message: null };
    }
    if (!isIn(c)) return { ...base, outcome: 'already', message: `${it} no está en ${g.name}.` };
    if (!c!.canLeave || !c!.ref) return { ...base, outcome: 'skip', message: `${it} sale de ${g.name} solo desde ${args.channelName}.` };
    return { ...base, outcome: 'do', ref: c!.ref, price: null, message: null };
  });
}

/** "de $ 1.000 a $ 2.000". Null sin rango. */
export function rangeText(c: Pick<ChannelCampaign, 'range'>): string | null {
  const r = c.range;
  if (!r) return null;
  if (r.minPrice !== null && r.maxPrice !== null) return `de ${formatPrice(r.minPrice)} a ${formatPrice(r.maxPrice)}`;
  if (r.maxPrice !== null) return `hasta ${formatPrice(r.maxPrice)}`;
  if (r.minPrice !== null) return `desde ${formatPrice(r.minPrice)}`;
  return null;
}
