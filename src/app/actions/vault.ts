'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, auditLogs, otps } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/email';

export async function setupVault(
  otp: string | undefined,
  vaultSalt: string,
  publicKey: string,
  encryptedPrivateKey: string,
  encryptedPrivateKeyRecovery?: string
) {
  const userObj = await currentUser();
  const userId = userObj?.id;
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  if (otp) {
    // Verify OTP
    const validOtp = await db.query.otps.findFirst({
      where: and(
        eq(otps.userId, userId),
        eq(otps.code, otp),
        eq(otps.purpose, 'SETUP'),
        gt(otps.expiresAt, new Date())
      )
    });

    if (!validOtp) {
      throw new Error('Invalid or expired verification code.');
    }
    
    // Clear OTPs
    await db.delete(otps).where(eq(otps.userId, userId));
  }

  // Check if user exists, if not, create them. Usually handled via webhooks but we can upsert here.
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (existingUser && existingUser.vaultSalt) {
    throw new Error('Lockora is already set up.');
  }

  if (!existingUser) {
    // If we haven't synced from Clerk via webhook yet, just insert the minimum
    await db.insert(users).values({
      id: userId,
      email: userObj.emailAddresses[0]?.emailAddress || 'unknown@example.com',
      vaultSalt,
      publicKey,
      encryptedPrivateKey,
      encryptedPrivateKeyRecovery: encryptedPrivateKeyRecovery || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    // Update existing user with vault info
    await db.update(users)
      .set({
        vaultSalt,
        publicKey,
        encryptedPrivateKey,
        encryptedPrivateKeyRecovery: encryptedPrivateKeyRecovery || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Log the setup event
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'LOCKORA_PASSWORD_CREATED',
    resource: 'Vault',
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  await emailService.sendSecurityAlert(
    userObj.emailAddresses[0]?.emailAddress || '',
    'Lockora Password created',
    new Date()
  );

  return { success: true };
}

/**
 * Fetches the vault configuration for the current user.
 * NOTE: This does NOT enforce unlock rate limiting — that is enforced
 * only at the unlock action to prevent locking users out of the dashboard
 * after failed attempts.
 */
export async function getVaultConfig() {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.vaultSalt) {
    return { isSetup: false };
  }

  return {
    isSetup: true,
    vaultSalt: user.vaultSalt,
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey,
    encryptedPrivateKeyRecovery: user.encryptedPrivateKeyRecovery,
    autoLockMinutes: user.autoLockMinutes ?? 15,
  };
}

/**
 * Updates the auto-lock duration (in minutes) for the current user.
 * Minimum 1 minute, maximum 240 minutes (4 hours).
 */
export async function updateAutoLockDuration(minutes: number) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const clamped = Math.max(1, Math.min(240, Math.round(minutes)));

  await db.update(users)
    .set({ autoLockMinutes: clamped, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SETTINGS_AUTO_LOCK_UPDATED',
    resource: 'Vault',
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true, autoLockMinutes: clamped };
}

/**
 * Re-encrypts the user's RSA private key under a new vault password.
 * Accepts the NEW encrypted private key material (produced client-side)
 * so the server never sees the old or new plaintext password.
 */
export async function changeVaultPassword(
  otp: string,
  newVaultSalt: string,
  newEncryptedPrivateKey: string,
  newEncryptedPrivateKeyRecovery?: string
) {
  const userObj = await currentUser();
  const userId = userObj?.id;
  if (!userId) throw new Error('Unauthorized');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || !user.vaultSalt) throw new Error('Vault not set up.');

  await db.update(users)
    .set({
      vaultSalt: newVaultSalt,
      encryptedPrivateKey: newEncryptedPrivateKey,
      encryptedPrivateKeyRecovery: newEncryptedPrivateKeyRecovery ?? user.encryptedPrivateKeyRecovery,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (userObj?.emailAddresses[0]) {
    await emailService.sendSecurityAlert(
      userObj.emailAddresses[0].emailAddress,
      'Your Lockora Password was changed',
      new Date()
    );
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'VAULT_PASSWORD_CHANGED',
    resource: 'Vault',
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true };
}

/**
 * Checks unlock rate limiting. Call this from the unlock page before
 * attempting to decrypt, NOT from getVaultConfig.
 */
export async function checkUnlockRateLimit(): Promise<{ allowed: boolean; minutesRemaining?: number }> {
  const { userId } = await auth();
  if (!userId) return { allowed: false };

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentFailures = await db.query.auditLogs.findMany({
    where: (logs, { and, eq, gte }) => and(
      eq(logs.userId, userId),
      eq(logs.action, 'VAULT_UNLOCK_FAILED'),
      gte(logs.timestamp, fifteenMinutesAgo)
    ),
    orderBy: (logs, { desc }) => [desc(logs.timestamp)],
  });

  if (recentFailures.length >= 5) {
    // Tell UI how many minutes until oldest failure expires
    const oldestFailure = recentFailures[recentFailures.length - 1];
    const expiresAt = new Date(oldestFailure.timestamp.getTime() + 15 * 60 * 1000);
    const minutesRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / 60000);
    return { allowed: false, minutesRemaining: Math.max(1, minutesRemaining) };
  }

  return { allowed: true };
}

export async function recordVaultUnlockAttempt(success: boolean) {
  const user = await currentUser();
  if (!user) return;

  const timestamp = new Date();

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: success ? 'VAULT_UNLOCK_SUCCESS' : 'VAULT_UNLOCK_FAILED',
    resource: 'Vault',
    result: success ? 'SUCCESS' : 'FAILURE',
    timestamp,
  });

  if (success && user.emailAddresses[0]) {
    await emailService.sendSecurityAlert(
      user.emailAddresses[0].emailAddress,
      'Vault Unlocked',
      timestamp
    );
  }
}

export async function sendVaultOtp(purpose: 'SETUP' | 'CHANGE_PASSWORD') {
  const userObj = await currentUser();
  const userId = userObj?.id;
  const email = userObj?.emailAddresses[0]?.emailAddress;
  
  if (!userId || !email) throw new Error('Unauthorized');
  
  // Clean old OTPs
  await db.delete(otps).where(eq(otps.userId, userId));

  const code = Array.from({length: 6}, () => Math.floor(Math.random() * 10)).join('');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await db.insert(otps).values({
    id: crypto.randomUUID(),
    userId,
    code,
    purpose,
    expiresAt,
    createdAt: new Date(),
  });

  const eventName = purpose === 'SETUP' ? 'Lockora Password Creation Verification' : 'Lockora Password Change Verification';
  await emailService.sendSecurityAlert(email, `${eventName}. Your code is: ${code}`, new Date());
  
  // Mask email for client
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  return { success: true, email: maskedEmail };
}
