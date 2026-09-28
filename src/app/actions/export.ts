'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { secrets, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/email';

export async function fetchAllSecretsForExport() {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized');

  const allSecrets = await db.query.secrets.findMany({
    where: and(
      eq(secrets.userId, user.id),
      eq(secrets.isDeleted, false)
    ),
  });

  const timestamp = new Date();
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: 'EXPORT_CREATED',
    resource: 'Lockora Data',
    result: 'SUCCESS',
    timestamp,
  });

  const email = user.emailAddresses[0]?.emailAddress;
  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'SECURITY_EVENT',
      serviceName: 'Lockora Export',
      actionName: 'Lockora Data Export Created',
      time: timestamp,
    });
  }

  return allSecrets;
}
