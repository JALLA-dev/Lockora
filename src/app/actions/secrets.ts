'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { secrets, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/email';
import { getUserVerifiedEmail } from '@/lib/email/utils';

export async function createSecret(data: {
  name: string;
  category: string;
  tags?: string;
  encryptedData: string;
  encryptedDataKey: string;
  expiryAt?: string;
  requiresRotation?: boolean;
}) {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) throw new Error('Unauthorized');

  const newId = crypto.randomUUID();
  const timestamp = new Date();

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
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_CREATED',
    resource: newId,
    result: 'SUCCESS',
    timestamp,
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECRET_CREATED',
      serviceName: data.name,
      actionName: 'Secret Created',
      time: timestamp,
    });
  }

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
  if (!user) return { success: false, error: 'Unauthorized' };

  const timestamp = new Date();

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: 'SECRET_REVEALED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  const secret = await db.query.secrets.findFirst({
    where: and(eq(secrets.id, id), eq(secrets.userId, user.id)),
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    const sendResult = await emailService.sendSecurityAlert({
      to: email,
      event: 'SECRET_REVEALED',
      serviceName: secret?.name || 'Protected Secret',
      actionName: 'Secret Revealed',
      time: timestamp,
    });
    return sendResult;
  }

  return { success: false, error: 'User does not have a verified email address in Clerk.' };
}

export async function recordSecretCopy(id: string) {
  const user = await currentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const timestamp = new Date();

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: 'SECRET_COPIED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  const secret = await db.query.secrets.findFirst({
    where: and(eq(secrets.id, id), eq(secrets.userId, user.id)),
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECRET_COPIED',
      serviceName: secret?.name || 'Protected Secret',
      actionName: 'Secret Copied',
      time: timestamp,
    });
  }

  return { success: true };
}

export async function deleteSecret(id: string, confirmationPhrase: string) {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) throw new Error('Unauthorized');

  if (confirmationPhrase !== 'DELETE PERMANENTLY') {
    throw new Error('Invalid confirmation phrase. Secret deletion aborted.');
  }

  const secret = await db.query.secrets.findFirst({
    where: and(eq(secrets.id, id), eq(secrets.userId, userId)),
  });

  const timestamp = new Date();

  await db.update(secrets)
    .set({ isDeleted: true, deletedAt: timestamp, updatedAt: timestamp })
    .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_DELETED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECRET_DELETED',
      serviceName: secret?.name || 'Protected Secret',
      actionName: 'Secret Deleted',
      time: timestamp,
    });
  }

  return { success: true };
}

export async function restoreSecret(id: string) {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) throw new Error('Unauthorized');

  const secret = await db.query.secrets.findFirst({
    where: and(eq(secrets.id, id), eq(secrets.userId, userId)),
  });

  const timestamp = new Date();

  await db.update(secrets)
    .set({ isDeleted: false, deletedAt: null, updatedAt: timestamp })
    .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_RESTORED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECRET_RESTORED',
      serviceName: secret?.name || 'Protected Secret',
      actionName: 'Secret Restored',
      time: timestamp,
    });
  }

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
  const user = await currentUser();
  const userId = user?.id;
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

  const timestamp = new Date();

  await db.update(secrets)
    .set({
      name: data.name,
      category: data.category,
      tags: data.tags || '[]',
      encryptedData: data.encryptedData,
      updatedAt: timestamp,
    })
    .where(and(eq(secrets.id, id), eq(secrets.userId, userId)));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'SECRET_UPDATED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  // Log the reason as a separate audit entry for visibility
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: `SECRET_EDIT_REASON: ${data.editReason.trim().substring(0, 100)}`,
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  const email = getUserVerifiedEmail(user);
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECRET_EDITED',
      serviceName: data.name,
      actionName: 'Secret Edited',
      time: timestamp,
    });
  }

  return { success: true };
}
