'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, auditLogs, otps } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/email';
import { getUserVerifiedEmail } from '@/lib/email/utils';

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

  // Check if user exists, if not, create them.
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (existingUser && existingUser.vaultSalt) {
    throw new Error('Lockora is already set up.');
  }

  const timestamp = new Date();
  const email = getUserVerifiedEmail(userObj);

  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      email: email || 'unknown@example.com',
      vaultSalt,
      publicKey,
      encryptedPrivateKey,
      encryptedPrivateKeyRecovery: encryptedPrivateKeyRecovery || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } else {
    await db.update(users)
      .set({
        vaultSalt,
        publicKey,
        encryptedPrivateKey,
        encryptedPrivateKeyRecovery: encryptedPrivateKeyRecovery || null,
        updatedAt: timestamp,
      })
      .where(eq(users.id, userId));
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'LOCKORA_PASSWORD_CREATED',
    resource: 'Lockora',
    result: 'SUCCESS',
    timestamp,
  });

  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECURITY_EVENT',
      serviceName: 'Lockora Core',
      actionName: 'Lockora Password Created',
      time: timestamp,
    });
  }

  return { success: true };
}

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
    resource: 'Lockora',
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true, autoLockMinutes: clamped };
}

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
  if (!user || !user.vaultSalt) throw new Error('Lockora is not set up.');

  const timestamp = new Date();

  await db.update(users)
    .set({
      vaultSalt: newVaultSalt,
      encryptedPrivateKey: newEncryptedPrivateKey,
      encryptedPrivateKeyRecovery: newEncryptedPrivateKeyRecovery ?? user.encryptedPrivateKeyRecovery,
      updatedAt: timestamp,
    })
    .where(eq(users.id, userId));

  const email = getUserVerifiedEmail(userObj);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'LOCKORA_PASSWORD_CHANGED',
      serviceName: 'Lockora Access',
      actionName: 'Lockora Password Changed',
      time: timestamp,
    });
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'LOCKORA_PASSWORD_CHANGED',
    resource: 'Lockora',
    result: 'SUCCESS',
    timestamp,
  });

  return { success: true };
}

export async function checkUnlockRateLimit(): Promise<{ allowed: boolean; minutesRemaining?: number }> {
  const { userId } = await auth();
  if (!userId) return { allowed: false };

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recentFailures = await db.query.auditLogs.findMany({
    where: (logs, { and, eq, gte }) => and(
      eq(logs.userId, userId),
      eq(logs.action, 'LOCKORA_PASSWORD_FAILED'),
      gte(logs.timestamp, fifteenMinutesAgo)
    ),
    orderBy: (logs, { desc }) => [desc(logs.timestamp)],
  });

  if (recentFailures.length >= 5) {
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
    action: success ? 'LOCKORA_PASSWORD_VERIFIED' : 'LOCKORA_PASSWORD_FAILED',
    resource: 'Lockora',
    result: success ? 'SUCCESS' : 'FAILURE',
    timestamp,
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: success ? 'LOCKORA_PASSWORD_VERIFIED' : 'LOCKORA_PASSWORD_FAILED',
      serviceName: 'Lockora Access',
      actionName: success ? 'Lockora Password Verified' : 'Failed Lockora Password Attempt',
      time: timestamp,
    });
  }
}

export async function sendVaultOtp(purpose: 'SETUP' | 'CHANGE_PASSWORD') {
  const userObj = await currentUser();
  const userId = userObj?.id;
  const email = getUserVerifiedEmail(userObj);
  
  if (!userId || !email) throw new Error('Unauthorized');
  
  await db.delete(otps).where(eq(otps.userId, userId));

  const code = Array.from({length: 6}, () => Math.floor(Math.random() * 10)).join('');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(otps).values({
    id: crypto.randomUUID(),
    userId,
    code,
    purpose,
    expiresAt,
    createdAt: new Date(),
  });

  const eventName = purpose === 'SETUP' ? 'Lockora Password Creation Verification' : 'Lockora Password Change Verification';
  await emailService.sendSecurityAlert({
    to: email,
    event: 'SECURITY_EVENT',
    serviceName: 'Verification Code',
    actionName: eventName,
    time: new Date(),
  });
  
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  return { success: true, email: maskedEmail };
}
