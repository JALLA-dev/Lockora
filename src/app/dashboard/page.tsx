import { getVaultConfig } from '@/app/actions/vault';
import { listSecrets } from '@/app/actions/secrets';
import { SecretList } from '@/components/secrets/SecretList';
import { DashboardProtectionStatus } from '@/components/vault/DashboardStatus';
import Link from 'next/link';

export default async function DashboardPage() {
  const config = await getVaultConfig();
  const secrets = await listSecrets();
  
  const activeSecrets = secrets;
  const totalSecrets = activeSecrets.length;
  const recentSecrets = activeSecrets.filter(s => 
    new Date(s.updatedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">My Lockora</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Secure metadata overview.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Secrets</div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">{totalSecrets}</div>
        </div>
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Recently Updated</div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">{recentSecrets}</div>
        </div>
        <DashboardProtectionStatus />
      </div>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">Stored Secrets</h3>
          <Link 
            href="/dashboard/secrets/new"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add New Secret
          </Link>
        </div>
        
        <SecretList secrets={activeSecrets} />
      </div>
    </div>
  );
}
