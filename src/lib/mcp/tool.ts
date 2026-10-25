import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { resolveExternalIds } from '@/lib/catalog';
import { canSeeAccount, type Access, type Section } from '@/domain/access';
import { DEFAULT_TIMEZONE, formatDateTime } from '@/lib/format';

// Lo común de las herramientas que la app le ofrece a Claude: quién llama,
// cómo se encuentra la cuenta y la publicación, y los errores que Claude ve.

export type McpContext = {
  db: PrismaClient;
  // La persona que autorizó la conexión: cada cambio queda a su nombre.
  userId: string;
  // Lo que puede esa persona: Claude no hace nada que ella no pueda.
  access: Access;
  // La dirección de la app, para armar links.
  baseUrl: string;
  // La cuenta y la publicación que tocó la herramienta, para la actividad.
  touched?: { accountId?: string; publicationId?: string };
};

/** Un error que se le muestra a Claude tal cual, para que lo explique o corrija el pedido. */
export class McpToolError extends Error {}

export type McpTool<S extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  // Solo lee: Claude la puede usar sin pedir confirmación.
  readOnly: boolean;
  // Pisa o borra algo que ya estaba, o mueve la publicación de una forma que conviene confirmar.
  destructive?: boolean;
  // La sección, o las secciones, donde la persona tiene que poder ver (las que
  // leen) o cambiar (las demás). Sin sección, alcanza con tener sesión.
  section?: Section | readonly Section[];
  run: (ctx: McpContext, args: z.output<S>) => Promise<unknown>;
};

export function defineTool<S extends z.ZodType>(tool: McpTool<S>): McpTool {
  return tool as unknown as McpTool;
}

// ───────────────────────────── Cuenta y publicación ─────────────────────────────

export const accountArg = z
  .string()
  .optional()
  .describe('La cuenta del cliente: su código (por ejemplo "insur") o su nombre. Si hay una sola cuenta, se puede omitir.');

export const publicationArg = z
  .string()
  .min(1)
  .describe('La publicación: su id en la app, su código en el canal (por ejemplo MLA123456789) o el link de la publicación.');

export type AccountRef = { id: string; slug: string; name: string; timezone: string };

/** La cuenta pedida, entre las que ve la persona. */
export async function resolveAccount(ctx: McpContext, ref: string | undefined): Promise<AccountRef> {
  const accounts = (
    await ctx.db.account.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, timezone: true },
    })
  ).filter((a) => canSeeAccount(ctx.access, a.id));
  const found = pick(accounts, ref);
  ctx.touched = { ...ctx.touched, accountId: found.id };
  return found;
}

function pick(accounts: AccountRef[], ref: string | undefined): AccountRef {
  const wanted = ref?.trim().toLowerCase();
  if (!wanted) {
    if (accounts.length === 1) return accounts[0];
    throw new McpToolError(
      `Hay que decir de qué cuenta. Cuentas: ${accounts.map((a) => `${a.name} (${a.slug})`).join(', ') || 'ninguna'}.`,
    );
  }
  const found = accounts.find((a) => a.slug.toLowerCase() === wanted || a.name.toLowerCase() === wanted);
  if (!found) {
    throw new McpToolError(
      `No hay una cuenta "${ref}". Cuentas: ${accounts.map((a) => `${a.name} (${a.slug})`).join(', ') || 'ninguna'}.`,
    );
  }
  return found;
}

/** Busca la publicación en la cuenta por id, código del canal o link. */
export async function resolvePublication(ctx: McpContext, accountId: string, ref: string): Promise<string> {
  const id = await findPublication(ctx.db, accountId, ref);
  ctx.touched = { ...ctx.touched, publicationId: id };
  return id;
}

async function findPublication(db: PrismaClient, accountId: string, ref: string): Promise<string> {
  const text = ref.trim();
  const byId = await db.publication.findFirst({ where: { id: text, product: { accountId } }, select: { id: true } });
  if (byId) return byId.id;
  const r = await resolveExternalIds(db, accountId, text);
  if (r.ids.length > 0) return r.ids[0];
  if (r.notFound.length > 0) throw new McpToolError(`La publicación ${r.notFound[0]} no está en las Publicaciones de la cuenta.`);
  throw new McpToolError(`"${text}" no parece un id, un código ni un link de publicación.`);
}

// ───────────────────────────── Formato ─────────────────────────────

export const when = (d: Date | null | undefined, account: { timezone: string } | null = null) =>
  d ? formatDateTime(d, account?.timezone ?? DEFAULT_TIMEZONE) : null;

export const daysSince = (d: Date | null, now: Date = new Date()) =>
  d ? Math.floor((now.getTime() - d.getTime()) / (24 * 3600_000)) : null;

export const appLink = (ctx: McpContext, account: AccountRef, publicationId: string) =>
  `${ctx.baseUrl}/a/${account.slug}/pipeline/${publicationId}`;
