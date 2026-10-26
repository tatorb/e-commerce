import Link from 'next/link';
import { headers } from 'next/headers';
import { History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { accessSummary, can, isOwnSection, parsePermissions, SECTION_KEYS, SECTIONS } from '@/domain/access';
import { listUsers } from '@/lib/users';
import { visibleAccounts } from '@/lib/queries/accounts';
import { prisma } from '@/lib/db';
import { PASSWORD_MIN } from '@/lib/auth';
import { requireUser } from '@/lib/auth/session';
import { formatDateTime, formatRelativeDate } from '@/lib/format';
import { plural } from '@/lib/format';
import { baseUrlFromHeaders, listConnections } from '@/lib/mcp/oauth';
import { publicAppUrl } from '@/lib/public-url';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/components/team/ChangePasswordForm';
import { ClaudeConnections } from '@/components/team/ClaudeConnections';
import { CopyButton } from '@/components/apply/CopyButton';
import { ImageWorkerCard } from '@/components/team/ImageWorkerCard';
import { WorkerStatusLine } from '@/components/pipeline/images/WorkerStatusLine';
import { workerState } from '@/lib/image-worker';
import { DriveCard } from '@/components/team/DriveCard';
import { driveRedirectUri, driveSummary } from '@/lib/drive';
import { isCryptoConfigured, KEY_NOT_CONFIGURED } from '@/lib/crypto';
import { VercelFilesCard } from '@/components/team/VercelFilesCard';
import { vercelLeft } from '@/lib/move-to-drive';
import { isBlobConfigured } from '@/lib/files';
import { emailFrom, isEmailConfigured } from '@/lib/email';
import { TestEmailButton } from '@/components/team/TestEmailButton';

export const metadata = { title: 'Equipo' };

export const dynamic = 'force-dynamic';
// Pasar al Drive lo guardado en Vercel va de a tandas largas.
export const maxDuration = 120;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ drive?: string; detalle?: string }> }) {
  const me = await requireUser();
  const back = await searchParams;
  const admin = me.isAdmin;
  const [users, connections, worker, drive, left, myAccounts] = await Promise.all([
    admin ? listUsers(prisma) : Promise.resolve([]),
    listConnections(prisma, me.id),
    admin ? workerState(prisma) : Promise.resolve(null),
    admin ? driveSummary(prisma) : Promise.resolve(null),
    admin ? vercelLeft(prisma) : Promise.resolve(0),
    visibleAccounts(me.access),
  ]);
  const storeConnected = isBlobConfigured();
  // Lo que dijo la vuelta de Google al conectar el Drive.
  const driveBack = back.drive === 'ok' || back.drive === 'error' ? { ok: back.drive === 'ok', text: back.detalle ?? '' } : null;
  const now = new Date();
  const mcpUrl = `${baseUrlFromHeaders(await headers(), publicAppUrl())}/api/mcp`;
  const active = users.filter((u) => !u.disabledAt);

  return (
    <>
      <PageHeader className="max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
            <p className="text-sm text-muted-foreground">
              {admin
                ? 'Las personas que pueden entrar a la app, qué cuentas ven y qué pueden hacer en cada sección.'
                : 'Tu usuario, tu contraseña y tu conexión con Claude.'}
            </p>
          </div>
          {admin ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/equipo/actividad">
                  <History className="h-4 w-4" />
                  Actividad
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/equipo/usuarios/nuevo">
                  <Plus className="h-4 w-4" />
                  Nueva persona
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </PageHeader>
      <PageBody className="max-w-3xl">
        {admin ? (
          <>
            <p className="text-muted-foreground text-sm">
              {plural(active.length, 'persona activa', 'personas activas')}
              {users.length > active.length ? `, ${plural(users.length - active.length, 'dada de baja', 'dadas de baja')}` : ''}
            </p>
            <Card className="overflow-hidden">
              <ul className="divide-y">
                {users.map((u) => {
                  const lastIn = u.activity[0]?.createdAt ?? null;
                  return (
                    <li key={u.id}>
                      <Link href={`/equipo/usuarios/${u.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className={u.disabledAt ? 'font-medium text-muted-foreground line-through' : 'font-medium'}>
                            {u.name}
                            {u.id === me.id ? <span className="font-normal text-muted-foreground no-underline"> (vos)</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="min-w-0 text-xs text-muted-foreground sm:text-right">
                          <p className="text-foreground">
                            {u.disabledAt
                              ? `Dada de baja el ${formatDateTime(u.disabledAt)}`
                              : accessSummary({ isAdmin: u.isAdmin, permissions: parsePermissions(u.permissions) })}
                          </p>
                          <p className="truncate">
                            {u.isAdmin ? 'Todas las cuentas' : u.accounts.length > 0 ? u.accounts.map((a) => a.account.name).join(', ') : 'Ninguna cuenta'}
                            {u.mustChangePassword && !u.disabledAt ? ' · tiene que cambiar la contraseña' : lastIn ? ` · entró ${formatRelativeDate(lastIn)}` : ''}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Lo que podés hacer</CardTitle>
              <CardDescription>Si necesitás algo más, pedíselo a un administrador.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Cuentas: </span>
                {myAccounts.length > 0 ? myAccounts.map((a) => a.name).join(', ') : 'ninguna.'}
              </p>
              <ul className="space-y-0.5">
                {SECTION_KEYS.filter((s) => can(me.access, s, 'read') || can(me.access, s, 'write') || isOwnSection(s)).map((s) => (
                  <li key={s}>
                    {SECTIONS[s].label}
                    <span className="text-muted-foreground">
                      {' · '}
                      {s === 'subir'
                        ? 'puede'
                        : can(me.access, s, 'write')
                          ? 've y cambia'
                          : can(me.access, s, 'read')
                            ? 'solo ve'
                            : 've y mueve las suyas'}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tu contraseña</CardTitle>
            <CardDescription>
              Si te dieron una contraseña temporal, cambiala acá.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm passwordMin={PASSWORD_MIN} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conexión con Claude</CardTitle>
            <CardDescription>
              Conectá tu Claude con la app para consultar y trabajar las Publicaciones y el Pipeline desde una conversación.
              Usa tu usuario: lo que haga queda a tu nombre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>En claude.ai, abrí Configuración, entrá en Conectores y tocá Agregar conector personalizado.</li>
              <li className="space-y-2">
                <p>Ponele de nombre E-commerce Studio MRB y pegá esta dirección:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded bg-muted px-2 py-1 text-xs">{mcpUrl}</code>
                  <CopyButton value={mcpUrl} label="la dirección para Claude" />
                </div>
              </li>
              <li>Tocá Conectar. Claude te trae a esta app: entrá con tu usuario y tocá Autorizar.</li>
              <li>En una conversación, activá el conector desde el botón de herramientas y pedile lo que necesites.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Si tu plan de Claude es de equipo, puede que el conector lo tenga que agregar quien administra la
              organización. El permiso dura 30 días; después, Claude te pide conectar de nuevo.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tus conexiones activas</p>
              <ClaudeConnections
                rows={connections.map((c) => ({
                  id: c.id,
                  clientName: c.clientName,
                  detail: [
                    `Conectada el ${formatDateTime(c.createdAt)}`,
                    c.lastUsedAt ? `último uso ${formatRelativeDate(c.lastUsedAt)}` : 'todavía sin usar',
                    `vence el ${formatDateTime(c.expiresAt)}`,
                  ].join(', '),
                }))}
              />
            </div>
          </CardContent>
        </Card>

        {admin && worker ? (
          <>
            <Card id="drive">
              <CardHeader>
                <CardTitle>Google Drive del estudio</CardTitle>
                <CardDescription>
                  Donde se guardan los videos de los productos, en una carpeta por cuenta y por producto. Se ven desde la Mac
                  con Google Drive y se pueden cambiar ahí. Es una sola conexión para todas las cuentas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {driveBack ? (
                  <p role="status" className={driveBack.ok ? 'rounded-md border px-3 py-2 text-sm' : 'rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive'}>
                    {driveBack.ok ? `Listo: ${driveBack.text}` : driveBack.text}
                  </p>
                ) : null}
                <p className="text-sm">
                  {drive?.status === 'ACTIVE'
                    ? `Conectado con ${drive.email}${drive.connectedAt ? ` desde el ${formatDateTime(drive.connectedAt)}` : ''}${drive.connectedBy ? `, por ${drive.connectedBy.name}` : ''}.`
                    : drive?.status === 'NEEDS_REAUTH'
                      ? `Hay que volver a conectarlo.${drive.lastError ? ` ${drive.lastError}` : ''}`
                      : 'Sin conectar.'}
                </p>
                {isCryptoConfigured() ? (
                  <DriveCard
                    clientId={drive?.clientId ?? null}
                    secretHint={drive?.clientSecretHint ?? null}
                    connected={drive?.status === 'ACTIVE'}
                    redirectUri={driveRedirectUri()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{KEY_NOT_CONFIGURED}</p>
                )}
              </CardContent>
            </Card>

            <Card id="mails">
              <CardHeader>
                <CardTitle>Mails de las tareas</CardTitle>
                <CardDescription>
                  Los avisos por mail de las tareas: al asignarla, al llegar la fecha de aviso y si vence sin terminar. Salen con Resend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isEmailConfigured() ? (
                  <>
                    <p>Prendidos. Salen desde {emailFrom()}.</p>
                    <TestEmailButton email={me.email} />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Apagados. Para prenderlos, cargá la clave de Resend en Vercel como RESEND_API_KEY y quién los manda como EMAIL_FROM. Mientras
                    tanto, los avisos se ven en la app.
                  </p>
                )}
              </CardContent>
            </Card>

            {left > 0 || storeConnected ? (
              <Card>
                <CardHeader>
                  <CardTitle>Archivos guardados en Vercel</CardTitle>
                  <CardDescription>
                    Antes de pasar al Drive, las fotos y los archivos del fabricante se guardaban en el depósito de Vercel. Se pasan al Drive una
                    sola vez y después se borran de Vercel, para dejar de pagarlo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VercelFilesCard left={left} driveReady={drive?.status === 'ACTIVE'} storeConnected={storeConnected} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Trabajador de imágenes</CardTitle>
                <CardDescription>
                  El programa que corrige las fotos del paso Imágenes. Corre en la Mac del estudio y es uno solo para todas
                  las cuentas. Entra con su propia llave, que se carga una vez en la Mac. Cómo instalarlo está en IMAGENES.md.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <WorkerStatusLine state={worker} now={now} />
                {worker.kind !== 'none' && (worker.info.version || worker.info.modelo_fondo) ? (
                  <p className="text-xs text-muted-foreground">
                    {[
                      worker.info.version ? `Versión ${worker.info.version}` : null,
                      worker.info.modelo_fondo ? `modelo para el fondo ${worker.info.modelo_fondo}` : null,
                      worker.info.memoria_gb ? `${Math.round(worker.info.memoria_gb)} GB de memoria` : null,
                      worker.lastSeenAt ? `última señal ${formatDateTime(worker.lastSeenAt)}` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    {'.'}
                  </p>
                ) : null}
                <ImageWorkerCard hasKey={worker.kind !== 'none'} keyHint={worker.kind !== 'none' ? worker.keyHint : null} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
