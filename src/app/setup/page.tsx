'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setupVault } from '@/app/actions/vault';
import { 
  deriveMasterKey, 
  generateKeyPair, 
  encryptSymmetric, 
  exportKey, 
  bufferToBase64 
} from '@/lib/crypto';
import { useVault } from '@/components/vault/VaultProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function SetupVaultPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generateRecoveryKey, setGenerateRecoveryKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Setup form, Step 2: Show recovery code
  const [step, setStep] = useState(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { unlockVault } = useVault();

  if (!isLoaded || !userId) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Lockora Password must be at least 12 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      // 1. Generate random salt
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
      const salt = bufferToBase64(saltBuffer.buffer);

      // 2. Derive Master Key
      const mk = await deriveMasterKey(password, salt);

      // 3. Generate Asymmetric Key Pair
      const keyPair = await generateKeyPair();

      // 4. Export Public Key
      const publicKeyRaw = await exportKey(keyPair.publicKey, 'spki');

      // 5. Encrypt Private Key with Master Key
      const privateKeyJwk = await exportKey(keyPair.privateKey, 'jwk');
      const encryptedPrivateKey = await encryptSymmetric(mk, privateKeyJwk);

      // Optional: Generate Recovery Key
      let encryptedPrivateKeyRecovery;
      let generatedRecoveryKey = '';
      if (generateRecoveryKey) {
        // Create a random 24-char alphanumeric recovery key
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const arr = new Uint32Array(24);
        crypto.getRandomValues(arr);
        for (let i = 0; i < 24; i++) generatedRecoveryKey += charset[arr[i] % charset.length];
        
        // Derive a separate Recovery Master Key
        const recoveryMk = await deriveMasterKey(generatedRecoveryKey, salt);
        encryptedPrivateKeyRecovery = await encryptSymmetric(recoveryMk, privateKeyJwk);
      }

      // 6. Send to Server
      await setupVault(undefined, salt, publicKeyRaw, encryptedPrivateKey, encryptedPrivateKeyRecovery);

      // 7. Show recovery key or finish
      if (generatedRecoveryKey) {
        setRecoveryCode(generatedRecoveryKey);
        setStep(2); // Show recovery code step
        unlockVault(mk, keyPair.privateKey);
      } else {
        unlockVault(mk, keyPair.privateKey);
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during setup.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Lockora Recovery Key</CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400 font-semibold">
              Important: Copy this recovery key. It will only be shown once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              If you forget your Lockora Password, you can use this key to decrypt your data. If you lose both your Lockora Password and this key, your data cannot be recovered.
            </p>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded font-mono text-center text-lg tracking-wider break-all border border-zinc-200 dark:border-zinc-800 select-all">
              {recoveryCode}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              I have saved my recovery key safely
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Set up Lockora Security</CardTitle>
          <CardDescription>
            Create a strong Lockora Password. This is separate from your account password.
            <br/><br/>
            <strong className="text-red-500 dark:text-red-400">WARNING:</strong> If you lose this password, your secrets cannot be recovered.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSetup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Lockora Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter at least 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input 
                id="confirm" 
                type="password" 
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="recovery" 
                checked={generateRecoveryKey} 
                onChange={e => setGenerateRecoveryKey(e.target.checked)} 
                className="rounded" 
              />
              <Label htmlFor="recovery" className="font-normal text-sm">Generate a backup recovery key</Label>
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400 font-medium">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Securing Data...' : 'Initialize Lockora'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
