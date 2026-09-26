'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getVaultConfig } from '@/app/actions/vault';
import { createSecret } from '@/app/actions/secrets';
import { 
  generateSecretDataKey, 
  encryptSymmetric, 
  encryptAsymmetric, 
  exportKey, 
  importKey 
} from '@/lib/crypto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';

export default function CreateSecretPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Password');
  const [notes, setNotes] = useState('');
  
  // Sensitive Fields
  const [customFields, setCustomFields] = useState<{name: string, value: string}[]>([]);
  const [expiryAt, setExpiryAt] = useState('');
  const [requiresRotation, setRequiresRotation] = useState(false);
  
  const [publicKeyRaw, setPublicKeyRaw] = useState<string | null>(null);

  const [publicKeyError, setPublicKeyError] = useState('');
  const [isRetryingKey, setIsRetryingKey] = useState(false);

  const loadPubKey = async () => {
    try {
      setIsRetryingKey(true);
      setPublicKeyError('');
      const config = await getVaultConfig();
      if (config.isSetup && config.publicKey) {
        setPublicKeyRaw(config.publicKey);
      } else {
        setPublicKeyError('Public key not found in configuration.');
      }
    } catch (err: any) {
      console.error('Failed to load public key:', err);
      setPublicKeyError('Secure encryption could not be initialized.');
    } finally {
      setIsRetryingKey(false);
    }
  };

  useEffect(() => {
    loadPubKey();
  }, []);

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

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const hasData = notes.trim() !== '' || customFields.some(f => f.name.trim() !== '' && f.value.trim() !== '');
    if (!hasData) {
      setError('You must provide at least one sensitive field or note.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleSaveSecurely = async () => {
    if (!publicKeyRaw) {
      setError('Secure encryption could not be initialized. Your secret was NOT saved.');
      return;
    }

    try {
      setLoading(true);

      const sdk = await generateSecretDataKey();

      const payload = JSON.stringify({
        notes: notes,
        customFields: customFields.filter(f => f.name.trim() !== '' || f.value.trim() !== ''),
      });

      const encryptedData = await encryptSymmetric(sdk, payload);

      const pk = await importKey(
        publicKeyRaw,
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
      setError(err.message || 'An error occurred while saving.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'confirm') {
    return (
      <div className="max-w-xl mx-auto mt-10 p-4 relative z-10">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Save this secret?</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Please confirm the details below. Sensitive data will be encrypted securely before leaving your device.</p>
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

          {error && <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>}

          {publicKeyError && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md p-4 text-center space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                {publicKeyError}
              </p>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={loadPubKey}
                disabled={isRetryingKey}
                className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                {isRetryingKey ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button variant="outline" className="flex-1 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300" onClick={() => setStep('form')} disabled={loading}>
              Cancel
            </Button>
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 disabled:cursor-not-allowed" onClick={handleSaveSecurely} disabled={loading || !publicKeyRaw}>
              {loading ? 'Securing...' : 'Save Securely'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full mb-10 px-4 md:px-0 relative z-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Create New Secret</h2>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-6 md:p-8 shadow-2xl">
        <form onSubmit={handleReview} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300">Secret Name</Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amazon" className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300">Category</Label>
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
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <Label className="text-zinc-900 dark:text-white font-semibold">Sensitive Fields</Label>
            </div>
            
            <div className="hidden sm:flex gap-3 px-1">
              <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">Field Name</div>
              <div className="flex-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">Field Value</div>
              <div className="w-9"></div>
            </div>

            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-zinc-50 dark:bg-zinc-950/30 p-3 sm:p-0 sm:bg-transparent rounded-lg">
                  <Input placeholder="Field Name (e.g. Username)" value={field.name} onChange={e => updateCustomField(index, 'name', e.target.value)} className="sm:flex-1 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                  <Input placeholder="••••••••" type="password" value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)} className="sm:flex-1 font-mono bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomField(index)} className="shrink-0 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 self-end sm:self-auto">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCustomField} className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">
              <PlusCircle className="w-4 h-4 mr-2" /> Add Sensitive Field
            </Button>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Label className="text-zinc-700 dark:text-zinc-300">Notes (Optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional sensitive notes..." className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white min-h-[100px]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300">Expiry Date</Label>
              <Input type="date" value={expiryAt} onChange={e => setExpiryAt(e.target.value)} className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
            </div>
            <div className="flex items-center space-x-3 md:mt-8">
              <input type="checkbox" id="rotation" checked={requiresRotation} onChange={e => setRequiresRotation(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
              <Label htmlFor="rotation" className="text-zinc-700 dark:text-zinc-300 cursor-pointer font-medium">Requires periodic rotation</Label>
            </div>
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
          
          <div className="pt-6 flex justify-end border-t border-zinc-200 dark:border-zinc-800">
            <Button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 h-10">Review & Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
