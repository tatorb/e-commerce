import { AppFrame } from '@/components/dashboard/AppFrame';

export default async function AccountLayout({
  params,
  children,
}: {
  params: Promise<{ cuenta: string }>;
  children: React.ReactNode;
}) {
  const { cuenta } = await params;
  return <AppFrame accountSlug={cuenta}>{children}</AppFrame>;
}
