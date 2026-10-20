import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';

// Lo que se ve apenas se toca otra pantalla, mientras el servidor la arma: el
// menú queda y el centro muestra la forma de la página. Con esto Next también
// puede adelantar esta parte antes del toque.

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <PageHeader>
        <div className="space-y-2">
          <Bar className="h-3 w-40" />
          <Bar className="h-7 w-72 max-w-full" />
          <Bar className="h-4 w-96 max-w-full" />
        </div>
      </PageHeader>
      <PageBody>
        <Bar className="h-24 w-full" />
        <Bar className="h-64 w-full" />
      </PageBody>
    </div>
  );
}
