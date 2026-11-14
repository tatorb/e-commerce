'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import {
  listNotifications,
  markRead,
  pushKeys,
  removeSubscription,
  saveSubscription,
  sendTestPush,
  unreadCount,
  type NotificationView,
  type SubscriptionInput,
} from '@/lib/notifications';
import { NOTIFICATION_KIND_KEYS, parseHhmm, type NotificationPrefs } from '@/domain/notifications';

// La campanita y la pantalla Mis notificaciones. Cada persona toca solo lo suyo.

type Result = { ok: true } | { ok: false; error: string };

export async function loadBellAction(): Promise<{ unread: number; items: NotificationView[] }> {
  const user = await requireUser();
  const [unread, items] = await Promise.all([unreadCount(prisma, user.id), listNotifications(prisma, user.id, 20)]);
  return { unread, items };
}

export async function unreadCountAction(): Promise<number> {
  const user = await requireUser();
  return unreadCount(prisma, user.id);
}

export async function markReadAction(ids: string[] | 'all'): Promise<void> {
  const user = await requireUser();
  await markRead(prisma, user.id, ids === 'all' ? 'all' : ids.slice(0, 100));
}

/** La clave pública que pide el navegador para activar las notificaciones. */
export async function pushPublicKeyAction(): Promise<string | null> {
  await requireUser();
  const keys = await pushKeys(prisma).catch(() => null);
  return keys?.publicKey ?? null;
}

export async function subscribePushAction(sub: SubscriptionInput): Promise<Result> {
  const user = await requireUser();
  try {
    await saveSubscription(prisma, user.id, sub);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
  revalidatePath('/notificaciones');
  return { ok: true };
}

export async function unsubscribePushAction(by: { endpoint?: string; id?: string }): Promise<Result> {
  const user = await requireUser();
  await removeSubscription(prisma, user.id, by);
  revalidatePath('/notificaciones');
  return { ok: true };
}

export async function testPushAction(): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const sent = await sendTestPush(prisma, user.id);
  return sent > 0 ? { ok: true, sent } : { ok: false, error: 'No llegó a ningún dispositivo. Activalas primero en este dispositivo.' };
}

export type PrefsInput = {
  prefs: NotificationPrefs;
  quietOn: boolean;
  quietFrom: string;
  quietTo: string;
  quietUrgent: boolean;
  timeZone: string;
};

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function savePrefsAction(input: PrefsInput): Promise<Result> {
  const user = await requireUser();
  const prefs: Record<string, { push: boolean; mail: boolean }> = {};
  for (const k of NOTIFICATION_KIND_KEYS) {
    const v = input.prefs[k];
    prefs[k] = { push: Boolean(v?.push), mail: Boolean(v?.mail) };
  }
  const from = input.quietOn ? parseHhmm(input.quietFrom) : null;
  const to = input.quietOn ? parseHhmm(input.quietTo) : null;
  if (input.quietOn && (from === null || to === null)) return { ok: false, error: 'Elegí desde y hasta qué hora es el silencio.' };
  if (input.quietOn && from === to) return { ok: false, error: 'El silencio tiene que empezar y terminar a horas distintas.' };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      notificationPrefs: prefs,
      quietFrom: from,
      quietTo: to,
      quietUrgent: input.quietUrgent,
      ...(validZone(input.timeZone) ? { timeZone: input.timeZone } : {}),
    },
  });
  revalidatePath('/notificaciones');
  return { ok: true };
}
