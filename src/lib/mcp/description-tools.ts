import { z } from 'zod';
import { ConnectError } from '@/channels/connect';
import { fingerprint } from '@/domain/channel-sync';
import { DESCRIPTION_MAX, splitDescription, withoutFrame } from '@/domain/descriptions';
import { logActivity } from '@/lib/activity';
import { DescriptionError, loadDescriptionSettings, loadDescriptionStep, saveDescription } from '@/lib/descriptions';
import { familyOf } from '@/lib/families';
import { pushDrafts, PushError } from '@/lib/channel-push';
import { listToPush } from '@/lib/queries/sync';
import { PUSH_BUDGET_MS } from './price-tools';
import { McpToolError, accountArg, appLink, defineTool, findPublication, publicationArg, resolveAccount, resolvePublication, when } from './tool';

// El paso Descripción para Claude: ver lo que hay, cargar la descripción de
// una o varias publicaciones y subirla al canal. Guarda con la misma función
// que la pantalla, con sus mismos chequeos, y sube como el botón de Por
// subir. En una familia la deja y la sube en todas sus medidas.

const MAX_AT_ONCE = 50;

const RULES = `Hasta ${DESCRIPTION_MAX.toLocaleString('es-AR')} caracteres, solo texto sin HTML, sin teléfonos, mails, links, redes ni otros datos de contacto, y sin nada marcado [A CONFIRMAR].`;

/** Si la descripción de la app es la misma que tiene el canal. null: todavía no se leyó del canal. */
const sameAsChannel = (saved: string | null, channel: { text: string | null } | null) =>
  channel ? fingerprint('description', saved) === fingerprint('description', channel.text) : null;

const getDescriptionStep = defineTool({
  name: 'get_description_step',
  section: ['pipeline', 'publicaciones'],
  title: 'Ver el paso Descripción',
  description: `Muestra el paso Descripción de una publicación: la descripción guardada en la app, la que tiene hoy el canal y si son iguales, la propuesta de la IA de la app si la pidieron, y lo que es de la cuenta: el encabezado y el pie fijos, que van en todas las descripciones, y las pautas de la cuenta para escribirlas (Ajustes, Descripciones). Los datos del producto, la investigación y las preguntas para escribirla están en get_publication. Reglas de la descripción: ${RULES}`,
  input: z.object({ cuenta: accountArg, publicacion: publicationArg }),
  readOnly: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const id = await resolvePublication(ctx, account.id, args.publicacion);
    const [step, settings, family, pub] = await Promise.all([
      loadDescriptionStep(ctx.db, { accountId: account.id, publicationId: id }),
      loadDescriptionSettings(ctx.db, account.id),
      familyOf(ctx.db, id),
      ctx.db.publication.findUniqueOrThrow({ where: { id }, select: { externalId: true, title: true } }),
    ]);
    const hasFrame = Boolean(step.header || step.footer);
    return {
      codigo: pub.externalId,
      titulo: pub.title,
      link_app: appLink(ctx, account, id),
      canal: step.channelName,
      publicada: step.published,
      ...(family
        ? { familia: `La descripción es de la familia: se guarda igual en sus ${family.members.length} medidas (${family.members.map((m) => m.externalId ?? m.measure ?? 'sin código').join(', ')}).` }
        : {}),
      encabezado: step.header,
      pie: step.footer,
      pautas_de_la_cuenta: settings?.guidelines ?? null,
      guardada: step.saved
        ? {
            completa: step.saved,
            cuerpo: step.body,
            ...(hasFrame ? { con_encabezado_y_pie: step.framed } : {}),
          }
        : null,
      en_el_canal: step.inChannel ? { texto: step.inChannel.text, leida: when(step.inChannel.readAt, account) } : null,
      igual_que_en_el_canal: sameAsChannel(step.saved, step.inChannel),
      propuesta_de_la_app: step.proposal
        ? {
            texto: step.proposal.text,
            a_confirmar: step.proposal.toConfirm,
            datos_usados: step.proposal.usedData,
            fecha: when(step.proposal.at, account),
            quien: step.proposal.by,
          }
        : null,
      reglas: RULES,
    };
  },
});

