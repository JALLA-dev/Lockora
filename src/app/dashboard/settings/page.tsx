'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVault } from '@/components/vault/VaultProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  getVaultConfig,
  updateAutoLockDuration,
  changeVaultPassword,
  setupVault,
  sendVaultOtp
} from '@/app/actions/vault';
import {
  deriveMasterKey,
  encryptSymmetric,
  exportKey,
  bufferToBase64,
} from '@/lib/crypto';

export default function SettingsPage() {
  const { user } = useUser();
  const { lockVault, autoLockMinutes, setAutoLockMinutes, privateKey } = useVault();
  const router = useRouter();

  // Settings states
  const [lockDuration, setLockDuration] = useState(autoLockMinutes);
  const [savingLock, setSavingLock] = useState(false);
  const [lockSaved, setLockSaved] = useState(false);
  const [isSetup, setIsSetup] = useState(true);

  // OTP Flow
  const [otpMode, setOtpMode] = useState<'NONE' | 'SETUP' | 'CHANGE_PASSWORD'>('NONE');
  const [otpStep, setOtpStep] = useState<'IDLE' | 'OTP' | 'FORM'>('IDLE');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  
  // Forms
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setLockDuration(autoLockMinutes);
    getVaultConfig().then(config => setIsSetup(config.isSetup));
  }, [autoLockMinutes]);

  const handleSaveLockDuration = async () => {
    setSavingLock(true);
    try {
      await updateAutoLockDuration(lockDuration);
      setAutoLockMinutes(lockDuration);
      setLockSaved(true);
      setTimeout(() => setLockSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingLock(false);
    }
  };

  const startOtpFlow = async (mode: 'SETUP' | 'CHANGE_PASSWORD') => {
    if (mode === 'CHANGE_PASSWORD') {
      if (!oldPassword) {
        setError('Please enter your current Lockora Password first.');
        return;
      }
      try {
        const config = await getVaultConfig();
        if (!config.vaultSalt) throw new Error();
        await deriveMasterKey(oldPassword, config.vaultSalt);
      } catch (err) {
        setError('Current Lockora Password is incorrect.');
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      const res = await sendVaultOtp(mode);
      setMaskedEmail(res.email);
      setOtpMode(mode);
      setOtpStep('OTP');
    } catch (err) {
      setError('Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 6) {
      setOtpStep('FORM');
    }
  };

  const submitPasswordForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setLoading(true);
    try {
      if (otpMode === 'SETUP') {
        const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
        const vaultSalt = bufferToBase64(saltBuffer.buffer);
        const mk = await deriveMasterKey(newPassword, vaultSalt);
        
        const keyPair = await window.crypto.subtle.generateKey(
          { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
          true,
          ['encrypt', 'decrypt']
        );
        const pkJwk = await exportKey(keyPair.privateKey, 'jwk');
        const pubJwk = await exportKey(keyPair.publicKey, 'jwk');
        
        const encPk = await encryptSymmetric(mk, pkJwk);
        
        await setupVault(otp, vaultSalt, JSON.stringify(pubJwk), encPk);
        setSuccess('Lockora Password created successfully.');
        setIsSetup(true);
      } else {
        const config = await getVaultConfig();
        if (!config.vaultSalt || !config.encryptedPrivateKey) throw new Error();
        
        const oldMk = await deriveMasterKey(oldPassword, config.vaultSalt);
        const privateKeyJwk = await exportKey(privateKey!, 'jwk');
        
        const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
        const vaultSalt = bufferToBase64(saltBuffer.buffer);
        const newMk = await deriveMasterKey(newPassword, vaultSalt);
        
        const newEncPk = await encryptSymmetric(newMk, privateKeyJwk);
        
        await changeVaultPassword(otp, vaultSalt, newEncPk);
        setSuccess('Lockora Password changed successfully.');
        lockVault();
      }
      
      setOtpMode('NONE');
      setOtpStep('IDLE');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      
    } catch (err: any) {
      setError(err?.message || 'Operation failed. Verification code may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const cancelFlow = () => {
    setOtpMode('NONE');
    setOtpStep('IDLE');
    setError('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtp('');
  };

  return (
    <div className="space-y-6 max-w-2xl px-4 md:px-0 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Settings</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage your security, MFA, session, and notifications.</p>
      </div>

      {/* ── MULTI-FACTOR AUTHENTICATION (MFA) ── */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white flex items-center justify-between">
            <span>Multi-Factor Authentication (MFA)</span>
            {user?.twoFactorEnabled ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                Enabled
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                Not Enabled
              </span>
            )}
          </CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Protect your Lockora account login using Google Authenticator, Microsoft Authenticator, or standard TOTP apps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authenticator App */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Authenticator App (TOTP)</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {user?.totpEnabled 
                  ? 'Authenticator App is configured for your account.' 
                  : 'Enroll a 2-Step Authenticator App (Google Authenticator, Microsoft Authenticator).'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/profile')}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white shrink-0"
            >
              {user?.totpEnabled ? 'Reconfigure App' : 'Configure App'}
            </Button>
          </div>

          {/* Backup Codes */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Backup Codes</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Generate or view one-time backup codes for account recovery via Clerk's secure flow.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/profile')}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white shrink-0"
            >
              Manage Backup Codes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── LOCKORA SECURITY ── */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white">Lockora Security</CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            These settings protect your sensitive data — separate from your account login & MFA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Password Management */}
          <div className="space-y-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Lockora Password</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {!isSetup 
                  ? 'Protect your sensitive data with a separate security password.' 
                  : 'Your Lockora Password is configured.'}
              </p>
            </div>
            
            {success && <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">{success}</p>}
            {error && <p className="text-sm text-red-500 dark:text-red-400 font-medium">{error}</p>}

            {otpMode === 'NONE' && (
              <div className="space-y-3">
                {!isSetup ? (
                  <Button onClick={() => startOtpFlow('SETUP')} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    {loading ? 'Preparing...' : 'Create Lockora Password'}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="Current Lockora Password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                    />
                    <Button onClick={() => startOtpFlow('CHANGE_PASSWORD')} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                      {loading ? 'Preparing...' : 'Change Lockora Password'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {otpStep === 'OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4 p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  A verification code has been sent to <strong>{maskedEmail}</strong>.
                </p>
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input 
                    placeholder="123456" 
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={cancelFlow}>Cancel</Button>
                  <Button type="submit" disabled={otp.length !== 6}>Verify Code</Button>
                </div>
              </form>
            )}

            {otpStep === 'FORM' && (
              <form onSubmit={submitPasswordForm} className="space-y-4 p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                <div className="space-y-2">
                  <Label>New Lockora Password</Label>
                  <Input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Lockora Password</Label>
                  <Input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={cancelFlow}>Cancel</Button>
                  <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500">
                    {loading ? 'Saving...' : 'Confirm'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Auto-lock duration */}
          <div className="space-y-3 pt-2">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Lockora Access Timeout</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Lockora access will lock automatically after this period of inactivity.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white px-3 py-2 text-sm"
                value={lockDuration}
                onChange={e => setLockDuration(Number(e.target.value))}
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
              <Button size="sm" onClick={handleSaveLockDuration} disabled={savingLock}>
                {lockSaved ? 'Saved' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── AUDIT LOGS ── */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white">Audit & Security Activity</CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Review detailed security events, access logs, MFA updates, and edits for your Lockora account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/audit" className="inline-block px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm font-medium rounded-md transition-colors border border-zinc-300 dark:border-zinc-700">
            View Audit Logs
          </Link>
        </CardContent>
      </Card>

      {/* ── NOTIFICATIONS ── */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white">Notifications</CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Manage your email alerts and reminders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-zinc-900 dark:text-white">Security & MFA Notifications</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Receive alerts when your security settings or MFA state changes.</p>
            </div>
            <div className="h-5 w-9 rounded-full bg-indigo-600 relative cursor-pointer"><div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white"></div></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-zinc-900 dark:text-white">Secret Expiry Notifications</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Reminders when a secret is about to expire.</p>
            </div>
            <div className="h-5 w-9 rounded-full bg-indigo-600 relative cursor-pointer"><div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white"></div></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-zinc-900 dark:text-white">Rotation Notifications</Label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Reminders for secrets requiring periodic rotation.</p>
            </div>
            <div className="h-5 w-9 rounded-full bg-indigo-600 relative cursor-pointer"><div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white"></div></div>
          </div>
        </CardContent>
      </Card>

      {/* ── ACCOUNT ── */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg relative z-10">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-white">Account Information</CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Manage your Clerk account login, MFA credentials, and active sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { rootBox: 'flex', avatarBox: 'w-10 h-10' } }} />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Manage Account & Security</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
