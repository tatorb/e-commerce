import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import { logActivity } from '@/lib/activity';
import { familyOf } from '@/lib/families';
import { pushDrafts, PushError } from '@/lib/channel-push';
import { listToPush } from '@/lib/queries/sync';
import { PUSH_BUDGET_MS } from './price-tools';
import { McpToolError, accountArg, defineTool, findPublication, resolveAccount } from './tool';

// Subir al canal un solo dato que quedó en Por subir, el título o la
// descripción, como el botón de subir de Por subir pero solo eso. Son de la
// familia: con una medida van todas. Por cada publicación dice si quedó bien o
// el motivo exacto del rechazo del canal; lo que no entra en una vuelta vuelve
// en quedan.

type Field = 'title' | 'description';

const TEXTS: Record<Field, { name: string; title: string; the: string; it: string; done: string; none: string; from: string; show: string }> = {
  title: {
    name: 'push_titles',
    title: 'Subir títulos al canal',
    the: 'el título',
    it: 'subido',
    done: 'Subió el título',
    none: 'No hay títulos por subir en la cuenta.',
    from: 'set_publication_title, approve_title o el paso Título',
    show: 'qué título se va a mandar y a cuáles',
  },
  description: {
    name: 'push_descriptions',
    title: 'Subir descripciones al canal',
    the: 'la descripción',
    it: 'subida',
    done: 'Subió la descripción',
    none: 'No hay descripciones por subir en la cuenta.',
    from: 'save_description o el paso Descripción',
    show: 'qué descripción se va a mandar y a cuáles',
  },
};

function pushFieldTool(field: Field) {
  const t = TEXTS[field];
  const upper = t.the.charAt(0).toUpperCase() + t.the.slice(1);
  return defineTool({
    name: t.name,
    section: 'subir',
    title: t.title,
    description: `Manda al canal ${t.the} que quedó en Por subir (${t.from}), como el botón de subir de Por subir, pero solo ${t.the}: lo demás que esté por subir queda donde está. En publicaciones pasá ids de la app o códigos del canal (por ejemplo MLA123456789), hasta 100; sin la lista, van todas las de la cuenta con ${t.the} por subir. En una familia sube ${t.the} de todas sus medidas, aunque pases una sola. Saltea las que todavía no están publicadas en el canal, las que no tienen ${t.the} por subir y las que cambiaron también en el canal, y dice por qué. Por cada una devuelve si quedó bien o el motivo exacto del rechazo del canal${field === 'title' ? '; un título bloqueado por ventas no se sube: eso se decide en el paso Título' : ''}. Si son muchas, sube las que entran en una vuelta y devuelve en quedan las que faltan: volvé a llamar con esa lista. Cambia la publicación en el canal de verdad: antes de subir, mostrale a la persona ${t.show}, y esperá que confirme.`,
    input: z.object({
      cuenta: accountArg,
      publicaciones: z
        .array(z.string().min(1))
        .min(1)
        .max(100)
        .optional()
        .describe(`Las publicaciones: su id en la app o su código en el canal, hasta 100. Sin la lista, todas las de la cuenta con ${t.the} por subir.`),
    }),
    readOnly: false,
    destructive: true,
    logsItself: true,
    run: async (ctx, args) => {
      const account = await resolveAccount(ctx, args.cuenta);
      const started = Date.now();
      const pending = new Map((await listToPush(account.id, ctx.db)).map((r) => [r.id, r]));
      // draft: cambió en la app; choose: cambió también en el canal y hay que elegir.
      const stateOf = (id: string) => {
        const row = pending.get(id);
        return row?.draft.includes(field) ? 'draft' : row?.choose.includes(field) ? 'choose' : null;
      };

      const salteadas: { publicacion: string; motivo: string }[] = [];
      // Las pedidas; las otras medidas de su familia se suman sin avisar si no tienen nada por subir.
      const asked = new Set<string>();
      let ids: string[] = [];
      if (args.publicaciones) {
        for (const ref of args.publicaciones) {
          try {
            const id = await findPublication(ctx.db, account.id, ref);
            asked.add(id);
            // Es de la familia: van todas sus medidas.
            const family = await familyOf(ctx.db, id);
            for (const member of family ? family.members.map((m) => m.id) : [id]) if (!ids.includes(member)) ids.push(member);
          } catch (e) {
            if (!(e instanceof McpToolError)) throw e;
            salteadas.push({ publicacion: ref, motivo: e.message });
          }
        }
      } else ids = [...pending.keys()].filter((id) => stateOf(id) !== null);

      const pubs = new Map(
        (
          await ctx.db.publication.findMany({
            where: { id: { in: ids } },
            select: { id: true, externalId: true, title: true, description: true, store: { select: { channel: { select: { name: true } } } } },
          })
        ).map((p) => [p.id, p]),
      );

      const subidas: unknown[] = [];
      const quedan: string[] = [];
      for (const id of ids) {
        const p = pubs.get(id)!;
        const code = p.externalId ?? id;
        const channelName = p.store.channel.name;
        const state = stateOf(id);
        if (!p.externalId) {
          if (asked.has(id)) salteadas.push({ publicacion: code, motivo: `Todavía no está publicada en ${channelName}: primero hay que crearla allá.` });
          continue;
        }
        if (state === 'choose') {
          salteadas.push({ publicacion: code, motivo: `${upper} cambió también en ${channelName}: primero hay que elegir cuál queda, en la publicación o en Por subir.` });
          continue;
        }
        if (state === null) {
          if (asked.has(id)) salteadas.push({ publicacion: code, motivo: `No tiene ${t.the} por subir.` });
          continue;
        }
        if (Date.now() - started > PUSH_BUDGET_MS) {
          quedan.push(code);
          continue;
        }
        const value = (field === 'title' ? p.title : p.description)?.trim() ?? '';
        const base = { publicacion: code, titulo: p.title, ...(field === 'description' ? { caracteres: value.length } : {}) };
        try {
          const r = await pushDrafts(ctx.db, { accountId: account.id, publicationId: id, fields: [field], campaigns: false, userId: ctx.userId });
          const rejected = r.rejected.find((x) => x.field === field);
          const sent = r.sent.includes(field);
          subidas.push({
            ...base,
            resultado: sent ? t.it : 'rechazado',
            ...(rejected ? { motivo: rejected.message } : {}),
            confirmado_en_el_canal: r.confirmed,
          });
          // Como el botón de Por subir: queda en la actividad de la persona, hecho por Claude.
          await logActivity(ctx.db, {
            userId: ctx.userId,
            accountId: account.id,
            section: 'subir',
            summary: 'Subió cambios al canal',
            publicationId: id,
            detail: sent ? t.done : (rejected?.message ?? null),
            via: 'CLAUDE',
          });
        } catch (e) {
          if (!(e instanceof PushError || e instanceof ConnectError)) {
            console.error(`${t.name}: no se pudo subir`, e instanceof Error ? e.message : e);
          }
          subidas.push({
            ...base,
            resultado: 'error',
            motivo: e instanceof PushError || e instanceof ConnectError ? e.message : 'No se pudo subir: hubo un error en la app. Probá de nuevo.',
          });
        }
      }
      return {
        subidas,
        ...(salteadas.length > 0 ? { salteadas } : {}),
        ...(quedan.length > 0 ? { quedan, aviso: 'No entraron todas en esta vuelta: volvé a llamar con la lista de quedan.' } : {}),
        ...(ids.length === 0 && salteadas.length === 0 ? { aviso: t.none } : {}),
      };
    },
  });
}

export const PUSH_TOOLS = [pushFieldTool('title'), pushFieldTool('description')];
