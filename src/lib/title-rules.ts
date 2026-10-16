import type { PrismaClient } from '@/generated/prisma/client';
import type { ChannelKind } from '@/generated/prisma/enums';
import { getChannelAdapter } from '@/channels';
import { parseTitleRules, type TitleRules } from '@/domain/title-rules';

// Las reglas de título que valen para una cuenta en un canal: las que cargó la
// cuenta en Ajustes o, si no cargó ninguna, las del canal.
export async function loadTitleRules(
  db: PrismaClient,
  accountId: string,
  channel: { id: string; kind: ChannelKind; name: string },
): Promise<{ rules: TitleRules; custom: boolean; updatedAt: Date | null }> {
  const row = await db.titleRuleSet.findUnique({ where: { accountId_channelId: { accountId, channelId: channel.id } } });
  if (row) return { rules: parseTitleRules(row), custom: true, updatedAt: row.updatedAt };
  return { rules: getChannelAdapter(channel.kind, channel.name).titleRules, custom: false, updatedAt: null };
}
