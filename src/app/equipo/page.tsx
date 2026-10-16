import { prisma } from '@/lib/db';
import { PASSWORD_MIN } from '@/lib/auth';
import { requireUser } from '@/lib/auth/session';
import { formatRelativeDate } from '@/lib/format';
import { plural } from '@/lib/format';
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

export const metadata = { title: 'Equipo' };

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const me = await requireUser();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, createdAt: true },
  });

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
      </PageBody>
    </>
  );
}
