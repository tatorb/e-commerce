import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hhmm, parsePrefs } from '@/domain/notifications';
import { isEmailConfigured } from '@/lib/email';

export const metadata = { title: 'Mis notificaciones' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requireUser();
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      notificationPrefs: true,
      quietFrom: true,
      quietTo: true,
      quietUrgent: true,
      timeZone: true,
      pushSubscriptions: { orderBy: { createdAt: 'asc' }, select: { id: true, label: true, endpoint: true, createdAt: true, lastSentAt: true } },
    },
  });
  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Mis notificaciones</h1>
          <p className="text-sm text-muted-foreground">Qué te avisa la app, por dónde y cuándo. Cada persona elige lo suyo.</p>
        </div>
      </PageHeader>
      <PageBody>
        <div className="max-w-2xl">
          <NotificationSettings
            prefs={parsePrefs(u.notificationPrefs)}
            quietFrom={u.quietFrom === null ? null : hhmm(u.quietFrom)}
            quietTo={u.quietTo === null ? null : hhmm(u.quietTo)}
            quietUrgent={u.quietUrgent}
            timeZone={u.timeZone}
            devices={u.pushSubscriptions.map((d) => ({
              id: d.id,
              label: d.label,
              endpoint: d.endpoint,
              createdAt: d.createdAt.toISOString(),
              lastSentAt: d.lastSentAt?.toISOString() ?? null,
            }))}
            mailReady={isEmailConfigured()}
          />
        </div>
      </PageBody>
    </>
  );
}