const saveDescriptionTool = defineTool({
  name: 'save_description',
  section: ['pipeline', 'publicaciones'],
  title: 'Cargar la descripción',
  description: `Guarda la descripción de una o varias publicaciones, hasta ${MAX_AT_ONCE}, como el botón Guardar del paso Descripción: reemplaza la que tenía en la app y queda en Por subir, sin llegar sola al canal: se sube desde Por subir o con push_descriptions. Mandá solo el cuerpo: con_encabezado_y_pie (prendido si no se dice) le agrega el encabezado y el pie de la cuenta; si el texto ya los trae, no se repiten. En una familia se guarda en todas sus medidas: mandá una sola por familia. Reglas: ${RULES} La que no cumple no se guarda y la respuesta dice por qué; las demás sí. No mueve el paso del pipeline: para eso, move_pipeline_step. Escribila solo con datos de la ficha, de la investigación o que te dio la persona, y antes de guardar mostrale el texto y esperá que confirme.`,
  input: z.object({
    cuenta: accountArg,
    descripciones: z
      .array(
        z.object({
          publicacion: publicationArg,
          descripcion: z.string().min(1).describe('El cuerpo de la descripción, en texto plano, con saltos de línea.'),
        }),
      )
      .min(1)
      .max(MAX_AT_ONCE)
      .describe('Una por publicación.'),
    con_encabezado_y_pie: z.boolean().optional().describe('Agregarle el encabezado y el pie de la cuenta. Si no se dice, sí.'),
  }),
  readOnly: false,
  destructive: true,
  logsItself: true,
  async run(ctx, args) {
    const account = await resolveAccount(ctx, args.cuenta);
    const withFrame = args.con_encabezado_y_pie ?? true;
    const settings = await loadDescriptionSettings(ctx.db, account.id);
    const frame = { header: settings?.header ?? null, footer: settings?.footer ?? null };

    const resultados: unknown[] = [];
    // La familia, o la publicación sola, de cada una ya guardada: la descripción es de la familia.
    const done = new Map<string, string>();
    for (const item of args.descripciones) {
      const ref = item.publicacion;
      let id: string;
      try {
        id = await findPublication(ctx.db, account.id, ref);
      } catch (e) {
        if (!(e instanceof McpToolError)) throw e;
        resultados.push({ publicacion: ref, resultado: 'no_se_guardo', motivo: e.message });
        continue;
      }
      const family = await familyOf(ctx.db, id);
      const group = family?.id ?? id;
      const twin = done.get(group);
      if (twin) {
        resultados.push({
          publicacion: ref,
          resultado: 'no_se_guardo',
          motivo: family ? `Es de la misma familia que ${twin}: la descripción es una sola para toda la familia.` : `Ya vino ${twin} en este mismo pedido.`,
        });
        continue;
      }
      const before = await ctx.db.publication.findUniqueOrThrow({
        where: { id },
        select: { externalId: true, title: true, description: true, channelCopy: { select: { description: true } } },
      });
      const code = before.externalId ?? id;
      const base = { publicacion: code, titulo: before.title, link_app: appLink(ctx, account, id) };
      try {
        const body = withFrame ? withoutFrame(item.descripcion, frame) : item.descripcion;
        const r = await saveDescription(ctx.db, { accountId: account.id, publicationId: id, body, withFrame });
        done.set(group, code);
        const changed = fingerprint('description', before.description) !== fingerprint('description', r.text);
        const channel = before.channelCopy ? { text: before.channelCopy.description } : null;
        const same = sameAsChannel(r.text, channel);
        resultados.push({
          ...base,
          resultado: changed ? 'guardada' : 'sin_cambios',
          caracteres: r.text.length,
          ...(withFrame && (frame.header || frame.footer) ? { con_encabezado_y_pie: splitDescription(r.text, frame).framed } : {}),
          ...(family && family.members.length > 1 ? { familia: `Se guardó en sus ${family.members.length} medidas.` } : {}),
          por_subir: !before.externalId
            ? 'Todavía no está en el canal: va cuando se cree en el paso Publicación.'
            : same === true
              ? 'Es igual a la del canal: no hay nada por subir.'
              : 'Quedó en Por subir: se sube desde la publicación, desde Por subir o con push_descriptions.',
          ...(r.warnings.length > 0 ? { avisos: r.warnings } : {}),
        });
        if (changed) {
          // Como el botón Guardar del paso: queda en la actividad de la persona, hecho por Claude.
          await logActivity(ctx.db, {
            userId: ctx.userId,
            accountId: account.id,
            section: 'pipeline',
            summary: 'Guardó la descripción',
            publicationId: id,
            via: 'CLAUDE',
          });
        }
      } catch (e) {
        if (!(e instanceof DescriptionError)) throw e;
        resultados.push({ ...base, resultado: 'no_se_guardo', motivo: e.message });
      }
    }
    const count = (what: string) => resultados.filter((r) => (r as { resultado: string }).resultado === what).length;
    return {
      resultados,
      guardadas: count('guardada'),
      ...(count('no_se_guardo') > 0 ? { aviso: 'Algunas no se guardaron: mirá el motivo de cada una.' } : {}),
    };
  },
});

