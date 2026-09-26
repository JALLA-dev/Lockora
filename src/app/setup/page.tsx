'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setupVault, getVaultConfig, sendVaultOtp } from '@/app/actions/vault';
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
import Image from 'next/image';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Lock, 
  ArrowLeft, 
  Copy, 
  Check,
  Mail,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

type PageStep = 'checking' | 'form' | 'otp' | 'recovery' | 'complete' | 'error';

function calculatePasswordStrength(pwd: string): { score: number; label: string; color: string; widthClass: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-zinc-700', widthClass: 'w-0' };
  let score = 0;
  if (pwd.length >= 12) score += 1;
  if (pwd.length >= 16) score += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500', widthClass: 'w-1/4' };
  if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500', widthClass: 'w-2/4' };
  if (score === 4) return { score, label: 'Good', color: 'bg-blue-500', widthClass: 'w-3/4' };
  return { score, label: 'Strong', color: 'bg-emerald-500', widthClass: 'w-full' };
}

export default function SetupVaultPage() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const { unlockVault } = useVault();

  const [step, setStep] = useState<PageStep>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generateRecoveryKey, setGenerateRecoveryKey] = useState(true);

  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);

  const inFlightRef = useRef(false);

  const checkSetupStatus = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStep('checking');
    setErrorMessage('');

    const timeoutId = setTimeout(() => {
      if (inFlightRef.current) {
        inFlightRef.current = false;
        setStep('error');
        setErrorMessage('The setup check timed out. Please verify your connection and try again.');
      }
    }, 15000);

    try {
      const config = await getVaultConfig();
      clearTimeout(timeoutId);
      inFlightRef.current = false;

      if (config.isSetup) {
        // Setup is already complete! Redirect safely to dashboard.
        router.push('/dashboard');
        return;
      }

      setStep('form');
    } catch (err: any) {
      clearTimeout(timeoutId);
      inFlightRef.current = false;
      console.error('[LockoraSetup] Status check error:', err?.message);
      setStep('error');
      if (err?.message?.includes('Unauthorized')) {
        setErrorMessage('Your login session has expired. Please sign in again.');
      } else {
        setErrorMessage(err?.message || 'Unable to load Lockora setup status. Please try again.');
      }
    }
  }, [router]);

  useEffect(() => {
    if (isLoaded) {
      if (!userId) {
        router.push('/sign-in');
      } else {
        checkSetupStatus();
      }
    }
  }, [isLoaded, userId, checkSetupStatus, router]);

  const startResendTimer = () => {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleInitiateSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 12) {
      setErrorMessage('Lockora Password must be at least 12 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Lockora Password and Confirm Password do not match.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await sendVaultOtp('SETUP');
      if (res.success) {
        setMaskedEmail(res.email);
        setStep('otp');
        startResendTimer();
      }
    } catch (err: any) {
      console.error('[LockoraSetup] OTP trigger error:', err);
      setErrorMessage(err.message || 'Failed to send verification code to your email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || submitting) return;
    setErrorMessage('');
    try {
      setSubmitting(true);
      const res = await sendVaultOtp('SETUP');
      if (res.success) {
        setMaskedEmail(res.email);
        startResendTimer();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Generate random salt (16 bytes)
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
      const salt = bufferToBase64(saltBuffer.buffer);

      // 2. Derive Master Key from Lockora Password
      const mk = await deriveMasterKey(password, salt);

      // 3. Generate Asymmetric Key Pair
      const keyPair = await generateKeyPair();

      // 4. Export Public Key (SPKI)
      const publicKeyRaw = await exportKey(keyPair.publicKey, 'spki');

      // 5. Encrypt Private Key with Master Key
      const privateKeyJwk = await exportKey(keyPair.privateKey, 'jwk');
      const encryptedPrivateKey = await encryptSymmetric(mk, privateKeyJwk);

      // 6. Optional: Backup Recovery Key
      let encryptedPrivateKeyRecovery;
      let generatedRecoveryKey = '';
      if (generateRecoveryKey) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const arr = new Uint32Array(24);
        crypto.getRandomValues(arr);
        for (let i = 0; i < 24; i++) {
          generatedRecoveryKey += charset[arr[i] % charset.length];
        }
        const recoveryMk = await deriveMasterKey(generatedRecoveryKey, salt);
        encryptedPrivateKeyRecovery = await encryptSymmetric(recoveryMk, privateKeyJwk);
      }

      // 7. Save to Server with OTP verification
      await setupVault(
        otpCode.trim(),
        salt,
        publicKeyRaw,
        encryptedPrivateKey,
        encryptedPrivateKeyRecovery
      );

      // 8. Unlock in-memory state
      unlockVault(mk, keyPair.privateKey);

      // 9. Show recovery code or completion screen
      if (generatedRecoveryKey) {
        setRecoveryCode(generatedRecoveryKey);
        setStep('recovery');
      } else {
        setStep('complete');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      console.error('[LockoraSetup] Setup submission error:', err);
      setErrorMessage(err.message || 'Setup failed. Please check your verification code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyRecoveryCode = () => {
    if (!recoveryCode) return;
    navigator.clipboard.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFinishRecoveryStep = () => {
    setStep('complete');
    setTimeout(() => {
      router.push('/dashboard');
    }, 1200);
  };

  const strength = calculatePasswordStrength(password);

  // 1. LOADING STATE
  if (step === 'checking') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute h-24 w-24 animate-spin rounded-full border-2 border-transparent border-t-indigo-500 border-b-violet-500 opacity-60" />
          <Image src="/lockora-icon.png" alt="Lockora" width={56} height={56} className="rounded-2xl relative z-10 shadow-xl" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Preparing Lockora...</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Securing your vault setup...</p>
      </div>
    );
  }

  // 2. ERROR STATE
  if (step === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Card className="w-full max-w-md shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold">Unable to load Lockora setup</CardTitle>
            <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400">
              {errorMessage || 'An unexpected error occurred while preparing your setup.'}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button 
              onClick={async () => {
                setIsRetrying(true);
                await checkSetupStatus();
                setIsRetrying(false);
              }}
              disabled={isRetrying}
              className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full sm:flex-1 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 3. OTP VERIFICATION STATE
  if (step === 'otp') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 relative z-10">
        <Card className="w-full max-w-md shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur">
          <CardHeader className="space-y-2 pb-4">
            <button
              type="button"
              onClick={() => { setStep('form'); setErrorMessage(''); }}
              className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Password Setup
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Verify Your Email
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400">
                  Verification code sent to <span className="font-semibold text-zinc-800 dark:text-zinc-200">{maskedEmail}</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleVerifyAndComplete}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otpCode" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  6-Digit Verification Code
                </Label>
                <Input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="font-mono text-center tracking-[0.5em] text-lg font-bold bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 focus:border-indigo-500 h-12"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-medium">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-500 dark:text-zinc-400">Didn't get the code?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || submitting}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                type="submit"
                disabled={submitting || otpCode.length < 6}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md py-2.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Encrypting & Completing...
                  </>
                ) : (
                  'Verify & Complete Setup'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // 4. RECOVERY KEY DISPLAY STATE
  if (step === 'recovery') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 relative z-10">
        <Card className="w-full max-w-md shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Lockora Recovery Key
                </CardTitle>
                <CardDescription className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Important: Save this key. It will only be displayed once.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              If you ever forget your Lockora Password, this 24-character recovery key is the only way to restore access. Store it safely offline.
            </p>

            <div className="p-4 bg-zinc-100 dark:bg-zinc-950 rounded-xl font-mono text-center text-lg font-bold tracking-widest break-all border border-zinc-300 dark:border-zinc-800 select-all text-zinc-900 dark:text-zinc-100 shadow-inner">
              {recoveryCode}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopyRecoveryCode}
              className="w-full border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4 text-emerald-500" /> Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" /> Copy Recovery Key
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter>
            <Button
              type="button"
              onClick={handleFinishRecoveryStep}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md py-2.5"
            >
              I Have Saved My Recovery Key Safely
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // 5. SUCCESS / COMPLETE STATE
  if (step === 'complete') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative z-10">
        <Card className="w-full max-w-md shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur text-center p-6 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Lockora Setup Complete
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your security configuration has been saved and initialized.
            </p>
          </div>
          <div className="pt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Redirecting to your dashboard...
          </div>
        </Card>
      </div>
    );
  }

  // 6. FORM STATE (DEFAULT)
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 relative z-10">
      <Card className="w-full max-w-md shadow-2xl border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 backdrop-blur">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <Image src="/lockora-icon.png" alt="Lockora Logo" width={40} height={40} className="rounded-xl shadow-md" />
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Secure Your Lockora
              </CardTitle>
              <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Security Setup
              </span>
            </div>
          </div>
          <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400">
            Set up your Lockora Password to protect access to your stored secrets.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleInitiateSetup}>
          <CardContent className="space-y-4 pt-0">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Keep this password safe:</strong>
                This is separate from your account login. If lost without a recovery key, your data cannot be recovered.
              </div>
            </div>

            {/* Lockora Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Lockora Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter at least 12 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  className="font-mono pr-10 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
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
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Confirm Lockora Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="font-mono pr-10 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs pt-0.5">
                  {password === confirmPassword ? (
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

            {/* Recovery Key Checkbox */}
            <div className="flex items-center space-x-2.5 pt-2">
              <input
                type="checkbox"
                id="generateRecovery"
                checked={generateRecoveryKey}
                onChange={(e) => setGenerateRecoveryKey(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <Label htmlFor="generateRecovery" className="text-xs font-normal text-zinc-700 dark:text-zinc-300 cursor-pointer">
                Generate a 24-character backup recovery key
              </Label>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-medium">
                {errorMessage}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting || password.length < 12 || password !== confirmPassword}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md py-2.5"
            >
              {submitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending Verification Code...
                </>
              ) : (
                'Create Lockora Password'
              )}
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
