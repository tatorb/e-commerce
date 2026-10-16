'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu, X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { APP_NAME, BRAND_ICON, BRAND_LOGO } from '@/lib/brand';

interface MobileTopBarProps {
  sidebar: React.ReactNode;
  homeHref: string;
}

// Páginas de detalle: la barra ofrece volver a la lista.
function backHrefFor(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const i = parts.length - 2;
  if (i >= 0 && parts[i] === 'productos') return '/' + parts.slice(0, i + 1).join('/');
  return null;
}

// El título de la página tal como lo armó la metadata ("Productos · Insur"),
// sin la marca.
function useDocumentTitle(): string {
  const [title, setTitle] = React.useState('');
  React.useEffect(() => {
    const suffix = ` · ${APP_NAME}`;
    const read = () => {
      const t = document.title;
      setTitle(t === APP_NAME ? '' : t.endsWith(suffix) ? t.slice(0, -suffix.length) : t);
    };
    read();
    const el = document.querySelector('title');
    if (!el) return;
    const obs = new MutationObserver(read);
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return title;
}

// Barra superior del celular, copiada de app.studiomrb.com.
export function MobileTopBar({ sidebar, homeHref }: MobileTopBarProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = React.useState(pathname);
  const title = useDocumentTitle();
  const backHref = backHrefFor(pathname);

  // Al navegar se cierra el cajón.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background px-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Abrir menú"
            className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72" hideClose>
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SheetDescription className="sr-only">
            Navegación entre cuentas y secciones de la app.
          </SheetDescription>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute right-3 top-5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetClose>
          {sidebar}
        </SheetContent>
      </Sheet>
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Volver"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1 text-center">
        {title ? (
          <span className="block truncate text-sm font-medium">{title}</span>
        ) : (
          <Link href={homeHref} className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_LOGO} alt="Studio MRB" className="h-[1.1rem] w-auto" />
          </Link>
        )}
      </div>
      <Link
        href={homeHref}
        aria-label="Ir al inicio"
        className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_ICON} alt="" className="h-6 w-6 rounded" />
      </Link>
    </div>
  );
}