const pushDescriptions = defineTool({
  name: 'push_descriptions',
  section: 'subir',
  title: 'Subir descripciones al canal',
  description:
    'Manda al canal la descripción que quedó en Por subir (save_description o el paso Descripción), como el botón de subir de Por subir, pero solo la descripción: lo demás que esté por subir queda donde está. En publicaciones pasá ids de la app o códigos del canal (por ejemplo MLA123456789), hasta 100; sin la lista, van todas las de la cuenta con la descripción por subir. En una familia sube la de todas sus medidas, aunque pases una sola. Saltea las que todavía no están publicadas en el canal, las que no tienen la descripción por subir y las que cambiaron también en el canal, y dice por qué. Por cada una devuelve si quedó bien o el motivo exacto del rechazo del canal. Si son muchas, sube las que entran en una vuelta y devuelve en quedan las que faltan: volvé a llamar con esa lista. Cambia la publicación en el canal de verdad: antes de subir, mostrale a la persona qué descripción se va a mandar y a cuáles, y esperá que confirme.',
  input: z.object({
    cuenta: accountArg,
    publicaciones: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .optional()
      .describe('Las publicaciones: su id en la app o su código en el canal, hasta 100. Sin la lista, todas las de la cuenta con la descripción por subir.'),
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
      return row?.draft.includes('description') ? 'draft' : row?.choose.includes('description') ? 'choose' : null;
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
          // La descripción es de la familia: van todas sus medidas.
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
        salteadas.push({ publicacion: code, motivo: `La descripción cambió también en ${channelName}: primero hay que elegir cuál queda, en la publicación o en Por subir.` });
        continue;
      }
      if (state === null) {
        if (asked.has(id)) salteadas.push({ publicacion: code, motivo: 'No tiene la descripción por subir.' });
        continue;
      }
      if (Date.now() - started > PUSH_BUDGET_MS) {
        quedan.push(code);
        continue;
      }
      const base = { publicacion: code, titulo: p.title, caracteres: p.description?.trim().length ?? 0 };
      try {
        const r = await pushDrafts(ctx.db, { accountId: account.id, publicationId: id, fields: ['description'], campaigns: false, userId: ctx.userId });
        const rejected = r.rejected.find((x) => x.field === 'description');
        const sent = r.sent.includes('description');
        subidas.push({
          ...base,
          resultado: sent ? 'subida' : 'rechazada',
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
          detail: sent ? 'Subió la descripción' : (rejected?.message ?? null),
          via: 'CLAUDE',
        });
      } catch (e) {
        if (!(e instanceof PushError || e instanceof ConnectError)) {
          console.error('push_descriptions: no se pudo subir', e instanceof Error ? e.message : e);
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
      ...(ids.length === 0 && salteadas.length === 0 ? { aviso: 'No hay descripciones por subir en la cuenta.' } : {}),
    };
  },
});

export const DESCRIPTION_TOOLS = [getDescriptionStep, saveDescriptionTool, pushDescriptions];
