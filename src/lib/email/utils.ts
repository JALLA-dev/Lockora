export type LockoraSecurityEventType =
  | 'SECRET_REVEALED'
  | 'SECRET_COPIED'
  | 'LOCKORA_PASSWORD_CHANGED'
  | 'LOCKORA_PASSWORD_FAILED'
  | 'LOCKORA_PASSWORD_VERIFIED'
  | 'NEW_LOGIN'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'SECRET_CREATED'
  | 'SECRET_EDITED'
  | 'SECRET_DELETED'
  | 'SECRET_RESTORED'
  | 'SECRET_EXPIRY_REMINDER'
  | 'SECRET_EXPIRED'
  | 'ROTATION_REMINDER'
  | 'SECURITY_EVENT';

export interface SecurityEventConfig {
  subject: string;
  summary: string;
  action: string;
}

export const EVENT_CONFIGS: Record<LockoraSecurityEventType, SecurityEventConfig> = {
  SECRET_REVEALED: {
    subject: 'Lockora Security Alert — Protected Secret Accessed',
    summary: 'A protected secret in your Lockora account was accessed successfully.',
    action: 'Secret Revealed',
  },
  SECRET_COPIED: {
    subject: 'Lockora Security Alert — Protected Secret Copied',
    summary: 'A protected secret value was copied to the clipboard in your Lockora account.',
    action: 'Secret Copied',
  },
  LOCKORA_PASSWORD_CHANGED: {
    subject: 'Lockora Security Alert — Lockora Password Changed',
    summary: 'Your Lockora Password was changed successfully.',
    action: 'Lockora Password Changed',
  },
  LOCKORA_PASSWORD_FAILED: {
    subject: 'Lockora Security Alert — Failed Lockora Password Attempt',
    summary: 'An incorrect Lockora Password attempt was recorded for your account.',
    action: 'Failed Lockora Password Attempt',
  },
  LOCKORA_PASSWORD_VERIFIED: {
    subject: 'Lockora Security Alert — Lockora Password Verified',
    summary: 'Your Lockora Password was verified to unlock access.',
    action: 'Lockora Password Verified',
  },
  NEW_LOGIN: {
    subject: 'Lockora Security Alert — New Login Session',
    summary: 'A new login session was initiated for your Lockora account.',
    action: 'New Login Session',
  },
  MFA_ENABLED: {
    subject: 'Lockora Security Alert — Multi-Factor Authentication Enabled',
    summary: 'Multi-Factor Authentication (MFA) was enabled on your Lockora account.',
    action: 'MFA Enabled',
  },
  MFA_DISABLED: {
    subject: 'Lockora Security Alert — Multi-Factor Authentication Disabled',
    summary: 'Multi-Factor Authentication (MFA) was disabled on your Lockora account.',
    action: 'MFA Disabled',
  },
  SECRET_CREATED: {
    subject: 'Lockora Security Alert — New Protected Secret Created',
    summary: 'A new protected secret entry was added to your Lockora account.',
    action: 'Secret Created',
  },
  SECRET_EDITED: {
    subject: 'Lockora Security Alert — Protected Secret Edited',
    summary: 'A protected secret entry was updated in your Lockora account.',
    action: 'Secret Edited',
  },
  SECRET_DELETED: {
    subject: 'Lockora Security Alert — Protected Secret Deleted',
    summary: 'A protected secret entry was deleted in your Lockora account.',
    action: 'Secret Deleted',
  },
  SECRET_RESTORED: {
    subject: 'Lockora Security Alert — Protected Secret Restored',
    summary: 'A deleted protected secret was restored in your Lockora account.',
    action: 'Secret Restored',
  },
  SECRET_EXPIRY_REMINDER: {
    subject: 'Lockora Security Alert — Secret Expiry Reminder',
    summary: 'A protected secret in your Lockora account is set to expire soon.',
    action: 'Secret Expiry Reminder',
  },
  SECRET_EXPIRED: {
    subject: 'Lockora Security Alert — Secret Expired',
    summary: 'A protected secret in your Lockora account has expired.',
    action: 'Secret Expired',
  },
  ROTATION_REMINDER: {
    subject: 'Lockora Security Alert — Secret Rotation Reminder',
    summary: 'A protected secret in your Lockora account requires periodic rotation.',
    action: 'Rotation Reminder',
  },
  SECURITY_EVENT: {
    subject: 'Lockora Security Alert — Security Event Recorded',
    summary: 'A security event was recorded in your Lockora account.',
    action: 'Security Event',
  },
};

/**
 * Safely extracts the authenticated user's verified primary email address from Clerk user object.
 */
export function getUserVerifiedEmail(user: any): string | null {
  if (!user || !user.emailAddresses || !Array.isArray(user.emailAddresses) || user.emailAddresses.length === 0) {
    return null;
  }
  if (user.primaryEmailAddressId) {
    const primary = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId);
    if (primary && primary.emailAddress) {
      return primary.emailAddress;
    }
  }
  const verified = user.emailAddresses.find((e: any) => e.verification?.status === 'verified');
  if (verified && verified.emailAddress) {
    return verified.emailAddress;
  }
  return user.emailAddresses[0]?.emailAddress || null;
}

/**
 * Safely resolves user's full or display name for email greetings.
 */
