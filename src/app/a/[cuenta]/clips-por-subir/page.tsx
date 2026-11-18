import { redirect } from 'next/navigation';

// Los clips por subir están en Por subir, con el resto de los cambios.
export default async function ClipUploadsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  redirect(`/a/${cuenta}/pipeline?vista=por-subir`);
}
