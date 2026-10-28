import { APP_NAME } from '@/lib/brand';

// Marco de las pantallas sin sesión (login y primer ingreso), igual al
// login de app.studiomrb.com.
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-y-auto flex items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
