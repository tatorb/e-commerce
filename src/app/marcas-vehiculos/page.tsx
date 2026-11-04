import { CarFront } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { SectionBody, SectionCard } from '@/components/ui/section-card';
import { BrandListEditor } from '@/components/text-images/BrandListEditor';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { brandLogoHref, brandUsage, listBrands } from '@/lib/text-images/brands';

// Marcas de vehículos: la base que usan las imágenes con texto, la misma para
// todas las cuentas. La ve todo el equipo; la cambia un administrador.

export const metadata = { title: 'Marcas de vehículos' };

export const dynamic = 'force-dynamic';

export default async function VehicleBrandsPage() {
  const me = await requireUser();
  const [brands, usage] = await Promise.all([listBrands(prisma), brandUsage(prisma)]);
  const withoutLogo = brands.filter((b) => !b.hasLogo).length;
  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Marcas de vehículos</h1>
          <p className="text-sm text-muted-foreground">
            Las marcas que muestran las imágenes con texto, con su logo. Es la misma lista para todos los clientes. Los alias son otros nombres con que aparece
            la marca, para que la IA la reconozca, por ejemplo VW para Volkswagen.
            {me.isAdmin ? '' : ' Solo un administrador la puede cambiar.'}
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <SectionCard
          title="Marcas"
          icon={<CarFront />}
          count={brands.length}
          description={withoutLogo > 0 ? `${withoutLogo === 1 ? '1 marca no tiene' : `${withoutLogo} marcas no tienen`} logo: en la imagen va su nombre en chico.` : 'Todas tienen logo.'}
        >
          <SectionBody>
            <BrandListEditor
              canWrite={me.isAdmin}
              brands={brands.map((b) => ({
                key: b.key,
                name: b.name,
                aliases: b.aliases,
                logo: brandLogoHref(b.key, b.logoUpdatedAt),
                used: usage.get(b.key) ?? 0,
              }))}
            />
          </SectionBody>
        </SectionCard>
      </PageBody>
    </>
  );
}
