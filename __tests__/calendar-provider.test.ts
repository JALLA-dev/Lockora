import { OutlookCalendarProvider } from '../src/lib/calendar/providers/OutlookCalendarProvider';

describe('Outlook Calendar Provider Abstraction', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      MICROSOFT_CLIENT_ID: 'test-client-id-123',
      MICROSOFT_CLIENT_SECRET: 'test-client-secret-456',
      MICROSOFT_TENANT_ID: 'common',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('OutlookCalendarProvider generates proper Microsoft Graph OAuth URL with state', () => {
    const provider = new OutlookCalendarProvider();
    expect(provider.isConfigured()).toBe(true);

    const url = provider.getAuthUrl('mock-state-456', 'http://localhost:3000/api/calendar/outlook/callback');

    expect(url).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(url).toContain('client_id=test-client-id-123');
    expect(url).toContain('state=mock-state-456');
    expect(url).toContain('response_type=code');
    expect(url).toContain('Calendars.ReadWrite');
  });

  it('OutlookCalendarProvider reports not configured when client_id is missing', () => {
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.AZURE_OUTLOOK_CLIENT_ID;

    const provider = new OutlookCalendarProvider();
    expect(provider.isConfigured()).toBe(false);
    expect(() => provider.getAuthUrl('state')).toThrow('CONFIG_ERROR');
  });
});
