import { z } from 'zod';
import type { FamilyCampaignResult } from '@/lib/channel-campaigns';

// Lo que llega de la pantalla para sumarse a una campaña o salir con todas las
// medidas de la familia, y lo que vuelve.

export type FamilyCampaignInput = { publicationIds: string[]; campaign: string; action: 'join' | 'leave'; price: number | null };

export const familyCampaignInput = z.object({
  publicationIds: z.array(z.string().min(1).max(40)).min(1).max(20),
  campaign: z.string().min(1).max(500),
  action: z.enum(['join', 'leave']),
  price: z.number().positive().max(999_999_999).nullable(),
});

export type FamilyCampaignActionResult = { ok: true; name: string; results: FamilyCampaignResult[] } | { ok: false; error: string };
