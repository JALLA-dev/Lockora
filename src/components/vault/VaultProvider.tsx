'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface VaultContextType {
  isUnlocked: boolean;
  masterKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  unlockVault: (masterKey: CryptoKey, privateKey: CryptoKey, autoLockMinutes?: number) => void;
  lockVault: () => void;
  lastActivity: number;
  updateActivity: () => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (m: number) => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(15);

  // Use a ref for the interval to avoid stale closures
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lockVault = useCallback(() => {
    setMasterKey(null);
    setPrivateKey(null);
    // Clear any sensitive data from memory by triggering GC hints
    // (Keys are non-extractable CryptoKey objects; nulling refs is sufficient)
  }, []);

  const unlockVault = useCallback((mk: CryptoKey, pk: CryptoKey, configuredAutoLockMinutes?: number) => {
    setMasterKey(mk);
    setPrivateKey(pk);
    setLastActivity(Date.now());
    if (configuredAutoLockMinutes !== undefined) {
      setAutoLockMinutes(configuredAutoLockMinutes);
    }
  }, []);

  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Auto-lock timer — checks every 30 seconds for precision
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!masterKey) return;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const threshold = autoLockMinutes * 60 * 1000;
      if (elapsed > threshold) {
        lockVault();
      }
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [masterKey, lastActivity, autoLockMinutes, lockVault]);

  // Lock vault when tab/window is hidden for an extended period (additional protection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return; // became hidden — nothing to do yet
      // Became visible — check if we've been gone too long
      if (!masterKey) return;
      const elapsed = Date.now() - lastActivity;
      if (elapsed > autoLockMinutes * 60 * 1000) {
        lockVault();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [masterKey, lastActivity, autoLockMinutes, lockVault]);

  return (
    <VaultContext.Provider
      value={{
        isUnlocked: !!masterKey && !!privateKey,
        masterKey,
        privateKey,
        unlockVault,
        lockVault,
        lastActivity,
        updateActivity,
        autoLockMinutes,
        setAutoLockMinutes,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
