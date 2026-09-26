'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { secrets, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/email';

export async function createSecret(data: {
  name: string;
  category: string;
  tags?: string;
  encryptedData: string;
  encryptedDataKey: string;
  expiryAt?: string;
  requiresRotation?: boolean;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const newId = crypto.randomUUID();

  await db.insert(secrets).values({
    id: newId,
    userId,
    name: data.name,
    category: data.category,
    tags: data.tags || '[]',
    encryptedData: data.encryptedData,
    encryptedDataKey: data.encryptedDataKey,
    expiryAt: data.expiryAt ? new Date(data.expiryAt) : null,
    requiresRotation: data.requiresRotation || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_CREATED',
    resource: newId,
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true, id: newId };
}

export async function listSecrets() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const results = await db.query.secrets.findMany({
    where: and(
      eq(secrets.userId, userId),
      eq(secrets.isDeleted, false)
    ),
    orderBy: [desc(secrets.updatedAt)],
    columns: {
      id: true,
      name: true,
      category: true,
      tags: true,
      updatedAt: true,
      createdAt: true,
      expiryAt: true,
    }
  });

  return results;
}

export async function getSecret(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const secret = await db.query.secrets.findFirst({
    where: and(
      eq(secrets.id, id),
      eq(secrets.userId, userId),
      eq(secrets.isDeleted, false)
    ),
  });

  if (!secret) {
    throw new Error('Secret not found or access denied');
  }

  return secret;
}

export async function recordSecretReveal(id: string) {
  const user = await currentUser();
  if (!user) return;

  const timestamp = new Date();

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: 'SECRET_REVEALED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  if (user.emailAddresses[0]) {
    try {
      await emailService.sendSecurityAlert(
        user.emailAddresses[0].emailAddress,
        'Your Lockora secret was accessed.',
        timestamp
      );
    } catch (err) {
      console.error('Failed to send security alert:', err);
    }
  }
}

export async function recordSecretCopy(id: string) {
  const { userId } = await auth();
  if (!userId) return;

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_COPIED',
    resource: id,
    result: 'SUCCESS',
    timestamp: new Date(),
  });
}

export async function deleteSecret(id: string, confirmationPhrase: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (confirmationPhrase !== 'DELETE PERMANENTLY') {
    throw new Error('Invalid confirmation phrase. Secret deletion aborted.');
  }

  await db.update(secrets)
    .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_DELETED',
    resource: id,
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true };
}

export async function restoreSecret(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  await db.update(secrets)
    .set({ isDeleted: false, deletedAt: null, updatedAt: new Date() })
    .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_RESTORED',
    resource: id,
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true };
}

export async function updateSecret(
  id: string,
  data: {
    name: string;
    category: string;
    tags?: string;
    encryptedData: string;
    editReason: string;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!data.editReason || data.editReason.trim() === '') {
    throw new Error('A valid edit reason is required.');
  }

  const secret = await db.query.secrets.findFirst({
    where: and(eq(secrets.id, id), eq(secrets.userId, userId), eq(secrets.isDeleted, false)),
  });

  if (!secret) {
    throw new Error('Secret not found or access denied');
  }

  await db.update(secrets)
    .set({
      name: data.name,
      category: data.category,
      tags: data.tags || '[]',
      encryptedData: data.encryptedData,
      updatedAt: new Date(),
    })
    .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_UPDATED',
    resource: id,
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  // Log the reason as a separate audit entry for visibility, or append to action
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: `SECRET_EDIT_REASON: ${data.editReason.trim().substring(0, 100)}`,
    resource: id,
    result: 'SUCCESS',
    timestamp: new Date(),
  });

  return { success: true };
}
