import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { signOut } from '@/lib/auth/actions';

// Pie del sidebar con la persona que está usando la app, como en
// app.studiomrb.com. Debajo del nombre va el email en lugar del rol.
export function SessionFooter({ name, email }: { name: string; email: string }) {
  return (
    <div className="mt-auto">
      <Separator className="my-2" />
      <div className="px-2 py-2 flex items-center justify-between gap-2 md:group-data-[collapsed=true]:flex-col md:group-data-[collapsed=true]:gap-1">
        <div className="min-w-0 md:group-data-[collapsed=true]:hidden">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <form action={signOut} className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
