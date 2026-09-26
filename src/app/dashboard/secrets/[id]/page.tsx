import { getSecret } from '@/app/actions/secrets';
import { SecretDetail } from '@/components/secrets/SecretDetail';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function SecretPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const secret = await getSecret(params.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">← Back to Vault</Button>
        </Link>
      </div>
      
      <SecretDetail secret={secret} />
    </div>
  );
}
