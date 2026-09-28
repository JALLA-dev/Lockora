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
    summary: 'A protected secret was accessed in your Lockora account.',
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
  const summary = eventConfig.summary;
  const action = params.actionName || eventConfig.action;
  const service = params.serviceName || 'Lockora Vault';

  const text = `${subject}

${summary}

Service:
${service}

Action:
${action}

Time:
${timeStr}

If you did not perform this action, review your Lockora security activity.

Do not include the actual secret value.`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    <div style="margin-bottom: 24px;">
      <h2 style="color: #6366f1; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Lockora Security Alert</h2>
    </div>
    
    <p style="font-size: 15px; color: #e4e4e7; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
      ${escapeHtml(summary)}
    </p>

    <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <div style="margin-bottom: 14px;">
        <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600;">Service</span>
        <div style="font-size: 15px; color: #ffffff; font-weight: 500; margin-top: 2px;">${escapeHtml(service)}</div>
      </div>

      <div style="margin-bottom: 14px;">
        <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600;">Action</span>
        <div style="font-size: 15px; color: #ffffff; font-weight: 500; margin-top: 2px;">${escapeHtml(action)}</div>
      </div>

      <div>
        <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; font-weight: 600;">Time</span>
        <div style="font-size: 15px; color: #ffffff; font-weight: 500; margin-top: 2px;">${escapeHtml(timeStr)}</div>
      </div>
    </div>

    <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 24px;">
      If you did not perform this action, review your Lockora security activity.
    </p>

    <div style="border-top: 1px solid #27272a; padding-top: 16px; font-size: 12px; color: #71717a; text-align: center;">
      Do not include the actual secret value. This is an automated notification.
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
