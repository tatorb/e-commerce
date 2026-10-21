import { headers } from 'next/headers';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NewTeamMemberDialog } from '@/components/team/NewTeamMemberDialog';
import { ChangePasswordForm } from '@/components/team/ChangePasswordForm';
import { ClaudeConnections } from '@/components/team/ClaudeConnections';
import { CopyButton } from '@/components/apply/CopyButton';
import { ImageWorkerCard } from '@/components/team/ImageWorkerCard';
import { WorkerStatusLine } from '@/components/pipeline/images/WorkerStatusLine';
import { workerState } from '@/lib/image-worker';
import { DriveCard } from '@/components/team/DriveCard';
import { driveRedirectUri, driveSummary } from '@/lib/drive';
import { isCryptoConfigured, KEY_NOT_CONFIGURED } from '@/lib/crypto';

export const metadata = { title: 'Equipo' };

export const dynamic = 'force-dynamic';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ drive?: string; detalle?: string }> }) {
  const me = await requireUser();
  const back = await searchParams;
  const [users, connections, worker, drive] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    listConnections(prisma, me.id),
    workerState(prisma),
    driveSummary(prisma),
  ]);
  // Lo que dijo la vuelta de Google al conectar el Drive.
  const driveBack = back.drive === 'ok' || back.drive === 'error' ? { ok: back.drive === 'ok', text: back.detalle ?? '' } : null;
  const now = new Date();
  const mcpUrl = `${baseUrlFromHeaders(await headers(), publicAppUrl())}/api/mcp`;

  return (
    <>
      <PageHeader className="max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
            <p className="text-sm text-muted-foreground">
              Las personas del estudio que pueden entrar a la app. Todas ven todas las cuentas.
            </p>
          </div>
          <NewTeamMemberDialog passwordMin={PASSWORD_MIN} />
        </div>
      </PageHeader>
      <PageBody className="max-w-3xl">
        <p className="text-muted-foreground text-sm">{plural(users.length, 'persona')}</p>
        <Card className="overflow-hidden">
          <div className="md:hidden divide-y">
            {users.map((u) => (
              <div key={u.id} className="px-3 py-3 space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium truncate">
                    {u.name}
                    {u.id === me.id ? <span className="text-muted-foreground font-normal"> (vos)</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {formatRelativeDate(u.createdAt)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.id === me.id ? (
                        <span className="text-muted-foreground font-normal"> (vos)</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {formatRelativeDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

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
              Conectá tu Claude con la app para consultar y trabajar el Catálogo y el Pipeline desde una conversación.
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
      </PageBody>
    </>
  );
}
