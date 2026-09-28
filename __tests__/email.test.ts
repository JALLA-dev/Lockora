import { EmailService, MockEmailProvider, ResendEmailProvider, emailService } from '../src/lib/email';
import { formatSecurityEmailContent, containsSensitiveData, isValidEmail } from '../src/lib/email/utils';

// Mock Clerk auth for test action
jest.mock('@clerk/nextjs/server', () => ({
  currentUser: jest.fn().mockResolvedValue({
    id: 'user_test123',
    emailAddresses: [{ emailAddress: 'user@example.com' }],
  }),
  auth: jest.fn().mockResolvedValue({ userId: 'user_test123' }),
}));

describe('Lockora Email Alert System', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Requirement 15.1: Successful Email Delivery', () => {
    it('should send security email successfully using provider', async () => {
      const mockProvider = new MockEmailProvider();
      const service = new EmailService(mockProvider);

      const result = await service.sendSecurityAlert({
        to: 'user@example.com',
        event: 'SECRET_REVEALED',
        serviceName: 'AWS Production',
        actionName: 'Secret Revealed',
        time: new Date('2026-09-28T15:30:00Z'),
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(mockProvider.sentEmails.length).toBe(1);

      const sent = mockProvider.sentEmails[0];
      expect(sent.to).toBe('user@example.com');
      expect(sent.subject).toContain('Protected Secret Accessed');
      expect(sent.text).toContain('AWS Production');
      expect(sent.text).toContain('Secret Revealed');
    });
  });

  describe('Requirement 15.2: Failed Email Handling', () => {
    it('should handle provider errors gracefully without crashing or throwing', async () => {
      const mockProvider = new MockEmailProvider();
      mockProvider.shouldFail = true;
      mockProvider.failMessage = 'Provider connection timeout';

      const service = new EmailService(mockProvider);

      const result = await service.sendSecurityAlert({
        to: 'user@example.com',
        event: 'LOCKORA_PASSWORD_FAILED',
        serviceName: 'Lockora Access',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Provider connection timeout');
    });
  });

  describe('Requirement 15.3: Missing RESEND_API_KEY', () => {
    it('should fallback safely to MockEmailProvider when RESEND_API_KEY is not set', () => {
      delete process.env.RESEND_API_KEY;

      const service = new EmailService();
      const provider = service.getProvider();

      expect(provider).toBeInstanceOf(MockEmailProvider);
    });

    it('should initialize ResendEmailProvider when RESEND_API_KEY is set', () => {
      process.env.RESEND_API_KEY = 're_test_key_12345';

      const service = new EmailService();
      const provider = service.getProvider();

      expect(provider).toBeInstanceOf(ResendEmailProvider);
    });
  });

  describe('Requirement 15.4: Invalid Recipient Handling', () => {
    it('should reject invalid or missing recipient email addresses', async () => {
      const service = new EmailService(new MockEmailProvider());

      const result1 = await service.sendSecurityAlert({
        to: 'not-an-email',
        event: 'SECRET_CREATED',
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid or missing recipient email address.');

      const result2 = await service.sendSecurityAlert({
        to: '',
        event: 'SECRET_CREATED',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Invalid or missing recipient email address.');
    });

    it('should correctly validate email addresses', () => {
      expect(isValidEmail('test@lockora.dev')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('Requirement 15.5: No Secret Plaintext in Email', () => {
    it('should generate security emails without including secret values or credentials', () => {
      const emailContent = formatSecurityEmailContent({
        event: 'SECRET_REVEALED',
        serviceName: 'Database Master Password',
        actionName: 'Secret Revealed',
        time: new Date('2026-09-28T15:30:00Z'),
      });

      expect(emailContent.subject).toBe('Lockora Security Alert — Protected Secret Accessed');
      expect(emailContent.text).not.toContain('supersecretpassword');
      expect(emailContent.html).not.toContain('supersecretpassword');
      expect(emailContent.text).toContain('This notification was generated because a protected secret was accessed.');
      expect(emailContent.html).toContain('This notification was generated because a protected secret was accessed.');
    });

    it('should block sendSecurityAlert if sensitive pattern is detected in metadata', async () => {
      const service = new EmailService(new MockEmailProvider());

      const result = await service.sendSecurityAlert({
        to: 'user@example.com',
        event: 'SECRET_EDITED',
        serviceName: '-----BEGIN RSA PRIVATE KEY----- MIIEogIBAAKCAQEA0',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sensitive data pattern detected');
    });

    it('should detect sensitive data patterns correctly', () => {
      expect(containsSensitiveData('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
      expect(containsSensitiveData('re_mock_api_key_00000000000000000000')).toBe(true);
      expect(containsSensitiveData('password="mysecretpassword123"')).toBe(true);
      expect(containsSensitiveData('AWS Production')).toBe(false);
      expect(containsSensitiveData('Database Credentials')).toBe(false);
    });
  });

  describe('Requirement 15.6: No Secret Plaintext in Logs', () => {
    it('should not leak API keys, passwords, or secrets to console logs', async () => {
      const consoleSpyLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleSpyErr = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockProvider = new MockEmailProvider();
      const service = new EmailService(mockProvider);

      await service.sendSecurityAlert({
        to: 'user@example.com',
        event: 'SECRET_ACCESSED' as any,
        serviceName: 'Safe Metadata Service',
      });

      const allLogCalls = [...consoleSpyLog.mock.calls, ...consoleSpyErr.mock.calls]
        .map((args) => args.join(' '))
        .join(' ');

      expect(allLogCalls).not.toContain('re_mock_api_key_00000000000000000000');
      expect(allLogCalls).not.toContain('Vault Password');

      consoleSpyLog.mockRestore();
      consoleSpyErr.mockRestore();
    });
  });

  describe('Requirement 15.7: API Key Isolation from Frontend', () => {
    it('should never return RESEND_API_KEY to caller or frontend response', async () => {
      const { sendTestSecurityEmailAction } = require('../src/app/actions/email-test');

      const actionResult = await sendTestSecurityEmailAction('SECRET_REVEALED');

      expect(actionResult.success).toBe(true);
      expect(actionResult.recipientEmail).toBe('us***@example.com');
      expect((actionResult as any).RESEND_API_KEY).toBeUndefined();
      expect((actionResult as any).apiKey).toBeUndefined();
      expect(JSON.stringify(actionResult)).not.toContain('re_');
    });
  });

  describe('Requirement 12: Deduplication / Idempotency', () => {
    it('should deduplicate rapid duplicate email alert requests', async () => {
      const mockProvider = new MockEmailProvider();
      const service = new EmailService(mockProvider);

      const res1 = await service.sendSecurityAlert({
        to: 'user@example.com',
        event: 'SECRET_COPIED',
        serviceName: 'Production API Key',
      });

      const res2 = await service.sendSecurityAlert({
        to: 'user@example.com',
        event: 'SECRET_COPIED',
        serviceName: 'Production API Key',
      });

      expect(res1.success).toBe(true);
      expect(res1.deduplicated).toBeUndefined();

      expect(res2.success).toBe(true);
      expect(res2.deduplicated).toBe(true);

      expect(mockProvider.sentEmails.length).toBe(1);
    });
  });
});
