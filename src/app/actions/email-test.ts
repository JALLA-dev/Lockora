'use server';

import { currentUser } from '@clerk/nextjs/server';
import { emailService } from '@/lib/email';
import { LockoraSecurityEventType } from '@/lib/email/utils';

/**
 * Server-side Resend test function sending to delivered@resend.dev
 * FROM: onboarding@resend.dev
 * TO: delivered@resend.dev
 * SUBJECT: Lockora Resend Test
 * BODY: Lockora email service is working.
 * Uses: process.env.RESEND_API_KEY
 */
export async function sendResendDiagnosticTestEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  const hasApiKey = Boolean(apiKey && apiKey.trim().length > 0);

  if (!hasApiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY is missing or empty in the active runtime environment.',
      hasApiKey: false,
    };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey?.trim());

  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: 'delivered@resend.dev',
      subject: 'Lockora Resend Test',
      html: '<p>Lockora email service is working.</p>',
      text: 'Lockora email service is working.',
    });

    if (response.error) {
      return {
        success: false,
        error: `Resend API Error [${response.error.name || 'API_ERROR'}]: ${response.error.message}`,
        hasApiKey: true,
      };
    }

    return {
      success: true,
      id: response.data?.id,
      hasApiKey: true,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unexpected exception calling Resend API.',
      hasApiKey: true,
    };
  }
}

/**
 * Requirement 13: Standalone development-only test email function
 */
export async function sendStandaloneTestEmailAction() {
  const user = await currentUser();
  if (!user) {
    throw new Error('Unauthorized: You must be logged in to send a test email.');
  }

  const recipientEmail = user.emailAddresses[0]?.emailAddress;
  if (!recipientEmail) {
    throw new Error('No verified email address found for your account.');
  }

  const provider = emailService.getProvider();
  
  console.log(`[Lockora Test Email Diagnostic] Sending standalone test email...`);
  console.log(`[Lockora Test Email Diagnostic] Target recipient: ${recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`);
  console.log(`[Lockora Test Email Diagnostic] Provider: ${provider.constructor.name}`);

  const result = await provider.sendEmail({
    to: recipientEmail,
    subject: 'Lockora Test Email',
    html: '<p>Lockora email service is working.</p>',
    text: 'Lockora email service is working.',
  });

  if (result.success) {
    console.log(`[Lockora Test Email Diagnostic] Standalone test email SUCCESS! Response ID: ${result.id}`);
  } else {
    console.error(`[Lockora Test Email Diagnostic] Standalone test email ERROR:`, result.error);
  }

  return {
    success: result.success,
    id: result.id,
    error: result.error,
    recipientEmail: recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    providerUsed: provider.constructor.name,
  };
}

/**
 * Safe test action for sending a full security alert email.
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
    serviceName: 'AWS Production',
    actionName: 'Test Security Alert',
    time: new Date(),
    idempotencyKey: `test-email:${user.id}:${Date.now()}`,
  });

  return {
    success: result.success,
    deduplicated: result.deduplicated,
    error: result.error,
    recipientEmail: recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    eventTested: targetEvent,
  };
}
