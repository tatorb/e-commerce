import { redirect } from 'next/navigation';
import { firstSection, SECTION_PATH } from '@/domain/access';
import { requireAccount } from '@/lib/auth/account';

// La portada de una cuenta: la primera sección que la persona puede ver.
export default async function AccountHome({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { user, account } = await requireAccount(cuenta);
  const first = firstSection(user.access);
  redirect(first ? `/a/${account.slug}/${SECTION_PATH[first]}` : `/a/${account.slug}/sin-permiso`);
}
