'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getVaultConfig, setupVault } from '@/app/actions/vault';
import { createSecret } from '@/app/actions/secrets';
import { 
  deriveMasterKey,
  generateKeyPair,
  generateSecretDataKey, 
  encryptSymmetric, 
  decryptSymmetric,
  encryptAsymmetric, 
  exportKey, 
  importKey,
  bufferToBase64
} from '@/lib/crypto';
import { useVault } from '@/components/vault/VaultProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { PlusCircle, Trash2, Eye, EyeOff, CheckCircle2, AlertTriangle, Shield, KeyRound, Lock, ArrowLeft, RefreshCw } from 'lucide-react';

type FlowStep = 'checking' | 'create_lockora_password' | 'enter_lockora_password' | 'form' | 'confirm';

function calculatePasswordStrength(pwd: string): { score: number; label: string; color: string; widthClass: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-zinc-700', widthClass: 'w-0' };
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500', widthClass: 'w-1/4' };
  if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500', widthClass: 'w-2/4' };
  if (score === 4) return { score, label: 'Good', color: 'bg-blue-500', widthClass: 'w-3/4' };
  return { score, label: 'Strong', color: 'bg-emerald-500', widthClass: 'w-full' };
}

export default function CreateSecretPage() {
  const router = useRouter();
  const { isUnlocked, masterKey, privateKey, unlockVault } = useVault();

  const [step, setStep] = useState<FlowStep>('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lockora Password Setup / Unlock States
  const [lockoraPassword, setLockoraPassword] = useState('');
  const [confirmLockoraPassword, setConfirmLockoraPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Vault Config State
  const [vaultConfig, setVaultConfig] = useState<any>(null);

  // Secret Form States
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Password');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<{ name: string; value: string }[]>([]);
  const [expiryAt, setExpiryAt] = useState('');
  const [requiresRotation, setRequiresRotation] = useState(false);

  // Check setup & lock status on mount
  useEffect(() => {
    async function initCheck() {
      try {
        const config = await getVaultConfig();
        setVaultConfig(config);

        if (!config.isSetup) {
          // New User: Prompt to create Lockora Password
          setStep('create_lockora_password');
        } else if (!isUnlocked) {
          // Existing User: Prompt for Lockora Password
          setStep('enter_lockora_password');
        } else {
          // Already unlocked for this session: Proceed straight to secret form
          setStep('form');
        }
      } catch (err: any) {
        console.error('Failed to load security status:', err);
        setError('Unable to load security status. Please try again.');
        setStep('checking');
      }
    }
    initCheck();
  }, [isUnlocked]);

  // Handle Creating New Lockora Password (New User)
  const handleCreateLockoraPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lockoraPassword.length < 8) {
      setError('Lockora Password must be at least 8 characters long.');
      return;
    }

    if (lockoraPassword !== confirmLockoraPassword) {
      setError('Lockora Password and Confirm Password do not match.');
      return;
    }

    try {
      setLoading(true);

      const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
      const salt = bufferToBase64(saltBuffer.buffer);

      const mk = await deriveMasterKey(lockoraPassword, salt);
      const keyPair = await generateKeyPair();
      const publicKeyRaw = await exportKey(keyPair.publicKey, 'spki');
      const privateKeyJwk = await exportKey(keyPair.privateKey, 'jwk');
      const encryptedPrivateKey = await encryptSymmetric(mk, privateKeyJwk);

      await setupVault(undefined, salt, publicKeyRaw, encryptedPrivateKey);

      unlockVault(mk, keyPair.privateKey);

      setVaultConfig({
        isSetup: true,
        vaultSalt: salt,
        publicKey: publicKeyRaw,
        encryptedPrivateKey,
      });

      // Continue directly to secret creation form
      setStep('form');
    } catch (err: any) {
      console.error('Lockora Password setup error:', err);
      setError(err.message || 'Failed to create Lockora Password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verification of Lockora Password (Existing User)
  const handleVerifyLockoraPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!vaultConfig || !vaultConfig.vaultSalt || !vaultConfig.encryptedPrivateKey) {
      setError('Lockora security configuration missing.');
      return;
    }

    try {
      setLoading(true);

      const mk = await deriveMasterKey(lockoraPassword, vaultConfig.vaultSalt);
      let privateKeyJwk;
      try {
        privateKeyJwk = await decryptSymmetric(mk, vaultConfig.encryptedPrivateKey);
      } catch {
        setError('Incorrect Lockora Password.');
        setLoading(false);
        return;
      }

      const pk = await importKey(
        privateKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        ['decrypt'],
        'jwk'
      );

      unlockVault(mk, pk);

      // Continue directly to secret creation form
      setStep('form');
    } catch (err: any) {
      console.error('Lockora Password verification error:', err);
      setError('Incorrect Lockora Password.');
    } finally {
      setLoading(false);
    }
  };

  // Custom Fields Handlers
  const addCustomField = () => setCustomFields([...customFields, { name: '', value: '' }]);
  const removeCustomField = (index: number) => {
    const updated = [...customFields];
    updated.splice(index, 1);
    setCustomFields(updated);
  };
  const updateCustomField = (index: number, key: 'name' | 'value', val: string) => {
    const updated = [...customFields];
    updated[index][key] = val;
    setCustomFields(updated);
  };

  // Review Form Submission
  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Secret Name is required.');
      return;
    }
    const hasData = notes.trim() !== '' || customFields.some(f => f.name.trim() !== '' && f.value.trim() !== '');
    if (!hasData) {
      setError('Please provide at least one sensitive field or note.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  // Save Encrypted Secret
  const handleSaveSecurely = async () => {
    if (!vaultConfig?.publicKey) {
      setError('Public encryption key is missing. Cannot encrypt secret.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const sdk = await generateSecretDataKey();

      const payload = JSON.stringify({
        notes: notes,
        customFields: customFields.filter(f => f.name.trim() !== '' || f.value.trim() !== ''),
      });

      const encryptedData = await encryptSymmetric(sdk, payload);

      const pk = await importKey(
        vaultConfig.publicKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        ['encrypt'],
        'spki'
      );

      const sdkRaw = await exportKey(sdk, 'raw');
      const encryptedSdk = await encryptAsymmetric(pk, sdkRaw);

      await createSecret({
        name,
        category,
        tags: '[]',
        encryptedData,
        encryptedDataKey: encryptedSdk,
        expiryAt: expiryAt ? new Date(expiryAt).toISOString() : undefined,
        requiresRotation,
      });

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Failed to save secret:', err);
      setError(err.message || 'An error occurred while saving.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const strength = calculatePasswordStrength(lockoraPassword);

  // 1. INITIAL CHECKING STATE
  if (step === 'checking') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 relative z-10">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Verifying security configuration...</p>
      </div>
    );
  }

  // 2. CREATE LOCKORA PASSWORD (NEW USER)
  if (step === 'create_lockora_password') {
    return (
      <div className="max-w-md mx-auto my-8 relative z-10">
        <Card className="shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <KeyRound className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Create your Lockora Password
            </CardTitle>
            <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This password protects your Lockora secrets and is separate from your Clerk account password.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleCreateLockoraPassword}>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">Keep this password safe:</strong>
                  If lost without a recovery key, your encrypted secrets cannot be recovered.
                </div>
              </div>

              {/* Lockora Password */}
              <div className="space-y-1.5">
                <Label htmlFor="lockoraPassword" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Lockora Password
                </Label>
                <div className="relative">
                  <Input
                    id="lockoraPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={lockoraPassword}
                    onChange={(e) => setLockoraPassword(e.target.value)}
                    required
                    minLength={8}
                    className="font-mono pr-10 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {lockoraPassword.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">Password Strength:</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${strength.color} ${strength.widthClass}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmLockoraPassword" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Confirm Lockora Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmLockoraPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmLockoraPassword}
                    onChange={(e) => setConfirmLockoraPassword(e.target.value)}
                    required
                    className="font-mono pr-10 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {confirmLockoraPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs pt-0.5">
                    {lockoraPassword === confirmLockoraPassword ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={loading || lockoraPassword.length < 8 || lockoraPassword !== confirmLockoraPassword}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md py-2.5"
              >
                {loading ? 'Creating Lockora Password...' : 'Create Lockora Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/dashboard')}
                className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // 3. ENTER LOCKORA PASSWORD (EXISTING USER)
  if (step === 'enter_lockora_password') {
    return (
      <div className="max-w-md mx-auto my-12 relative z-10">
        <Card className="shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Lock className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Enter your Lockora Password
            </CardTitle>
            <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400">
              Enter your Lockora Password to continue adding your secret.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleVerifyLockoraPassword}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="verifyPassword" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Lockora Password
                </Label>
                <Input
                  id="verifyPassword"
                  type="password"
                  placeholder="Lockora Password"
                  value={lockoraPassword}
                  onChange={(e) => setLockoraPassword(e.target.value)}
                  required
                  autoFocus
                  className="font-mono bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 focus:border-indigo-500"
                />
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-medium">
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={loading || !lockoraPassword}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md py-2.5"
              >
                {loading ? 'Verifying...' : 'Continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/dashboard')}
                className="w-full text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // 4. CONFIRM & REVIEW STEP
  if (step === 'confirm') {
    return (
      <div className="max-w-xl mx-auto my-10 p-4 relative z-10">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Review & Save</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Please review the details below. Sensitive data will be encrypted before saving.</p>
          </div>
          
          <div className="space-y-4 bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium text-sm">Name</span>
              <span className="text-zinc-900 dark:text-white font-semibold">{name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium text-sm">Category</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium text-sm">Sensitive Fields</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{customFields.filter(f => f.name.trim() !== '').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium text-sm">Expiry</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{expiryAt ? new Date(expiryAt).toLocaleDateString() : 'None'}</span>
            </div>
          </div>

          {error && <div className="text-red-500 dark:text-red-400 text-sm text-center font-medium">{error}</div>}

          <div className="flex gap-4 pt-4">
            <Button variant="outline" className="flex-1 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300" onClick={() => setStep('form')} disabled={loading}>
              Cancel
            </Button>
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60" onClick={handleSaveSecurely} disabled={loading}>
              {loading ? 'Saving Encrypted...' : 'Save Securely'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 5. CREATE NEW SECRET FORM STATE
  return (
    <div className="max-w-2xl mx-auto w-full mb-10 px-4 md:px-0 relative z-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Create New Secret</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Protected by your Lockora security layer.</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-6 md:p-8 shadow-2xl">
        <form onSubmit={handleReview} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300 font-semibold">Secret Name</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AWS Production API Key" className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300 font-semibold">Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as string)}>
                <SelectTrigger className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
                  <SelectItem value="Password">Password</SelectItem>
                  <SelectItem value="API Key">API Key</SelectItem>
                  <SelectItem value="Access Token">Access Token</SelectItem>
                  <SelectItem value="SSH Key">SSH Key</SelectItem>
                  <SelectItem value="Note">Secure Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Sensitive Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <Label className="text-zinc-900 dark:text-white font-semibold">Sensitive Fields</Label>
            </div>

            {customFields.length > 0 && (
              <div className="hidden sm:flex gap-3 px-1">
                <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">Field Name</div>
                <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">Field Value</div>
                <div className="w-9"></div>
              </div>
            )}

            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-zinc-50 dark:bg-zinc-950/30 p-3 sm:p-0 sm:bg-transparent rounded-lg">
                  <Input 
                    placeholder="Field Name (e.g. Username, API Key)" 
                    value={field.name} 
                    onChange={e => updateCustomField(index, 'name', e.target.value)} 
                    className="sm:flex-1 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" 
                  />
                  <Input 
                    placeholder="Field Value" 
                    type="password" 
                    value={field.value} 
                    onChange={e => updateCustomField(index, 'value', e.target.value)} 
                    className="sm:flex-1 font-mono bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" 
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeCustomField(index)} 
                    className="shrink-0 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 self-end sm:self-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addCustomField} 
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              <PlusCircle className="w-4 h-4 mr-2" /> Add Sensitive Field
            </Button>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Label className="text-zinc-700 dark:text-zinc-300 font-semibold">Notes (Optional)</Label>
            <Textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Additional sensitive notes..." 
              className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white min-h-[100px]" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300 font-semibold">Expiry Date</Label>
              <Input 
                type="date" 
                value={expiryAt} 
                onChange={e => setExpiryAt(e.target.value)} 
                className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" 
              />
            </div>
            <div className="flex items-center space-x-3 md:mt-8">
              <input 
                type="checkbox" 
                id="rotation" 
                checked={requiresRotation} 
                onChange={e => setRequiresRotation(e.target.checked)} 
                className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4" 
              />
              <Label htmlFor="rotation" className="text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium">Requires periodic rotation</Label>
            </div>
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm font-medium">{error}</p>}
          
          <div className="pt-6 flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 h-10 font-semibold">
              Review & Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
