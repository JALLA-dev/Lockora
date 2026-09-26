'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { recordSecretReveal, recordSecretCopy, deleteSecret, updateSecret } from '@/app/actions/secrets';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useVault } from '@/components/vault/VaultProvider';
import { 
  decryptAsymmetric, 
  encryptAsymmetric,
  decryptSymmetric, 
  encryptSymmetric,
  importKey,
  deriveMasterKey,
  exportKey,
  generateSecretDataKey
} from '@/lib/crypto';
import { getVaultConfig } from '@/app/actions/vault';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Trash2 } from 'lucide-react';

export function SecretDetail({ secret }: { secret: any }) {
  const router = useRouter();
  const { isUnlocked, privateKey, unlockVault } = useVault();

  // Reveal state
  const [revealedData, setRevealedData] = useState<{value?: string, notes?: string, customFields?: {name: string, value: string}[]} | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expireAt, setExpireAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState('');
  
  // Inline Unlock State
  const [isPromptingPassword, setIsPromptingPassword] = useState(false);
  const [lockoraPassword, setLockoraPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  const SECRET_REVEAL_DURATION = 30; // 30 seconds fixed reveal window
  
  // UI states
  const [copiedValue, setCopiedValue] = useState(false);
  const [copiedFields, setCopiedFields] = useState<{[key: string]: boolean}>({});

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(secret.name);
  const [editCategory, setEditCategory] = useState(secret.category);
  const [editValue, setEditValue] = useState(''); // Legacy support
  const [editNotes, setEditNotes] = useState('');
  const [editFields, setEditFields] = useState<{name: string, value: string}[]>([]);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Handle tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && expireAt) {
        const remaining = Math.ceil((expireAt - Date.now()) / 1000);
        if (remaining <= 0) {
          clearState();
        } else {
          setTimeLeft(remaining);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [expireAt]);

  const clearState = () => {
    setRevealedData(null);
    setTimeLeft(0);
    setExpireAt(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPromptingPassword(false);
    setLockoraPassword('');
  };

  const startCountdown = (duration: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    const target = Date.now() + duration * 1000;
    setExpireAt(target);
    setTimeLeft(duration);
    
    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((target - Date.now()) / 1000);
      if (remaining <= 0) {
        clearState();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
  };

  const executeReveal = async (activePrivateKey: CryptoKey, duration: number) => {
    setError('');
    try {
      await recordSecretReveal(secret.id);

      const sdkRaw = await decryptAsymmetric(activePrivateKey, secret.encryptedDataKey);
      const sdk = await importKey(sdkRaw, { name: 'AES-GCM', length: 256 }, ['decrypt'], 'raw');
      const decryptedJson = await decryptSymmetric(sdk, secret.encryptedData);
      
      const parsed = JSON.parse(decryptedJson);
      setRevealedData(parsed);
      
      // Initialize edit states
      setEditValue(parsed.value || '');
      setEditNotes(parsed.notes || '');
      setEditFields(parsed.customFields || []);

      setIsPromptingPassword(false);
      startCountdown(duration);
    } catch (err) {
      console.error(err);
      setError('Decryption failed. Invalid Lockora Password or corrupted data.');
    }
  };

  const handleRevealClick = () => {
    setIsPromptingPassword(true);
  };

  const handleLocalUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUnlocking(true);
    
    try {
      const config = await getVaultConfig();
      if (!config.vaultSalt || !config.encryptedPrivateKey) {
        throw new Error('Lockora is not set up correctly.');
      }
      
      const masterKey = await deriveMasterKey(lockoraPassword, config.vaultSalt);
      const privateKeyJwk = await decryptSymmetric(masterKey, config.encryptedPrivateKey);
      const localPrivateKey = await importKey(privateKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, ['decrypt'], 'jwk');
      
      await executeReveal(localPrivateKey, SECRET_REVEAL_DURATION);
    } catch (err) {
      // Don't console.error the raw DOMException to prevent Next.js from throwing a full-screen dev overlay
      setError('Invalid Lockora Password.');
    } finally {
      setIsUnlocking(false);
      setLockoraPassword(''); // Always clear password from memory immediately
    }
  };


  const handleCopy = async (text: string, fieldId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (fieldId) {
        setCopiedFields(prev => ({...prev, [fieldId]: true}));
        setTimeout(() => setCopiedFields(prev => ({...prev, [fieldId]: false})), 2000);
      } else {
        setCopiedValue(true);
        setTimeout(() => setCopiedValue(false), 2000);
      }
      await recordSecretCopy(secret.id);
    } catch (e) {
      console.error('Failed to copy');
    }
  };

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState('');

  const handleDelete = async () => {
    if (deleteConfirmationPhrase !== 'DELETE PERMANENTLY') return;
    try {
      await deleteSecret(secret.id, deleteConfirmationPhrase);
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Deletion failed');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReason.trim()) {
      setError('You must enter a reason for this edit.');
      return;
    }
    
    setIsSaving(true);
    setError('');

    try {
      const config = await getVaultConfig();
      if (!config.publicKey) throw new Error('Public key missing');

      const sdk = await generateSecretDataKey();
      const payload = JSON.stringify({
        value: editValue || undefined,
        notes: editNotes,
        customFields: editFields.filter(f => f.name.trim() !== '' || f.value.trim() !== ''),
      });

      const encryptedData = await encryptSymmetric(sdk, payload);
      const pk = await importKey(
        config.publicKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        ['encrypt'],
        'spki'
      );
      const sdkRaw = await exportKey(sdk, 'raw');
      const encryptedSdk = await encryptAsymmetric(pk, sdkRaw);

      await updateSecret(secret.id, {
        name: editName,
        category: editCategory,
        encryptedData,
        editReason,
      });

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to save edit');
      setIsSaving(false);
    }
  };

  const addEditField = () => setEditFields([...editFields, { name: '', value: '' }]);
  const removeEditField = (index: number) => {
    const updated = [...editFields];
    updated.splice(index, 1);
    setEditFields(updated);
  };
  const updateEditField = (index: number, key: 'name' | 'value', val: string) => {
    const updated = [...editFields];
    updated[index][key] = val;
    setEditFields(updated);
  };

  const formatTime = (seconds: number) => {
    const s = Math.max(0, seconds);
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const createdDate = new Date(secret.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const updatedDate = new Date(secret.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const expiryDate = secret.expiryAt ? new Date(secret.expiryAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 relative z-10">
        <form onSubmit={handleSaveEdit} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md overflow-hidden shadow-2xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Edit Secret</h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} required className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
                <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} required className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800" />
              </div>
            </div>
            
            {editValue && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Legacy Secret Value</label>
                <Input value={editValue} onChange={e => setEditValue(e.target.value)} type="text" className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800" />
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <label className="text-sm font-medium text-zinc-900 dark:text-white block">Sensitive Fields</label>
              {editFields.map((field, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-zinc-50 dark:bg-zinc-950/30 p-2 sm:p-0 sm:bg-transparent rounded-lg">
                  <Input placeholder="Name" value={field.name} onChange={e => updateEditField(idx, 'name', e.target.value)} className="sm:flex-1 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white" />
                  <Input placeholder="Value" value={field.value} onChange={e => updateEditField(idx, 'value', e.target.value)} className="sm:flex-1 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeEditField(idx)} className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 shrink-0 self-end sm:self-auto">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addEditField} className="border-zinc-300 dark:border-zinc-700">
                <PlusCircle className="w-4 h-4 mr-2" /> Add Field
              </Button>
            </div>

            <div className="space-y-1 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 min-h-[100px]" />
            </div>
            
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <label className="text-sm font-medium text-red-600 dark:text-red-400">Mandatory Edit Reason (Audit Log)</label>
              <Input 
                value={editReason} 
                onChange={e => setEditReason(e.target.value)} 
                placeholder="e.g. Password rotated, updated API endpoint..."
                required 
                className="bg-white dark:bg-zinc-950 border-red-300 dark:border-red-900/50 focus-visible:ring-red-500 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={() => {
              setIsEditing(false);
              setEditValue('');
              setEditNotes('');
              setEditFields([]);
            }} className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">Cancel</Button>
            <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative z-10">
      
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md overflow-hidden shadow-2xl transition-colors">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{secret.name}</h2>
          <p className="text-indigo-600 dark:text-indigo-400 font-medium mb-4">{secret.category}</p>
          <div className="flex gap-6 text-xs text-zinc-500">
            <div><span className="font-semibold text-zinc-600 dark:text-zinc-400">Created:</span> {createdDate}</div>
            <div><span className="font-semibold text-zinc-600 dark:text-zinc-400">Last Updated:</span> {updatedDate}</div>
          </div>
        </div>

        {revealedData && (
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 p-4 flex justify-between items-center px-6">
            <div>
              <div className="text-xs font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">Security Access</div>
              <div className="text-indigo-950 dark:text-white font-medium">Secret Revealed</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-indigo-500 dark:text-indigo-300">Visible for</div>
              <div className="text-lg font-mono font-bold text-indigo-700 dark:text-white">{formatTime(timeLeft)}</div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-8">
          
          {/* Legacy Value (if exists) */}
          {(!revealedData && secret.hasLegacyValue) || revealedData?.value ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Secret Value</h3>
              {revealedData ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-emerald-600 dark:text-emerald-400 break-all flex items-center">
                    {revealedData.value}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => handleCopy(revealedData.value!)}>
                      {copiedValue ? 'Copied' : 'Copy'}
                    </Button>
                    <Button variant="outline" onClick={clearState}>Hide</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/50 rounded-lg p-3 font-mono text-zinc-400 dark:text-zinc-500 flex items-center tracking-widest">
                    ••••••••••••••••
                  </div>
                  <Button onClick={handleRevealClick} className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-sm">
                    Reveal
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {/* Sensitive Fields */}
          {(revealedData?.customFields && revealedData.customFields.length > 0) ? (
            <div className={`space-y-4 ${revealedData.value ? 'pt-6 border-t border-zinc-200 dark:border-zinc-800' : ''}`}>
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Sensitive Fields</h3>
              {revealedData.customFields.map((field, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">{field.name}</div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-emerald-600 dark:text-emerald-400 break-all flex items-center shadow-inner">
                      {field.value}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => handleCopy(field.value, `field_${idx}`)} className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 shadow-sm">
                        {copiedFields[`field_${idx}`] ? 'Copied' : 'Copy'}
                      </Button>
                      {!revealedData.value && idx === 0 && (
                        <Button variant="outline" onClick={clearState} className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 shadow-sm">Hide</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!revealedData.value && (
                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={clearState} className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">Mask Secret</Button>
                </div>
              )}
            </div>
          ) : !revealedData ? (
             <div className="space-y-4">
               <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Sensitive Fields</h3>
               <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/50 rounded-lg p-3 font-mono text-zinc-400 dark:text-zinc-600 flex items-center tracking-widest shadow-inner">
                  ••••••••••••••••
                </div>
                <Button onClick={handleRevealClick} className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border border-indigo-500 font-semibold px-6">
                  Reveal
                </Button>
              </div>
             </div>
          ) : null}

          {/* Password Prompt */}
          {isPromptingPassword && !revealedData && (
            <div className="p-5 border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl space-y-4 shadow-inner mt-6">
              <div className="text-sm text-indigo-700 dark:text-indigo-200 font-medium">Enter your Lockora Password to reveal</div>
              <form onSubmit={handleLocalUnlock} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input 
                    type="password" 
                    placeholder="Lockora Password"
                    value={lockoraPassword}
                    onChange={e => setLockoraPassword(e.target.value)}
                    className="bg-white dark:bg-zinc-950 border-indigo-300 dark:border-indigo-500/50 text-zinc-900 dark:text-white shadow-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isUnlocking} className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 shadow-sm border border-indigo-500">
                    {isUnlocking ? 'Unlocking...' : 'Unlock & Reveal'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setIsPromptingPassword(false)} className="text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">Cancel</Button>
                </div>
              </form>
              {error && <div className="text-red-500 dark:text-red-400 text-sm font-medium">{error}</div>}
            </div>
          )}

          {/* Notes */}
          {revealedData?.notes ? (
            <div className="space-y-2 pt-6 border-t border-zinc-200 dark:border-zinc-800">
               <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Notes</h3>
               <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap shadow-inner leading-relaxed">
                 {revealedData.notes}
               </div>
            </div>
          ) : null}

          {/* Expiry / Lifecycle */}
          {expiryDate && (
             <div className="space-y-2 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Expiry</h3>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 inline-block px-3 py-1 rounded-md">{expiryDate}</div>
             </div>
          )}

        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              if (revealedData) {
                setIsEditing(true);
                clearState();
              } else {
                alert('You must reveal the secret first before editing.');
              }
            }} 
            className="text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 shadow-sm"
          >
            Edit
          </Button>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 px-4 py-2 ml-auto bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-900/50 shadow-sm font-semibold">
              Delete
            </DialogTrigger>
            <DialogContent className="sm:max-w-md mx-4 sm:mx-auto rounded-xl">
              <DialogHeader>
                <DialogTitle>Delete Secret</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the secret and remove it from our servers.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-zinc-500 font-medium">
                  To confirm, type <span className="font-bold text-zinc-900 dark:text-white select-all">DELETE PERMANENTLY</span> below:
                </p>
                <Input
                  value={deleteConfirmationPhrase}
                  onChange={(e) => setDeleteConfirmationPhrase(e.target.value)}
                  placeholder="DELETE PERMANENTLY"
                  className="font-mono text-center border-red-200 dark:border-red-900 focus-visible:ring-red-500"
                />
              </div>
              <DialogFooter className="sm:justify-between flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteConfirmationPhrase !== 'DELETE PERMANENTLY'}
                  className="w-full sm:w-auto"
                >
                  Delete Secret
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
