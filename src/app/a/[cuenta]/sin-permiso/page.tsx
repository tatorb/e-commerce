import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card } from '@/components/ui/card';
import { firstSection, isSection, SECTION_PATH, SECTIONS } from '@/domain/access';
import { requireAccount } from '@/lib/auth/account';

export const metadata = { title: 'Sin permiso' };

// Adonde llega quien entra a una sección que su usuario no puede ver.
export default async function NoAccessPage({ params, searchParams }: { params: Promise<{ cuenta: string }>; searchParams: Promise<{ seccion?: string }> }) {
  const [{ cuenta }, { seccion }] = await Promise.all([params, searchParams]);
  const { user, account } = await requireAccount(cuenta);
  const first = firstSection(user.access);
  const name = isSection(seccion) ? SECTIONS[seccion].label : null;
  return (
    <>
      <PageHeader className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Sin permiso</h1>
      </PageHeader>
      <PageBody className="max-w-3xl">
        <Card className="space-y-2 p-6 text-sm">
          <p>{name ? `Tu usuario no puede ver ${name} en ${account.name}.` : `Tu usuario no puede ver ninguna sección de ${account.name}.`}</p>
          <p className="text-muted-foreground">Si lo necesitás, pedile el permiso a un administrador.</p>
          <p>
            <Link href={`/a/${account.slug}/${SECTION_PATH[first]}`} className="font-medium underline-offset-4 hover:underline">
              Ir a {SECTIONS[first].label}
            </Link>
          </p>
        </Card>
      </PageBody>
    </>
  );
}
