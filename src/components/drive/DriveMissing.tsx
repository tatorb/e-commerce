import Link from 'next/link';

// Si el Drive del estudio no está conectado: dónde se conecta.
export function DriveMissing({ what }: { what: string }) {
  return (
    <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <p>{what} se guardan en el Google Drive del estudio, y todavía no está conectado.</p>
      <p className="text-muted-foreground">
        Se conecta una sola vez, en{' '}
        <Link href="/equipo#drive" className="text-primary underline-offset-4 hover:underline">
          Equipo
        </Link>
        , con la cuenta martin@studiomrb.com.
      </p>
    </div>
  );
}
