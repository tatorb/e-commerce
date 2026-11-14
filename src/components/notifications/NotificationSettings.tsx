'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Monitor, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GROUP_LABEL,
  NOTIFICATION_KIND_KEYS,
  NOTIFICATION_KINDS,
  type NotificationGroup,
  type NotificationPrefs,
} from '@/domain/notifications';
import {
  pushPublicKeyAction,
  savePrefsAction,
  subscribePushAction,
  testPushAction,
  unsubscribePushAction,
} from '@/app/notificaciones/actions';
import { currentSubscription, pushSupport, subscribe, unsubscribe, type PushSupport } from '@/components/notifications/push-client';

// Mis notificaciones: activar en este dispositivo, qué tipos llegan al
// celular y al navegador y cuáles por mail, y el horario de silencio.

export type Device = { id: string; label: string; endpoint: string; createdAt: string; lastSentAt: string | null };

type Props = {
  prefs: NotificationPrefs;
  quietFrom: string | null;
  quietTo: string | null;
  quietUrgent: boolean;
  timeZone: string;
  devices: Device[];
  mailReady: boolean;
};

const GROUPS: NotificationGroup[] = ['urgente', 'diario', 'resumen'];

// Lo que se lee del navegador una vez y no cambia mientras se mira la pantalla.
const noSubscribe = () => () => {};
let supportCache: PushSupport | null = null;
function cachedSupport(): PushSupport {
  supportCache ??= pushSupport();
  return supportCache;
}
function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

