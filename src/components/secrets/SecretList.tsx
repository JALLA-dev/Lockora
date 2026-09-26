'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useVault } from '@/components/vault/VaultProvider';

export function SecretList({ secrets }: { secrets: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { isUnlocked } = useVault();

  const filteredSecrets = secrets.filter(secret => {
    const searchLower = searchTerm.toLowerCase();
    return (
      secret.name.toLowerCase().includes(searchLower) ||
      secret.category.toLowerCase().includes(searchLower)
    );
  });

  if (secrets.length === 0) {
    return (
      <div className="text-center p-12 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 relative z-10 shadow-lg">
        <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">Your Lockora is empty.</p>
        <Link href="/dashboard/secrets/new" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
          Add Secret
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative z-10">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
        <Input 
          placeholder="Search safe metadata..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-500 shadow-sm"
        />
      </div>
      
      {filteredSecrets.length === 0 ? (
        <div className="text-center p-8 text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md">
          No secrets match your search.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSecrets.map((secret) => {
            const date = new Date(secret.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            const isExpired = secret.expiryAt ? new Date(secret.expiryAt).getTime() < Date.now() : false;
            const isExpiringSoon = secret.expiryAt ? new Date(secret.expiryAt).getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000 : false;
            
            let statusIndicator = null;
            if (isExpired) {
              statusIndicator = (
                <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                  <span>○ Expired</span>
                </div>
              );
            } else if (isExpiringSoon) {
              statusIndicator = (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Expiring Soon</span>
                </div>
              );
            } else if (isUnlocked) {
              statusIndicator = (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Active</span>
                </div>
              );
            } else {
              statusIndicator = (
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked</span>
                </div>
              );
            }

            return (
              <div key={secret.id} className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md p-5 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors shadow-lg">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                    {isUnlocked ? <Unlock className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-zinc-400" />}
                    {secret.name}
                  </h4>
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-1 pl-6">{secret.category}</p>
                </div>
                <div className="space-y-2 mb-6 flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 rounded-md">
                    <span>Updated:</span>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">{date}</span>
                  </div>
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 rounded-md">
                    <span>Status:</span>
                    {statusIndicator}
                  </div>
                </div>
                <Link 
                  href={`/dashboard/secrets/${secret.id}`}
                  className="w-full py-2.5 text-center text-sm font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700/50 shadow-sm"
                >
                  Open
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
