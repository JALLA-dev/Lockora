'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { getVaultConfig, recordVaultUnlockAttempt, checkUnlockRateLimit } from '@/app/actions/vault';
import { 
  deriveMasterKey, 
  decryptSymmetric, 
  importKey
} from '@/lib/crypto';
import { useVault } from '@/components/vault/VaultProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import Image from 'next/image';

export default function UnlockVaultPage() {
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [rateLimitMsg, setRateLimitMsg] = useState('');
  const [vaultConfig, setVaultConfig] = useState<any>(null);
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { unlockVault, isUnlocked } = useVault();

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await getVaultConfig();
        if (!config.isSetup) {
          router.push('/setup');
          return;
        }
        if (isUnlocked) {
          router.push('/dashboard');
          return;
        }

        // Check rate limit on page load so the user can see they're locked out
        const rateCheck = await checkUnlockRateLimit();
        if (!rateCheck.allowed) {
          setRateLimitMsg(
            `Too many failed attempts. Please wait ${rateCheck.minutesRemaining} minute${rateCheck.minutesRemaining !== 1 ? 's' : ''} before trying again.`
          );
        }

        setVaultConfig(config);
      } catch (err) {
        console.error('[UnlockPage] Failed to load vault config:', err);
        setError('Unable to load vault. Please try refreshing the page.');
      } finally {
        setChecking(false);
      }
    }
    if (isLoaded && userId) {
      loadConfig();
    }
  }, [isLoaded, userId, isUnlocked, router]);

  if (!isLoaded || checking) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-zinc-950 relative z-10">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-indigo-500 border-r-violet-500 opacity-80" />
          <Image src="/lockora-icon.png" alt="Lockora" width={48} height={48} className="rounded-xl" />
        </div>
        <p className="text-sm font-medium tracking-widest text-zinc-400 uppercase">Loading Lockora...</p>
      </div>
    );
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!vaultConfig) return;

    try {
      setLoading(true);
      
      // Check rate limit before attempting decryption
      const rateCheck = await checkUnlockRateLimit();
      if (!rateCheck.allowed) {
        setRateLimitMsg(
          `Too many failed attempts. Please wait ${rateCheck.minutesRemaining} minute${rateCheck.minutesRemaining !== 1 ? 's' : ''} before trying again.`
        );
        return;
      }
      setRateLimitMsg('');

      const encryptedPk = useRecovery ? vaultConfig.encryptedPrivateKeyRecovery : vaultConfig.encryptedPrivateKey;
      
      if (useRecovery && !encryptedPk) {
        throw new Error('No recovery key was generated for this vault.');
      }
      
      if (!encryptedPk) {
        throw new Error('Vault is missing key material.');
      }

      // 1. Derive Master Key
      const mk = await deriveMasterKey(password, vaultConfig.vaultSalt);

      // 2. Decrypt Private Key
      let privateKeyJwk;
      try {
        privateKeyJwk = await decryptSymmetric(mk, encryptedPk);
      } catch (decryptErr) {
        await recordVaultUnlockAttempt(false);

        // Re-check rate limit after this failure to inform user immediately
        const newRateCheck = await checkUnlockRateLimit();
        if (!newRateCheck.allowed) {
          setRateLimitMsg(
            `Too many failed attempts. Please wait ${newRateCheck.minutesRemaining} minute${newRateCheck.minutesRemaining !== 1 ? 's' : ''} before trying again.`
          );
          return;
        }

        throw new Error(useRecovery ? 'Invalid recovery key.' : 'Incorrect Lockora Password.');
      }

      // 3. Import Private Key
      const privateKey = await importKey(
        privateKeyJwk,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        ['decrypt'],
        'jwk'
      );

      // 4. Record Success & Unlock
      await recordVaultUnlockAttempt(true);
      unlockVault(mk, privateKey);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('[UnlockPage] Unlock failed:', err?.message);
      setError(err.message || 'An error occurred while unlocking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 p-4 relative z-10">
      <div className="w-full max-w-md space-y-6">
        {/* Header with logo */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/lockora-icon.png" alt="Lockora" width={56} height={56} className="rounded-2xl" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Lockora</h1>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold text-white">Secure Your Lockora</CardTitle>
            <CardDescription className="text-zinc-400">
              {useRecovery 
                ? 'Enter your 24-character backup recovery key to restore access.' 
                : 'Enter your Lockora Password to access your protected secrets.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleUnlock}>
            <CardContent className="space-y-4">
              {/* Distinction callout */}
              <div className="rounded-lg border border-indigo-800/50 bg-indigo-950/40 px-3 py-2 text-xs text-indigo-300">
                Your <span className="font-semibold">Lockora Password</span> is separate from your account login.
              </div>

              {rateLimitMsg && (
                <div className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-300 font-medium">
                  🔒 {rateLimitMsg}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">
                  {useRecovery ? 'Recovery Key' : 'Lockora Password'}
                </Label>
                <Input 
                  id="password" 
                  type={useRecovery ? 'text' : 'password'}
                  placeholder={useRecovery ? 'e.g. A1B2C3...' : 'Lockora Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!!rateLimitMsg}
                  className="font-mono bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={() => { setUseRecovery(!useRecovery); setPassword(''); setError(''); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
                >
                  {useRecovery ? 'Use Lockora Password instead' : 'Lost your password? Use Recovery Key'}
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-400 font-medium">{error}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold" 
                disabled={loading || !!rateLimitMsg}
              >
                {loading ? 'Securing...' : 'Secure Access'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
