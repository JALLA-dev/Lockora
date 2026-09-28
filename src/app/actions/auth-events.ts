'use server';

import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { emailService } from '@/lib/email';
import { getUserVerifiedEmail, getUserDisplayName, LockoraSecurityEventType } from '@/lib/email/utils';
import crypto from 'crypto';

export async function recordNewLoginSession(ipAddress?: string) {
  const user = await currentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const timestamp = new Date();
  const email = getUserVerifiedEmail(user);
  const userName = getUserDisplayName(user);

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
      serviceName: 'Lockora Account Login',
      actionName: 'New Login Session',
      userName,
      time: timestamp,
      idempotencyKey: `login:${user.id}:${timestamp.toISOString().substring(0, 16)}`,
    });
  }

  return { success: true };
}

export async function recordMfaEvent(
  eventType: 'MFA_ENABLED' | 'MFA_DISABLED' | 'MFA_ENROLLMENT_STARTED' | 'MFA_AUTH_SUCCESS' | 'MFA_AUTH_FAILURE' | 'MFA_BACKUP_CODE_USED',
  details?: string
) {
  const user = await currentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const timestamp = new Date();
  const email = getUserVerifiedEmail(user);
  const userName = getUserDisplayName(user);

  let mappedEvent: LockoraSecurityEventType = 'SECURITY_EVENT';
  let actionName = 'MFA Event';

  switch (eventType) {
    case 'MFA_ENABLED':
      mappedEvent = 'MFA_ENABLED';
      actionName = 'Authenticator App MFA Enabled';
      break;
    case 'MFA_DISABLED':
      mappedEvent = 'MFA_DISABLED';
      actionName = 'Authenticator App MFA Disabled';
      break;
    case 'MFA_ENROLLMENT_STARTED':
      mappedEvent = 'SECURITY_EVENT';
      actionName = 'MFA Enrollment Started';
      break;
    case 'MFA_AUTH_SUCCESS':
      mappedEvent = 'SECURITY_EVENT';
      actionName = 'MFA Authenticator Code Verified';
      break;
    case 'MFA_AUTH_FAILURE':
      mappedEvent = 'SECURITY_EVENT';
      actionName = 'Failed MFA Authenticator Attempt';
      break;
    case 'MFA_BACKUP_CODE_USED':
      mappedEvent = 'SECURITY_EVENT';
      actionName = 'MFA Backup Code Recovery Used';
      break;
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: eventType,
    resource: 'Lockora Multi-Factor Authentication',
    result: eventType.includes('FAILURE') ? 'FAILURE' : 'SUCCESS',
    timestamp,
  });

  // Trigger security email for critical MFA events
  if (email && (eventType === 'MFA_ENABLED' || eventType === 'MFA_DISABLED' || eventType === 'MFA_BACKUP_CODE_USED')) {
    await emailService.sendSecurityAlert({
      to: email,
      event: mappedEvent,
      serviceName: 'Lockora Multi-Factor Authentication',
      actionName,
      userName,
      time: timestamp,
      details,
    });
  }

  return { success: true };
}
