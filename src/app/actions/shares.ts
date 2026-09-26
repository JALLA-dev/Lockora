'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, secretShares, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/email';

export async function lookupUserForShare(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
    columns: {
      id: true,
      publicKey: true,
    }
  });

  if (!user || !user.publicKey) {
    throw new Error('User not found or has not set up their Vault.');
  }

  return user;
}

export async function createShare(
  secretId: string, 
  recipientId: string, 
  encryptedDataKey: string
) {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  const shareId = crypto.randomUUID();
  const timestamp = new Date();

  await db.insert(secretShares).values({
    id: shareId,
    secretId,
    ownerId: user.id,
    recipientId,
    encryptedDataKey,
    permissions: 'read',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: 'SECRET_SHARED',
    resource: secretId,
    result: 'SUCCESS',
    timestamp,
  });

  // Fetch recipient email to send alert
  const recipient = await db.query.users.findFirst({
    where: eq(users.id, recipientId),
  });

  if (recipient && recipient.email) {
    await emailService.sendSecurityAlert(
      recipient.email,
      'A new secret has been shared with you in Lockora.',
      timestamp
    );
  }

  return { success: true };
}
