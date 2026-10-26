import type { TaskStatus } from '@/generated/prisma/enums';
import { dueDay, formatDay, remindText, TASK_STATUS_LABEL } from './tasks';

// Lo que dicen los mails de las tareas: al asignarla, al llegar el aviso y al
// vencer sin terminar. Sin la base de datos, para poder probarlo solo.

export type TaskMailKind = 'ASSIGNED' | 'REMINDER' | 'OVERDUE';

export type TaskMailData = {
  kind: TaskMailKind;
  // A quién le llega.
  person: string;
  account: string;
  title: string;
  description: string;
  status: TaskStatus;
  remindAt: Date | null;
  dueOn: Date | null;
  people: string[];
  publications: string[];
  link: string;
  timeZone: string;
};

// Lo más largo de la descripción que va en el mail: el resto, en la app.
const DESCRIPTION_MAX = 1500;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function subjectOf(d: TaskMailData): string {
  if (d.kind === 'ASSIGNED') return `Nueva tarea: ${d.title}`;
  if (d.kind === 'REMINDER') return `Aviso: ${d.title}`;
  return `Venció: ${d.title}`;
}

function introOf(d: TaskMailData): string {
  if (d.kind === 'ASSIGNED') return `Te asignaron una tarea en ${d.account}.`;
  if (d.kind === 'REMINDER') return `Llegó el aviso de esta tarea de ${d.account}.`;
  const due = d.dueOn ? ` el ${formatDay(dueDay(d.dueOn))}` : '';
  return `Esta tarea de ${d.account} venció${due} y sigue ${TASK_STATUS_LABEL[d.status].toLowerCase()}.`;
}

export function taskMail(d: TaskMailData): { subject: string; text: string; html: string } {
  const description = d.description.length > DESCRIPTION_MAX ? `${d.description.slice(0, DESCRIPTION_MAX - 1)}…` : d.description;
  const remind = remindText(d.remindAt, d.timeZone);
  const facts: [string, string][] = [
    ['Estado', TASK_STATUS_LABEL[d.status]],
    ...(d.dueOn ? [['Finalización', formatDay(dueDay(d.dueOn))] as [string, string]] : []),
    ...(remind ? [['Aviso', remind.replace(/^Aviso /, '')] as [string, string]] : []),
    ['Personas', d.people.join(', ')],
  ];
  const footer = 'Te llega porque tenés esta tarea asignada en E-commerce Studio MRB.';

  const text = [
    `Hola ${d.person},`,
    '',
    introOf(d),
    '',
    d.title,
    ...facts.map(([k, v]) => `${k}: ${v}`),
    ...(d.publications.length ? ['', 'Publicaciones:', ...d.publications.map((p) => `- ${p}`)] : []),
    ...(description ? ['', description] : []),
    '',
    `Abrir la tarea: ${d.link}`,
    '',
    footer,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:24px">
    <p style="margin:0 0 12px">Hola ${escape(d.person)},</p>
    <p style="margin:0 0 16px">${escape(introOf(d))}</p>
    <h1 style="margin:0 0 12px;font-size:18px;line-height:1.35">${escape(d.title)}</h1>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
      ${facts.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#78716c">${escape(k)}</td><td style="padding:2px 0">${escape(v)}</td></tr>`).join('\n      ')}
    </table>
    ${
      d.publications.length
        ? `<p style="margin:0 0 4px;font-size:14px;color:#78716c">Publicaciones</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px">${d.publications.map((p) => `<li>${escape(p)}</li>`).join('')}</ul>`
        : ''
    }
    ${description ? `<p style="margin:0 0 16px;font-size:14px;white-space:pre-wrap">${escape(description)}</p>` : ''}
    <p style="margin:0 0 20px"><a href="${escape(d.link)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Abrir la tarea</a></p>
    <p style="margin:0;font-size:12px;color:#a8a29e">${escape(footer)}</p>
  </div>
</body>
</html>`;

  return { subject: subjectOf(d), text, html };
}
