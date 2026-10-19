import { redirect } from 'next/navigation';

export default async function AccountHome({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  redirect(`/a/${cuenta}/pipeline`);
}
