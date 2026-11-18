import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { ClipUploadList } from '@/components/clips/ClipUploadList';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { offerApprovedClips, pendingClipUploads } from '@/lib/clip-uploads';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Clips por subir · ${account.name}` : 'Clips por subir' };
}

export default async function ClipUploadsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'pipeline');
  // Los clips aprobados antes de que existiera esta pantalla entran acá, una sola vez.
  await offerApprovedClips(prisma, account.id);
  const clips = await pendingClipUploads(prisma, account.id);

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Clips por subir</h1>
          <p className="text-sm text-muted-foreground">
            Los clips aprobados de <strong>{account.name}</strong> que falta subir a Mercado Libre. Mercado Libre no deja subirlos desde la app a las cuentas locales, así que se suben desde tu Chrome. Con la
            extensión de Studio MRB, un botón abre la publicación y carga el archivo solo. Sin ella, bajá el archivo, abrí la publicación en Mercado Libre y subilo desde su menú de opciones. Al
            terminar, marcalo acá.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <ClipUploadList
          accountSlug={account.slug}
          clips={clips.map((c) => ({
            publicationId: c.publicationId,
            videoId: c.videoId,
            title: c.title,
            product: c.product,
            externalId: c.externalId,
            measure: c.measure,
            channelLink: c.channelLink,
            fileName: c.fileName,
            mimeType: c.mimeType,
            downloadLink: c.downloadLink,
            durationMs: c.durationMs,
            size: c.size,
          }))}
        />
      </PageBody>
    </>
  );
}
