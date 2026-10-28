import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';

// Para quien autorizó desde el link que le mandamos, sin usuario en la app.

export const metadata = { title: 'Conexión' };

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string; detalle?: string }>;
}) {
  const { resultado, detalle } = await searchParams;
  const ok = resultado === 'ok';
  return (
    <AuthCard subtitle="Conexión con Mercado Libre">
      <div className="space-y-3 rounded-2xl border bg-card shadow-card p-6 text-center">
        {ok ? (
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
        ) : (
          <XCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        )}
        <p className="font-medium">{ok ? 'Listo, la cuenta quedó conectada.' : 'No se pudo conectar.'}</p>
        {detalle ? <p className="text-sm text-muted-foreground">{detalle}</p> : null}
        <p className="text-sm text-muted-foreground">
          {ok ? 'Ya podés cerrar esta ventana.' : 'Avisale a Studio MRB para que te mande un link nuevo.'}
        </p>
      </div>
    </AuthCard>
  );
}
