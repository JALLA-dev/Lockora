'use server';

import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { emailService } from '@/lib/email';
import crypto from 'crypto';

export async function recordNewLoginSession(ipAddress?: string) {
  const user = await currentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const timestamp = new Date();
  const email = user.emailAddresses[0]?.emailAddress;

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: 'NEW_LOGIN',
    resource: 'Lockora Session',
    result: 'SUCCESS',
    ipAddress: ipAddress || null,
    timestamp,
  });

  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event: 'NEW_LOGIN',
      serviceName: 'Lockora Session',
      actionName: 'New Login Session',
      time: timestamp,
      idempotencyKey: `login:${user.id}:${timestamp.toISOString().substring(0, 16)}`,
    });
  }

  return { success: true };
}

export async function recordMfaEvent(enabled: boolean) {
  const user = await currentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const timestamp = new Date();
  const email = user.emailAddresses[0]?.emailAddress;
  const event = enabled ? 'MFA_ENABLED' : 'MFA_DISABLED';
  const actionName = enabled ? 'MFA Enabled' : 'MFA Disabled';

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: event,
    resource: 'Lockora Security',
    result: 'SUCCESS',
    timestamp,
  });

  if (email) {
    await emailService.sendSecurityAlert({
      to: email,
      event,
      serviceName: 'Lockora Multi-Factor Authentication',
      actionName,
      time: timestamp,
    });
  }

  return { success: true };
}
