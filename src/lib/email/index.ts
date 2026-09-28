import { Resend } from 'resend';
import {
  LockoraSecurityEventType,
  formatSecurityEmailContent,
  isValidEmail,
  containsSensitiveData,
} from './utils';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  deduplicated?: boolean;
}

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<SendEmailResult>;
}

/**
 * Safely mask email for development logging (e.g., "jo***@example.com").
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***@***.com';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
}

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail?: string) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  }

  async sendEmail(options: EmailOptions): Promise<SendEmailResult> {
    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (response.error) {
        return {
          success: false,
          error: `Resend API Error [${response.error.name || 'API_ERROR'}]: ${response.error.message}`,
        };
      }

      return { success: true, id: response.data?.id };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send email via Resend SDK.',
      };
    }
  }
}

export class MockEmailProvider implements EmailProvider {
  public sentEmails: EmailOptions[] = [];
  public shouldFail: boolean = false;
  public failMessage: string = 'Mock provider simulated failure';

  async sendEmail(options: EmailOptions): Promise<SendEmailResult> {
    if (this.shouldFail) {
      return { success: false, error: this.failMessage };
    }
    this.sentEmails.push(options);
    console.log(`[Mock Email Delivery] Subject: "${options.subject}" -> To: ${maskEmail(options.to)}`);
    return { success: true, id: `mock-${Date.now()}` };
  }
}

export interface SecurityAlertParams {
  to: string;
  event: LockoraSecurityEventType;
  serviceName?: string;
  actionName?: string;
  time?: Date;
  details?: string;
  idempotencyKey?: string;
}

export class EmailService {
  private customProvider?: EmailProvider;
  private dedupCache: Map<string, number> = new Map();
  private dedupTtlMs: number = 60 * 1000; // 60-second window

  constructor(provider?: EmailProvider) {
    if (provider) {
      this.customProvider = provider;
    }
  }

  public setProvider(provider: EmailProvider) {
    this.customProvider = provider;
  }

  /**
   * Dynamically resolves the active EmailProvider.
   * Checks process.env.RESEND_API_KEY dynamically on every request.
   */
  public getProvider(): EmailProvider {
    if (this.customProvider) {
      return this.customProvider;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      return new ResendEmailProvider(apiKey.trim());
    }
    return new MockEmailProvider();
  }

  public clearDeduplicationCache() {
    this.dedupCache.clear();
  }

  private isDuplicate(key: string): boolean {
    const now = Date.now();
    const lastSent = this.dedupCache.get(key);
    if (lastSent && now - lastSent < this.dedupTtlMs) {
      return true;
    }
    return false;
  }

  private recordSent(key: string) {
    this.dedupCache.set(key, Date.now());
    const now = Date.now();
    for (const [k, v] of this.dedupCache.entries()) {
      if (now - v > this.dedupTtlMs) {
        this.dedupCache.delete(k);
      }
    }
  }

  /**
   * Main entry point for sending security alerts.
   * Includes safe server-side diagnostic logging (Requirement 7 & 8).
   */
  public async sendSecurityAlert(params: SecurityAlertParams): Promise<SendEmailResult> {
    try {
      if (!params.to || !isValidEmail(params.to)) {
        console.warn(`[Lockora Email System] Skipped email delivery: Invalid recipient email "${params.to}"`);
        return { success: false, error: 'Invalid or missing recipient email address.' };
      }

      const maskedRecipient = maskEmail(params.to);

      // Check for sensitive plaintext leakage in parameters
      if (
        containsSensitiveData(params.serviceName || '') ||
        containsSensitiveData(params.details || '') ||
        containsSensitiveData(params.actionName || '')
      ) {
        console.error('[Lockora Email System] BLOCKED send attempt due to detected sensitive plaintext parameter.');
        return {
          success: false,
          error: 'Email blocked: sensitive data pattern detected in email input.',
        };
      }

      // Compute deduplication key
      const dedupKey =
        params.idempotencyKey ||
        `${params.to.toLowerCase()}:${params.event}:${params.serviceName || ''}:${params.actionName || ''}`;

      if (this.isDuplicate(dedupKey)) {
        console.log(`[Lockora Email System] Deduplicated duplicate alert for ${params.event} to ${maskedRecipient}`);
        return { success: true, deduplicated: true };
      }

      const activeProvider = this.getProvider();

      console.log(`[Lockora Email System] --------------------------------------------------`);
      console.log(`[Lockora Email System] Security Event Triggered: ${params.event}`);
      console.log(`[Lockora Email System] Attempting delivery to recipient: ${maskedRecipient}`);
      console.log(`[Lockora Email System] Active Email Provider: ${activeProvider.constructor.name}`);

      const content = formatSecurityEmailContent({
        event: params.event,
        serviceName: params.serviceName,
        actionName: params.actionName,
        time: params.time || new Date(),
        details: params.details,
      });

      const result = await activeProvider.sendEmail({
        to: params.to.trim(),
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      if (result.success) {
        console.log(`[Lockora Email System] SUCCESS - Email delivered successfully! Resend Response ID: ${result.id || 'N/A'}`);
        console.log(`[Lockora Email System] --------------------------------------------------`);
        this.recordSent(dedupKey);
      } else {
        console.error(`[Lockora Email System] ERROR - Email delivery failed for event ${params.event}`);
        console.error(`[Lockora Email System] Error Details: ${result.error}`);
        console.log(`[Lockora Email System] --------------------------------------------------`);
      }

      return result;
    } catch (err: any) {
      console.error(
        `[Lockora Email System] Exception sending security alert for ${params.event}:`,
        err?.message || 'Unknown error'
      );
      return {
        success: false,
        error: err?.message || 'Unexpected exception during email delivery.',
      };
    }
  }
}

export const emailService = new EmailService();
