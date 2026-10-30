import { z } from 'zod';
import { fingerprint } from '@/domain/channel-sync';
import { DESCRIPTION_MAX, splitDescription, withoutFrame } from '@/domain/descriptions';
import { logActivity } from '@/lib/activity';
import { DescriptionError, loadDescriptionSettings, loadDescriptionStep, saveDescription } from '@/lib/descriptions';
import { familyOf } from '@/lib/families';
import { McpToolError, accountArg, appLink, defineTool, findPublication, publicationArg, resolveAccount, resolvePublication, when } from './tool';

// El paso Descripción para Claude: ver lo que hay y cargar la descripción de
// una o varias publicaciones. Guarda con la misma función que la pantalla, con
// sus mismos chequeos, y en una familia la deja en todas sus medidas.

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
  description: `Guarda la descripción de una o varias publicaciones, hasta ${MAX_AT_ONCE}, como el botón Guardar del paso Descripción: reemplaza la que tenía en la app y queda en Por subir, sin llegar sola al canal. Mandá solo el cuerpo: con_encabezado_y_pie (prendido si no se dice) le agrega el encabezado y el pie de la cuenta; si el texto ya los trae, no se repiten. En una familia se guarda en todas sus medidas: mandá una sola por familia. Reglas: ${RULES} La que no cumple no se guarda y la respuesta dice por qué; las demás sí. No mueve el paso del pipeline: para eso, move_pipeline_step. Escribila solo con datos de la ficha, de la investigación o que te dio la persona, y antes de guardar mostrale el texto y esperá que confirme.`,
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
              : 'Quedó en Por subir: la persona la sube desde la publicación o desde Por subir.',
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

export const DESCRIPTION_TOOLS = [getDescriptionStep, saveDescriptionTool];
