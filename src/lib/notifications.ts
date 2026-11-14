import webpush from 'web-push';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { can, parsePermissions, type Section } from '@/domain/access';
import {
  NOTIFICATION_KINDS,
  parsePrefs,
  pushAllowed,
  shortText,
  type NotificationKind,
} from '@/domain/notifications';
import { decrypt, encrypt, isCryptoConfigured } from '@/lib/crypto';
import { isEmailConfigured, sendEmail, type Mail, type SendResult } from '@/lib/email';
import { publicAppUrl } from '@/lib/public-url';

// Mandar las notificaciones: se guardan para la campanita y salen al celular,
// al navegador y por mail según lo que eligió cada persona. Lo mismo no se le
// avisa dos veces a la misma persona (la clave). Nunca tira error: una
// notificación que no sale no frena lo que la provocó. Recibe la base por
// parámetro para poder probarlo.

type Db = PrismaClient;

// ───────────────────────────── Claves del celular y el navegador ─────────────────────────────

const KEYS_ID = 'vapid';

/** Quién manda las notificaciones, como piden los navegadores. */
const subject = () => `mailto:${process.env.PUSH_CONTACT?.trim() || 'avisos@studiomrb.com'}`;

/** Las claves con que se firman. Se crean la primera vez. Null si no se pueden guardar cifradas. */
export async function pushKeys(db: Db): Promise<{ publicKey: string; privateKey: string } | null> {
  if (!isCryptoConfigured()) return null;
  const row = await db.pushKeys.findUnique({ where: { id: KEYS_ID } });
  if (row) return { publicKey: row.publicKey, privateKey: decrypt(row.privateKey) };
  const fresh = webpush.generateVAPIDKeys();
  try {
    await db.pushKeys.create({ data: { id: KEYS_ID, publicKey: fresh.publicKey, privateKey: encrypt(fresh.privateKey) } });
    return fresh;
  } catch (e) {
    // Otro pedido las creó a la vez: sirven las suyas.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return pushKeys(db);
    throw e;
  }
}

export type PushPayload = { title: string; body: string; link: string | null; tag: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
// gone: el navegador ya no la acepta, se borra.
export type PushResult = 'ok' | 'gone' | 'error';
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<PushResult>;

/** Manda una al celular o al navegador con web-push. */
export function webPushSender(keys: { publicKey: string; privateKey: string }): PushSender {
  return async (target, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 24 * 3600, urgency: 'high', timeout: 10_000 },
      );
      return 'ok';
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      console.warn(`[notificaciones] no salió una al celular: ${status ?? (e instanceof Error ? e.message : 'error')}`);
      return 'error';
    }
  };
}

export type NotifyDeps = {
  // Null: no hay claves y no sale nada al celular.
  push: (db: Db) => Promise<PushSender | null>;
  mail: (mail: Mail) => Promise<SendResult>;
  mailReady: () => boolean;
  baseUrl: () => string;
};

export const defaultNotifyDeps: NotifyDeps = {
  push: async (db) => {
    const keys = await pushKeys(db).catch(() => null);
    return keys ? webPushSender(keys) : null;
  },
  mail: sendEmail,
  mailReady: isEmailConfigured,
  baseUrl: publicAppUrl,
};

// ───────────────────────────── A quién ─────────────────────────────

/**
 * Las personas activas de una cuenta que ven esa sección: los administradores
 * y las que tienen la cuenta con el permiso. Sin sección, todas las de la cuenta.
 */
export async function accountPeople(db: Db, accountId: string, section: Section | null): Promise<string[]> {
  const users = await db.user.findMany({
    where: { disabledAt: null, OR: [{ isAdmin: true }, { accounts: { some: { accountId } } }] },
    select: { id: true, isAdmin: true, permissions: true },
  });
  return users.filter((u) => section === null || can({ isAdmin: u.isAdmin, permissions: parsePermissions(u.permissions) }, section, 'read')).map((u) => u.id);
}

// ───────────────────────────── Notificar ─────────────────────────────

export type NotifyInput = {
  userIds: string[];
  accountId: string | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  // Una dirección de la app, por ejemplo "/a/insur/ventas/123".
  link?: string | null;
  // Lo mismo no se avisa dos veces a la misma persona.
  key: string;
  // false: el mail lo manda otra parte de la app, como el de las tareas.
  mail?: boolean;
  now?: Date;
};

/** Guarda y manda. Devuelve a cuántas personas les llegó por primera vez. */
export async function notify(db: Db, input: NotifyInput, deps: NotifyDeps = defaultNotifyDeps): Promise<number> {
  try {
    return await notifyOrThrow(db, input, deps);
  } catch (e) {
    console.error('[notificaciones] no se pudo notificar', e instanceof Error ? e.message : e);
    return 0;
  }
}