export function getUserDisplayName(user: any): string {
  if (!user) return 'Lockora User';
  if (user.fullName && user.fullName.trim().length > 0) return user.fullName.trim();
  const nameParts = [user.firstName, user.lastName].filter((p) => p && p.trim().length > 0);
  if (nameParts.length > 0) return nameParts.join(' ').trim();
  return 'Lockora User';
}

/**
 * Format date in UTC e.g. "28 September 2026, 15:30 UTC"
 */
export function formatSecurityDate(date: Date = new Date()): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const day = d.getUTCDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
}

/**
 * Basic HTML character escaping to prevent XSS in HTML emails.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates basic email address structure.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Inspects a string to guarantee it does NOT contain sensitive material like plaintext secrets,
 * RSA private keys, passwords, API keys, or recovery codes.
 */
export function containsSensitiveData(input: string): boolean {
  if (!input) return false;
  
  const sensitivePatterns = [
    /-----BEGIN[ A-Z]*PRIVATE KEY-----/i,
    /-----BEGIN CERTIFICATE-----/i,
    /{"kty":"RSA"/i,
    /{"kty":"EC"/i,
    /re_[a-zA-Z0-9_]{20,}/, // Resend API keys
    /sk_test_[a-zA-Z0-9_]{20,}/, // Clerk / Stripe secret keys
    /pk_test_[a-zA-Z0-9_]{20,}/,
    /\b(password|secret|private_key|recovery_code|token)\s*[:=]\s*["']?[^\s"']{8,}/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(input));
}

/**
 * Formats both Plain Text and HTML versions of the security email adhering to strict Lockora templates.
 */
export function formatSecurityEmailContent(params: {
  event: LockoraSecurityEventType;
  serviceName?: string;
  actionName?: string;
  userName?: string;
  time?: Date;
  details?: string;
}): { subject: string; text: string; html: string } {
  // Validate that no sensitive data is leaked in input metadata
  if (containsSensitiveData(params.serviceName || '') || containsSensitiveData(params.details || '')) {
    throw new Error('Security Error: Plaintext sensitive data or credentials detected in email parameters.');
  }

  const timeStr = formatSecurityDate(params.time);
  const eventConfig = EVENT_CONFIGS[params.event] || EVENT_CONFIGS.SECURITY_EVENT;
  
  const subject = eventConfig.subject;
  const action = params.actionName || eventConfig.action;
  const service = params.serviceName || 'Lockora Data';
  const greeting = params.userName && params.userName.trim().length > 0
    ? `Dear ${params.userName.trim()},`
    : 'Dear Lockora User,';

  const text = `${subject}

${greeting}

A protected secret in your Lockora account was accessed successfully.

Service: ${service}
Action: ${action}
Time: ${timeStr}

This notification was generated because a protected secret was accessed.

If you performed this action, no further action is required.

If you did not perform this action, please sign in to Lockora and review your security activity immediately.

Lockora Security Team
Secure. Private. Protected.`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 32px 16px;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 36px; box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.6);">
    
    <!-- Header with Lockora Shield Logo -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; border-bottom: 1px solid #27272a; padding-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #ffffff; font-size: 18px; line-height: 36px; text-align: center;">
          🔒
        </div>
        <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.03em;">Lockora</span>
      </div>
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #818cf8; background-color: rgba(99, 102, 241, 0.15); padding: 4px 10px; border-radius: 20px; font-weight: 600; border: 1px solid rgba(99, 102, 241, 0.3);">
        Security Alert
      </span>
    </div>

    <!-- Greeting & Summary -->
    <p style="font-size: 16px; color: #ffffff; font-weight: 600; margin-top: 0; margin-bottom: 12px;">
      ${escapeHtml(greeting)}
    </p>

    <p style="font-size: 15px; color: #d4d4d8; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
      A protected secret in your Lockora account was accessed successfully.
    </p>

    <!-- Metadata Details Box -->
    <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600; width: 100px;">Service</td>
          <td style="padding-bottom: 12px; font-size: 15px; color: #ffffff; font-weight: 600;">${escapeHtml(service)}</td>
        </tr>
        <tr>
          <td style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600;">Action</td>
          <td style="padding-bottom: 12px; font-size: 15px; color: #34d399; font-weight: 600;">${escapeHtml(action)}</td>
        </tr>
        <tr>
          <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600;">Time</td>
          <td style="font-size: 15px; color: #ffffff; font-weight: 500;">${escapeHtml(timeStr)}</td>
        </tr>
      </table>
    </div>

    <!-- Security Guidance Callout -->
    <div style="background-color: rgba(239, 68, 68, 0.08); border-left: 4px solid #f87171; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 28px;">
      <p style="font-size: 13px; color: #fca5a5; margin: 0; line-height: 1.5; font-weight: 500;">
        This notification was generated because a protected secret was accessed.
      </p>
      <p style="font-size: 13px; color: #e4e4e7; margin: 8px 0 0 0; line-height: 1.5;">
        If you performed this action, no further action is required.
      </p>
      <p style="font-size: 13px; color: #f87171; margin: 8px 0 0 0; line-height: 1.5; font-weight: 600;">
        If you did not perform this action, please sign in to Lockora and review your security activity immediately.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #27272a; padding-top: 20px; margin-top: 10px; font-size: 12px; color: #71717a; text-align: center; line-height: 1.6;">
      <strong style="color: #a1a1aa;">Lockora Security Team</strong><br/>
      <span style="letter-spacing: 0.05em; color: #6366f1;">Secure. Private. Protected.</span>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
