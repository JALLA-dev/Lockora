'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVault } from './VaultProvider';
import { getVaultConfig } from '@/app/actions/vault';
import Image from 'next/image';

type VaultState = 'checking' | 'ready' | 'error';

const TIMEOUT_MS = 15_000; // 15 seconds max before showing error

export function VaultGuard({ children }: { children: React.ReactNode }) {
  const { isUnlocked } = useVault();
  const router = useRouter();
  const [state, setState] = useState<VaultState>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const inFlightRef = useRef(false);

  const checkVault = useCallback(async () => {
    // Prevent duplicate concurrent requests
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setState('checking');
    setErrorMessage('');

    // Timeout fail-safe
    const timeoutId = setTimeout(() => {
      if (inFlightRef.current) {
        inFlightRef.current = false;
        setState('error');
        setErrorMessage('Request timed out. Please check your connection and try again.');
      }
    }, TIMEOUT_MS);

    try {
      const config = await getVaultConfig();
      clearTimeout(timeoutId);
      inFlightRef.current = false;

      if (!config.isSetup) {
        router.push('/setup');
        return;
      }

      setState('ready');
    } catch (err: any) {
      clearTimeout(timeoutId);
      inFlightRef.current = false;

      // Log server-safe message only — do not expose stack traces
      console.error('[LockoraSetupGuard] Setup status check failed:', err?.message ?? 'Unknown error');

      // Show user-safe message
      setState('error');
      if (err?.message?.includes('Unauthorized')) {
        setErrorMessage('Your session has expired. Please sign in again.');
      } else {
        setErrorMessage('Unable to load Lockora. Please try again.');
      }
    }
  }, [router]);

  useEffect(() => {
    checkVault();
    // We only want this to run on mount and when isUnlocked changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkVault();
    setIsRetrying(false);
  };

  const handleSignInAgain = () => {
    router.push('/sign-in');
  };

  if (state === 'checking') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-white dark:bg-zinc-950">
        <div className="relative flex items-center justify-center">
          {/* Subtle rotating security shield/ring */}
          <div className="absolute h-24 w-24 animate-spin-slow rounded-full border border-transparent border-t-indigo-500 border-b-indigo-500 opacity-50" />
          <div className="absolute h-20 w-20 animate-reverse-spin rounded-full border border-transparent border-l-violet-500 border-r-violet-500 opacity-40" />
          {/* Logo in center */}
          <Image
            src="/lockora-icon.svg"
            alt="Lockora"
            width={64}
            height={64}
            className="rounded-xl shadow-lg relative z-10"
          />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Lockora</h2>
          <p className="text-sm font-medium tracking-widest text-zinc-500 dark:text-zinc-400 uppercase">
            Loading Lockora...
          </p>
        </div>
        
        {/* Optional timeout hint */}
        <div className="mt-8 h-10 flex items-center justify-center opacity-0 animate-fade-in-delayed">
           <div className="flex flex-col items-center gap-2">
             <span className="text-xs text-zinc-400">Taking longer than expected</span>
             <button onClick={handleRetry} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
               Retry
             </button>
           </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-white dark:bg-zinc-950 px-4 text-center">
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md">
          <Image
            src="/lockora-icon.svg"
            alt="Lockora"
            width={48}
            height={48}
            className="rounded-lg opacity-60 grayscale"
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Connection Error</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">Lockora could not load your protected access status.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
          {errorMessage.includes('session') && (
            <button
              onClick={handleSignInAgain}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-sm"
            >
              Sign In Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
