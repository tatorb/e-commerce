import { redirect } from 'next/navigation';
import { requireAccount } from '@/lib/auth/account';

// Los clips por subir están en Por subir, con el resto de los cambios.
export default async function ClipUploadsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'pipeline');
  redirect(`/a/${account.slug}/pipeline?vista=por-subir`);
}
