import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<void>;
}

class ResendProvider implements EmailProvider {
  private resend: Resend;
  
  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async sendEmail(options: EmailOptions) {
    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || 'security@lockora.example',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}

class MockProvider implements EmailProvider {
  async sendEmail(options: EmailOptions) {
    console.log('[Mock Email]', options.subject, '->', options.to);
  }
}

class EmailService {
  private provider: EmailProvider;

  constructor() {
    const providerName = process.env.EMAIL_PROVIDER || 'mock';
    
    if (providerName === 'resend' && process.env.EMAIL_API_KEY) {
      this.provider = new ResendProvider(process.env.EMAIL_API_KEY);
    } else {
      this.provider = new MockProvider();
    }
  }

  async sendSecurityAlert(to: string, event: string, time: Date) {
    const html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
        <h2>Lockora Security Alert</h2>
        <p>A protected event occurred in your Lockora vault.</p>
        <p><strong>Event:</strong> ${event}</p>
        <p><strong>Time:</strong> ${time.toUTCString()}</p>
        <p>If this was not you, please sign in and review your active sessions immediately.</p>
      </div>
    `;
    
    await this.provider.sendEmail({
      to,
      subject: `Lockora Security Alert — ${event}`,
      html,
    });
  }
}

export const emailService = new EmailService();