async function notifyOrThrow(db: Db, input: NotifyInput, deps: NotifyDeps): Promise<number> {
  const ids = [...new Set(input.userIds)];
  if (ids.length === 0) return 0;
  const now = input.now ?? new Date();
  const title = shortText(input.title, 120);
  const body = shortText(input.body ?? '', 400);
  const created = await db.notification.createManyAndReturn({
    data: ids.map((userId) => ({ userId, accountId: input.accountId, kind: input.kind, title, body, link: input.link ?? null, key: input.key, createdAt: now })),
    skipDuplicates: true,
    select: { id: true, userId: true },
  });
  if (created.length === 0) return 0;

  const people = await db.user.findMany({
    where: { id: { in: created.map((c) => c.userId) }, disabledAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      notificationPrefs: true,
      quietFrom: true,
      quietTo: true,
      quietUrgent: true,
      timeZone: true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });
  let sender: PushSender | null | undefined;
  for (const p of people) {
    const prefs = parsePrefs(p.notificationPrefs);
    const quiet = { from: p.quietFrom, to: p.quietTo, urgent: p.quietUrgent, timeZone: p.timeZone };
    if (p.pushSubscriptions.length > 0 && pushAllowed(input.kind, prefs, quiet, now)) {
      if (sender === undefined) sender = await deps.push(db);
      if (sender) await pushTo(db, sender, p.pushSubscriptions, { title, body, link: input.link ?? null, tag: input.key }, now);
    }
    if (input.mail !== false && prefs[input.kind].mail && deps.mailReady()) {
      const r = await deps.mail({ to: p.email, ...notificationMail({ person: p.name, title, body, link: input.link ?? null, baseUrl: deps.baseUrl() }), key: `notif-${p.id}-${input.key}` });
      if (!r.ok) console.warn(`[notificaciones] no salió un mail: ${r.error}`);
    }
  }
  return created.length;
}

/** A todos los celulares y navegadores de la persona. Los que ya no la aceptan se borran. */
async function pushTo(db: Db, sender: PushSender, subs: (PushTarget & { id: string })[], payload: PushPayload, now: Date): Promise<number> {
  let ok = 0;
  for (const s of subs) {
    const r = await sender(s, payload);
    if (r === 'ok') {
      ok++;
      await db.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: now } }).catch(() => undefined);
    } else if (r === 'gone') {
      await db.pushSubscription.deleteMany({ where: { id: s.id } });
    }
  }
  return ok;
}

/** Si la persona quiere el mail de ese tipo. Para los mails que manda otra parte de la app. */
export async function wantsMail(db: Db, userId: string, kind: NotificationKind): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  return u ? parsePrefs(u.notificationPrefs)[kind].mail : false;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function notificationMail(d: { person: string; title: string; body: string; link: string | null; baseUrl: string }): Omit<Mail, 'to' | 'key'> {
  const url = d.link ? `${d.baseUrl}${d.link}` : null;
  const text = [`Hola ${d.person},`, '', d.title, ...(d.body ? ['', d.body] : []), ...(url ? ['', `Abrir: ${url}`] : [])].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;max-width:560px;font-size:15px;line-height:1.5">
    <p style="margin:0 0 12px">Hola ${escape(d.person)},</p>
    <p style="margin:0 0 12px"><strong>${escape(d.title)}</strong></p>
    ${d.body ? `<p style="margin:0 0 20px;white-space:pre-wrap">${escape(d.body)}</p>` : ''}
    ${url ? `<p style="margin:0 0 20px"><a href="${escape(url)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Abrir en la app</a></p>` : ''}
  </div>`;
  return { subject: d.title, text, html };
}

// ───────────────────────────── La campanita ─────────────────────────────

export type NotificationView = {
  id: string;
  kind: NotificationKind | string;
  group: string;
  title: string;
  body: string;
  link: string | null;
  account: string | null;
  read: boolean;
  createdAt: string;
};

export function unreadCount(db: Db, userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Las últimas de la persona. */
export async function listNotifications(db: Db, userId: string, take = 30): Promise<NotificationView[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, kind: true, title: true, body: true, link: true, readAt: true, createdAt: true, account: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    group: (NOTIFICATION_KINDS as Record<string, { group: string }>)[r.kind]?.group ?? 'diario',
    title: r.title,
    body: r.body,
    link: r.link,
    account: r.account?.name ?? null,
    read: r.readAt !== null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Marca leídas las de la persona: esas, o todas. */
export async function markRead(db: Db, userId: string, ids: string[] | 'all', now = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) }, data: { readAt: now } });
}

// Lo que se guarda: lo más viejo que esto se borra.
const KEEP_MS = 90 * 86_400_000;

/** En la tarea programada: borra las viejas. */
export async function pruneNotifications(db: Db, now = new Date()): Promise<number> {
  const r = await db.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - KEEP_MS) } } });
  return r.count;
}

// ───────────────────────────── Celulares y navegadores ─────────────────────────────

export type SubscriptionInput = { endpoint: string; p256dh: string; auth: string; label: string };

/** Guarda el celular o navegador. Si ya era de otra persona, pasa a esta. */
export async function saveSubscription(db: Db, userId: string, s: SubscriptionInput): Promise<void> {
  if (!/^https:\/\//.test(s.endpoint) || s.endpoint.length > 2000 || !s.p256dh || !s.auth) throw new Error('El navegador no dio una suscripción válida.');
  const data = { userId, p256dh: s.p256dh.slice(0, 500), auth: s.auth.slice(0, 200), label: s.label.slice(0, 80) };
  await db.pushSubscription.upsert({ where: { endpoint: s.endpoint }, create: { endpoint: s.endpoint, ...data }, update: data });
}

export async function removeSubscription(db: Db, userId: string, by: { endpoint?: string; id?: string }): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { userId, ...(by.id ? { id: by.id } : { endpoint: by.endpoint ?? '' }) } });
}

/** Una de prueba a los celulares y navegadores de la persona. Cuántos la aceptaron. */
export async function sendTestPush(db: Db, userId: string, deps: Pick<NotifyDeps, 'push'> = defaultNotifyDeps): Promise<number> {
  const subs = await db.pushSubscription.findMany({ where: { userId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  const sender = await deps.push(db);
  if (!sender || subs.length === 0) return 0;
  return pushTo(db, sender, subs, { title: 'Notificación de prueba', body: 'Así te van a llegar las notificaciones de la app.', link: '/notificaciones', tag: `prueba-${Date.now()}` }, new Date());
}
