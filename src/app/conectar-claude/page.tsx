import { redirect } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { authorizeQuery, checkAuthorizeRequest, readAuthorizeParams } from '@/lib/mcp/oauth';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';

// La pantalla de permiso: Claude manda acá a la persona para que autorice la
// conexión con su usuario. Sin sesión, pasa antes por el login.

export const metadata = { title: 'Conectar con Claude' };

export const dynamic = 'force-dynamic';

export default async function ConnectClaudePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const params = readAuthorizeParams((k) => search[k]);
  const check = await checkAuthorizeRequest(prisma, params);
  if (!check.ok && 'redirect' in check) redirect(check.redirect);

  const user = check.ok ? await getCurrentUser() : null;
  if (check.ok && !user) redirect(`/login?from=${encodeURIComponent(`/conectar-claude?${authorizeQuery(params)}`)}`);

  return (
    <AuthCard subtitle="Conexión con Claude">
      {!check.ok ? (
        <div className="space-y-3 rounded-2xl border bg-card shadow-card p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
          <p className="font-medium">No se puede conectar.</p>
          <p className="text-sm text-muted-foreground">{'show' in check ? check.show : null}</p>
          <p className="text-sm text-muted-foreground">Volvé a Claude y agregá el conector de nuevo.</p>
        </div>
      ) : (
        <form method="post" action="/api/oauth/authorize" className="space-y-4 rounded-2xl border bg-card shadow-card p-6">
          <div className="space-y-2 text-sm">
            <p className="text-base font-medium">{check.clientName} quiere conectarse con tu usuario.</p>
            <p className="text-muted-foreground">
              Entraste como <span className="font-medium text-foreground">{user!.name}</span> ({user!.email}). Si autorizás,
              Claude va a poder ver y trabajar en todas las cuentas, igual que vos en la app. Cada cambio queda a tu
              nombre.
            </p>
            <p className="text-muted-foreground">
              El permiso dura 30 días y lo podés cortar cuando quieras desde Equipo. Vuelve a{' '}
              <span className="font-medium text-foreground">{check.destination}</span>.
            </p>
            <p className="text-muted-foreground">Si no lo pediste vos desde Claude, tocá Cancelar.</p>
          </div>
          {Object.entries({
            response_type: 'code',
            client_id: params.clientId,
            redirect_uri: params.redirectUri,
            state: params.state,
            code_challenge: params.codeChallenge,
            code_challenge_method: params.codeChallengeMethod,
          }).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
          <div className="flex gap-2">
            <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" name="decision" value="allow" className="flex-1">
              Autorizar
            </Button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
