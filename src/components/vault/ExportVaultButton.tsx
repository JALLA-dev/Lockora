'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useVault } from '@/components/vault/VaultProvider';
import { fetchAllSecretsForExport } from '@/app/actions/export';
import { 
  decryptAsymmetric, 
  decryptSymmetric, 
  importKey,
  deriveMasterKey, 
  encryptSymmetric 
} from '@/lib/crypto';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ExportVaultButton() {
  const { privateKey } = useVault();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportPassword, setExportPassword] = useState('');

  const handleExport = async () => {
    if (!privateKey) {
      setError('Vault must be unlocked to export.');
      return;
    }

    if (exportPassword.length < 8) {
      setError('Please provide a strong export password (min 8 chars).');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const ciphertexts = await fetchAllSecretsForExport();
      
      const plaintexts = [];

      for (const secret of ciphertexts) {
        try {
          // Decrypt SDK
          const sdkRaw = await decryptAsymmetric(privateKey, secret.encryptedDataKey);
          const sdk = await importKey(sdkRaw, { name: 'AES-GCM', length: 256 }, ['decrypt'], 'raw');
          
          // Decrypt Payload
          const decryptedJson = await decryptSymmetric(sdk, secret.encryptedData);
          const data = JSON.parse(decryptedJson);

          plaintexts.push({
            id: secret.id,
            name: secret.name,
            category: secret.category,
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
            data,
          });
        } catch (decErr) {
          console.error('Failed to decrypt secret', secret.id, decErr);
        }
      }

      const jsonStr = JSON.stringify(plaintexts);

      // Generate a random salt for this export
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
      const saltBase64 = Buffer.from(saltBuffer).toString('base64');

      // Derive export key
      const exportKey = await deriveMasterKey(exportPassword, saltBase64);

      // Encrypt the entire JSON string
      const encryptedExport = await encryptSymmetric(exportKey, jsonStr);

      const payload = JSON.stringify({
        salt: saltBase64,
        data: encryptedExport
      }, null, 2);

      const jsonBlob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `lockora-export-${new Date().toISOString().split('T')[0]}.enc.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportPassword('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="export-pw">Export Password</Label>
        <Input 
          id="export-pw" 
          type="password" 
          placeholder="Must be at least 8 characters"
          value={exportPassword}
          onChange={(e) => setExportPassword(e.target.value)}
        />
      </div>
      <Button onClick={handleExport} disabled={loading || !exportPassword} variant="default">
        {loading ? 'Encrypting & Exporting...' : 'Export Encrypted Vault'}
      </Button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <p className="text-xs text-zinc-500">
        This will download an AES-256-GCM encrypted backup of your secrets. Keep your export password safe.
      </p>
    </div>
  );
}