function ThisDevice({ devices }: { devices: Device[] }) {
  const router = useRouter();
  // Solo en el navegador: en el servidor no se sabe.
  const support = React.useSyncExternalStore<PushSupport | null>(noSubscribe, cachedSupport, () => null);
  const [endpoint, setEndpoint] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    currentSubscription()
      .then((s) => setEndpoint(s?.endpoint ?? null))
      .catch(() => setEndpoint(null));
  }, []);

  const active = endpoint !== null && devices.some((d) => d.endpoint === endpoint);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const key = await pushPublicKeyAction();
      if (!key) {
        setMsg({ ok: false, text: 'La app todavía no puede mandar notificaciones: falta la clave de cifrado en Vercel.' });
        return;
      }
      const r = await subscribe(key);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      const saved = await subscribePushAction(r.sub);
      if (!saved.ok) {
        setMsg({ ok: false, text: saved.error });
        return;
      }
      setEndpoint(r.sub.endpoint);
      setMsg({ ok: true, text: 'Listo. Este dispositivo ya recibe las notificaciones.' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const ep = await unsubscribe();
      if (ep) await unsubscribePushAction({ endpoint: ep });
      setEndpoint(null);
      setMsg({ ok: true, text: 'Este dispositivo ya no recibe notificaciones.' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await testPushAction();
      setMsg(r.ok ? { ok: true, text: `Mandamos una de prueba a ${r.sent === 1 ? 'tu dispositivo' : `tus ${r.sent} dispositivos`}.` } : { ok: false, text: r.error });
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: Device) {
    setBusy(true);
    try {
      if (d.endpoint === endpoint) await unsubscribe();
      await unsubscribePushAction({ id: d.id });
      if (d.endpoint === endpoint) setEndpoint(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-4 w-4" />
          Celular y navegador
        </CardTitle>
        <CardDescription>
          Se activa una vez en cada dispositivo que uses: el celular, la computadora del trabajo, la de tu casa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {support?.kind === 'ios-install' ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium">En el iPhone, primero hay que instalar la app</p>
            <p className="text-muted-foreground">
              Abrí la app en Safari, tocá Compartir y después Agregar a inicio. Abrila desde el ícono nuevo y volvé a esta pantalla para activarlas.
            </p>
          </div>
        ) : support?.kind === 'unsupported' ? (
          <p className="text-sm text-muted-foreground">Este navegador no puede recibir notificaciones. Probá con Chrome, Edge, Firefox o Safari.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {active ? (
            <Button type="button" variant="outline" size="sm" onClick={disable} disabled={busy}>
              Desactivar en este dispositivo
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={enable} disabled={busy || support === null || support.kind !== 'ok'}>
              Activar en este dispositivo
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={test} disabled={busy || devices.length === 0}>
            Mandar una de prueba
          </Button>
        </div>
        {msg ? <p className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{msg.text}</p> : null}
        {devices.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activadas en</p>
            <ul className="divide-y rounded-md border">
              {devices.map((d) => {
                const phone = /iPhone|Android|iPad/.test(d.label);
                return (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {phone ? <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">
                      {d.label || 'Dispositivo'}
                      {d.endpoint === endpoint ? <span className="text-muted-foreground"> · este</span> : null}
                    </span>
                    <Button type="button" variant="ghost" size="icon" aria-label="Sacar" title="Sacar" onClick={() => remove(d)} disabled={busy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function NotificationSettings(props: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(props.prefs);
  const [quietOn, setQuietOn] = React.useState(props.quietFrom !== null && props.quietTo !== null);
  const [quietFrom, setQuietFrom] = React.useState(props.quietFrom ?? '22:00');
  const [quietTo, setQuietTo] = React.useState(props.quietTo ?? '08:00');
  const [quietUrgent, setQuietUrgent] = React.useState(props.quietUrgent);
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  // La zona horaria del dispositivo, para el horario de silencio. En el servidor, la guardada.
  const timeZone = React.useSyncExternalStore(noSubscribe, deviceZone, () => props.timeZone) || props.timeZone;

  function setKind(k: keyof NotificationPrefs, ch: 'push' | 'mail', v: boolean) {
    setPrefs((p) => ({ ...p, [k]: { ...p[k], [ch]: v } }));
    setMsg(null);
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await savePrefsAction({ prefs, quietOn, quietFrom, quietTo, quietUrgent, timeZone });
      setMsg(r.ok ? { ok: true, text: 'Guardado.' } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <ThisDevice devices={props.devices} />

      <Card>
        <CardHeader>
          <CardTitle>Qué te llega</CardTitle>
          <CardDescription>
            Todo queda siempre en la campanita. Acá elegís qué además te llega al celular y al navegador, y qué por mail.
            {props.mailReady ? null : ' Los mails todavía no salen: falta configurar Resend.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g} className="space-y-2">
              <div>
                <p className="text-sm font-semibold">{GROUP_LABEL[g].label}</p>
                <p className="text-xs text-muted-foreground">{GROUP_LABEL[g].hint}</p>
              </div>
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[1fr_4.5rem_3.5rem] items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Tipo</span>
                  <span className="text-center">Celular</span>
                  <span className="text-center">Mail</span>
                </div>
                {NOTIFICATION_KIND_KEYS.filter((k) => NOTIFICATION_KINDS[k].group === g).map((k) => (
                  <div key={k} className="grid grid-cols-[1fr_4.5rem_3.5rem] items-center gap-2 border-b px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm">{NOTIFICATION_KINDS[k].label}</p>
                      <p className="text-xs text-muted-foreground">{NOTIFICATION_KINDS[k].hint}</p>
                    </div>
                    <label className="flex justify-center p-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`${NOTIFICATION_KINDS[k].label} al celular y al navegador`}
                        checked={prefs[k].push}
                        onChange={(e) => setKind(k, 'push', e.target.checked)}
                        disabled={pending}
                      />
                    </label>
                    <label className="flex justify-center p-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`${NOTIFICATION_KINDS[k].label} por mail`}
                        checked={prefs[k].mail}
                        onChange={(e) => setKind(k, 'mail', e.target.checked)}
                        disabled={pending}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario de silencio</CardTitle>
          <CardDescription>En ese horario no suena nada en el celular ni en el navegador. Igual queda en la campanita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={quietOn} onChange={(e) => setQuietOn(e.target.checked)} disabled={pending} />
            Silenciar de noche
          </label>
          {quietOn ? (
            <div className="space-y-3 pl-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>De</span>
                <input
                  type="time"
                  value={quietFrom}
                  onChange={(e) => setQuietFrom(e.target.value)}
                  className="h-9 rounded-md border bg-background px-2"
                  aria-label="Desde"
                  disabled={pending}
                />
                <span>a</span>
                <input
                  type="time"
                  value={quietTo}
                  onChange={(e) => setQuietTo(e.target.value)}
                  className="h-9 rounded-md border bg-background px-2"
                  aria-label="Hasta"
                  disabled={pending}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={quietUrgent} onChange={(e) => setQuietUrgent(e.target.checked)} disabled={pending} />
                <span>
                  Silenciar también lo urgente
                  <span className="block text-xs text-muted-foreground">Sin marcar, los reclamos, las ventas y las preguntas suenan igual.</span>
                </span>
              </label>
              <p className="text-xs text-muted-foreground">Con la hora de {timeZone.replace(/_/g, ' ')}.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          Guardar
        </Button>
        {msg ? <p className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{msg.text}</p> : null}
      </div>
    </div>
  );
}
