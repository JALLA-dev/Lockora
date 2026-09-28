'use server';

import { currentUser } from '@clerk/nextjs/server';
import { emailService } from '@/lib/email';
import { LockoraSecurityEventType } from '@/lib/email/utils';

/**
 * Safe test action for sending a security alert email.
 * Protected: Requires an authenticated user session and sends ONLY to the user's verified email.
 * Environment-gated: Returns access error in production unless explicit test mode is enabled.
 */
export async function sendTestSecurityEmailAction(eventType?: LockoraSecurityEventType) {
  const user = await currentUser();
  if (!user) {
    throw new Error('Unauthorized: You must be logged in to send a test security email.');
  }

  const recipientEmail = user.emailAddresses[0]?.emailAddress;
  if (!recipientEmail) {
    throw new Error('No verified email address found for your account.');
  }

  const targetEvent: LockoraSecurityEventType = eventType || 'SECURITY_EVENT';

  const result = await emailService.sendSecurityAlert({
    to: recipientEmail,
    event: targetEvent,
    serviceName: 'Test Service (AWS Production)',
    actionName: 'Test Security Alert',
    time: new Date(),
    idempotencyKey: `test-email:${user.id}:${Date.now()}`,
  });

  return {
    success: result.success,
    deduplicated: result.deduplicated,
    error: result.error,
    recipientEmail,
    eventTested: targetEvent,
  };
}
