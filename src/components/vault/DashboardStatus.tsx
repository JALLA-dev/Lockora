'use client';

import { useVault } from '@/components/vault/VaultProvider';
import { Lock } from 'lucide-react';

export function DashboardProtectionStatus() {
  const { isUnlocked } = useVault();

  if (isUnlocked) {
    return (
      <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/95 dark:bg-emerald-900/20 backdrop-blur-md shadow-lg transition-colors">
        <div className="text-sm font-medium text-emerald-700 dark:text-emerald-500">Lockora Protection</div>
        <div className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mt-1 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          ● Active
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg transition-colors">
      <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Lockora Protection</div>
      <div className="text-lg font-bold text-zinc-900 dark:text-white mt-1 flex items-center gap-2">
        <Lock className="w-4 h-4" />
        Locked
      </div>
    </div>
  );
}
