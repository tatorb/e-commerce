import Link from 'next/link';
import { cookies } from 'next/headers';
import { KanbanSquare, ListChecks, Package, PlugZap, SlidersHorizontal, Type, Upload, Users } from 'lucide-react';
import { NavLink } from '@/components/dashboard/NavLink';
import { SidebarShell } from '@/components/dashboard/SidebarShell';
import { SidebarToggle } from '@/components/dashboard/SidebarToggle';
import {
  SidebarAccountHeader,
  type AccountOption,
} from '@/components/dashboard/SidebarAccountHeader';
import { SessionFooter } from '@/components/auth/SessionFooter';
import { Separator } from '@/components/ui/separator';
import type { CurrentUser } from '@/lib/auth/session';
import { BRAND_ICON, BRAND_LOGO } from '@/lib/brand';

// Menú lateral con la misma estructura que app.studiomrb.com: cabecera fija
// (logo y cuenta), separador, secciones que scrollean y pie fijo con la
// sesión. Tiempos se suma en su fase.
export async function Sidebar({
  user,
  account,
  accounts,
  className,
}: {
  user: CurrentUser;
  account: AccountOption;
  accounts: AccountOption[];
  className?: string;
}) {
  const accountHome = `/a/${account.slug}`;
  const logoHref = `${accountHome}/pipeline`;
  const collapsed = (await cookies()).get('sidebar_collapsed')?.value === '1';

  return (
    <SidebarShell initialCollapsed={collapsed} className={className}>
      {/* CABECERA fija: logo y cuenta. */}
      <div className="shrink-0 px-1 mb-3">
        {/* Expandido: logo y flecha de contraer en la misma línea. */}
        <div className="flex items-center justify-between gap-2 mb-[1.7rem] md:group-data-[collapsed=true]:hidden">
          <Link href={logoHref} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_LOGO} alt="Studio MRB" className="h-[1.3rem] w-auto ml-[0.3rem]" />
          </Link>
          <SidebarToggle />
        </div>
        {/* Contraído: isotipo arriba y la flecha abajo, centrados. */}
        <div className="hidden md:group-data-[collapsed=true]:flex flex-col items-center gap-2 mb-4">
          <Link href={logoHref}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_ICON} alt="Studio MRB" className="h-7 w-7 rounded" />
          </Link>
          <SidebarToggle />
        </div>
        <div className="md:group-data-[collapsed=true]:hidden">
          <SidebarAccountHeader current={account} accounts={accounts} />
        </div>
      </div>

      <Separator className="shrink-0 my-3 md:group-data-[collapsed=true]:hidden" />

      {/* En escritorio, la única región que scrollea. */}
      <div className="md:flex-1 md:min-h-0 md:overflow-y-auto">
        <nav className="flex flex-col gap-0.5">
          <NavLink href={`${accountHome}/pipeline`} label="Pipeline">
            <KanbanSquare className="h-4 w-4" />
          </NavLink>
          <NavLink href={`${accountHome}/productos`} label="Productos">
            <Package className="h-4 w-4" />
          </NavLink>
          <NavLink href={`${accountHome}/publicaciones`} label="Catálogo">
            <ListChecks className="h-4 w-4" />
          </NavLink>
          <NavLink href={`${accountHome}/importar`} label="Importar">
            <Upload className="h-4 w-4" />
          </NavLink>
          <p className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-wide text-muted-foreground font-medium md:group-data-[collapsed=true]:hidden">
            Ajustes
          </p>
          <NavLink href={`${accountHome}/estandar`} label="Estándar">
            <SlidersHorizontal className="h-4 w-4" />
          </NavLink>
          <NavLink href={`${accountHome}/reglas-titulo`} label="Reglas de título">
            <Type className="h-4 w-4" />
          </NavLink>
          <NavLink href={`${accountHome}/conexion`} label="Conexión">
            <PlugZap className="h-4 w-4" />
          </NavLink>
          <p className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-wide text-muted-foreground font-medium md:group-data-[collapsed=true]:hidden">
            Estudio
          </p>
          <NavLink href="/equipo" label="Equipo">
            <Users className="h-4 w-4" />
          </NavLink>
        </nav>
      </div>

      {/* PIE fijo: la persona y cerrar sesión. */}
      <div className="shrink-0">
        <SessionFooter name={user.name} email={user.email} />
      </div>
    </SidebarShell>
  );
}
