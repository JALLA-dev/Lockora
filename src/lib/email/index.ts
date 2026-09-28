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
        return { success: false, error: response.error.message };
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
    console.log(`[Mock Email Sent] Subject: "${options.subject}" -> To: ${options.to}`);
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
  private provider: EmailProvider;
  private dedupCache: Map<string, number> = new Map();
  private dedupTtlMs: number = 60 * 1000; // 60-second window

  constructor(provider?: EmailProvider) {
    if (provider) {
      this.provider = provider;
    } else if (process.env.RESEND_API_KEY) {
      this.provider = new ResendEmailProvider(process.env.RESEND_API_KEY);
    } else {
      this.provider = new MockEmailProvider();
    }
  }

  public setProvider(provider: EmailProvider) {
    this.provider = provider;
  }

  public getProvider(): EmailProvider {
    return this.provider;
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
    // Prune stale cache entries
    const now = Date.now();
    for (const [k, v] of this.dedupCache.entries()) {
      if (now - v > this.dedupTtlMs) {
        this.dedupCache.delete(k);
      }
    }
  }

  /**
   * Reusable function to send security alerts to users.
   * Safe error handling ensures email failures never crash caller or reveal sensitive material.
   */
  public async sendSecurityAlert(params: SecurityAlertParams): Promise<SendEmailResult> {
    try {
      if (!params.to || !isValidEmail(params.to)) {
        return { success: false, error: 'Invalid or missing recipient email address.' };
      }

      // Check for sensitive plaintext leakage in parameters
      if (
        containsSensitiveData(params.serviceName || '') ||
        containsSensitiveData(params.details || '') ||
        containsSensitiveData(params.actionName || '')
      ) {
        console.error('[EmailService] Blocked email send attempt due to detected sensitive plaintext parameter.');
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
        return { success: true, deduplicated: true };
      }

      const content = formatSecurityEmailContent({
        event: params.event,
        serviceName: params.serviceName,
        actionName: params.actionName,
        time: params.time || new Date(),
        details: params.details,
      });

      const result = await this.provider.sendEmail({
        to: params.to.trim(),
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      if (result.success) {
        this.recordSent(dedupKey);
      } else {
        console.error(`[EmailService] Non-blocking alert send failure for event ${params.event}:`, result.error);
      }

      return result;
    } catch (err: any) {
      console.error(
        `[EmailService] Non-blocking exception sending security alert for ${params.event}:`,
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
