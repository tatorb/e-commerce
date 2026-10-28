import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { PageBody } from '@/components/dashboard/PageBody';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnswerSettingsForm } from '@/components/settings/AnswerSettingsForm';
import { accountForTitle, requireAccount } from '@/lib/auth/account';
import { formatDateTime } from '@/lib/format';
import { loadAnswerSettings } from '@/lib/queries/questions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const account = await accountForTitle(cuenta);
  return { title: account ? `Respuestas · ${account.name}` : 'Respuestas' };
}

export default async function AnswerSettingsPage({ params }: { params: Promise<{ cuenta: string }> }) {
  const { cuenta } = await params;
  const { account } = await requireAccount(cuenta, 'respuestas');
  const row = await loadAnswerSettings(account.id);

  return (
    <>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Respuestas</h1>
          <p className="text-sm text-muted-foreground">
            Cómo responde <strong>{account.name}</strong> las preguntas de los compradores. Claude lo usa para proponer cada respuesta en{' '}
            <Link href={`/a/${account.slug}/preguntas`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Preguntas
            </Link>
            . También copia el tono de las respuestas que ya se dieron.
          </p>
        </div>
      </PageHeader>
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Cómo responde la tienda</CardTitle>
            <CardDescription>
              {row ? `Guardado el ${formatDateTime(row.updatedAt, account.timezone)}.` : 'Todavía no se cargó nada: Claude saluda corto y no firma.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnswerSettingsForm
              accountSlug={account.slug}
              initial={{
                greeting: row?.greeting ?? '',
                signature: row?.signature ?? '',
                tone: row?.tone ?? '',
                notes: row?.notes ?? '',
                autoDraft: row?.autoDraft ?? true,
              }}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
