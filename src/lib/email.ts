// Mandar mails con Resend (resend.com). La clave va en RESEND_API_KEY, en las
// variables de Vercel; quién lo manda, en EMAIL_FROM, con un dominio
// verificado en Resend. Sin la clave, la app anda igual y los mails esperan.

// Quién manda los mails si no se dice otra cosa.
export const DEFAULT_FROM = 'Studio MRB <avisos@studiomrb.com>';

const apiUrl = () => (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/+$/, '');

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Quién manda los mails. */
export const emailFrom = () => process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // El mismo mail lleva siempre la misma: si se manda dos veces, Resend lo manda una.
  key: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

/** Manda un mail. Nunca tira error: devuelve el motivo, sin datos de la persona. */
export async function sendEmail(mail: Mail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: 'Falta configurar RESEND_API_KEY.' };
  try {
    const res = await fetch(`${apiUrl()}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': mail.key.slice(0, 256) },
      body: JSON.stringify({
        from: emailFrom(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
    const reason = typeof body?.message === 'string' ? `: ${body.message.slice(0, 200)}` : '';
    return { ok: false, error: `Resend respondió ${res.status}${reason}` };
  } catch {
    return { ok: false, error: 'No se pudo conectar con Resend.' };
  }
}
