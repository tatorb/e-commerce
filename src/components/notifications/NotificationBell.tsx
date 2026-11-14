'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils/cn';
import { loadBellAction, markReadAction, unreadCountAction } from '@/app/notificaciones/actions';
import type { NotificationView } from '@/lib/notifications';
import { registerWorker } from '@/components/notifications/push-client';

// La campanita, al lado de cerrar sesión: cuántas hay sin leer y, al tocarla,
// una ventanita con las últimas, resumidas. Al tocar una se abre lo que avisa.

// Cada cuánto mira si llegó algo, mientras la pestaña está a la vista.
const POLL_MS = 60_000;

/** "recién", "hace 5 min", "hace 3 h", "hace 2 días". */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'recién';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(initialUnread);
  const [items, setItems] = React.useState<NotificationView[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Si la persona ya dio permiso, el service worker queda al día.
  React.useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') void registerWorker();
  }, []);

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      unreadCountAction().then(setUnread).catch(() => undefined);
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await loadBellAction();
      setItems(r.items);
      setUnread(r.unread);
    } finally {
      setLoading(false);
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  async function openItem(n: NotificationView) {
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
      void markReadAction([n.id]);
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function readAll() {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(0);
    await markReadAction('all');
  }

  const label = unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones';
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" type="button" title={label} aria-label={label} className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 inline-flex min-w-[1rem] h-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 ? (
            <button type="button" onClick={readAll} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Marcar todas como leídas
            </button>
          ) : null}
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {items === null ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{loading ? 'Cargando…' : ''}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tenés notificaciones.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn('flex w-full gap-2 px-3 py-2.5 text-left hover:bg-accent', !n.read && 'bg-muted/50')}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        n.read ? 'bg-transparent' : n.group === 'urgente' ? 'bg-red-600' : 'bg-blue-600',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm leading-snug', !n.read && 'font-medium')}>{n.title}</span>
                      {n.body ? <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.body}</span> : null}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {[n.account, ago(n.createdAt)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t px-3 py-2">
          <Link
            href="/notificaciones"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <Settings className="h-3.5 w-3.5" />
            Elegir qué me llega y activar en este dispositivo
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
