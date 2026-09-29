import { GoogleCalendarProvider } from '../src/lib/calendar/providers/GoogleCalendarProvider';
import { OutlookCalendarProvider } from '../src/lib/calendar/providers/OutlookCalendarProvider';

describe('Calendar Provider Abstractions', () => {
  it('GoogleCalendarProvider generates proper auth URL with state', () => {
    const provider = new GoogleCalendarProvider();
    const url = provider.getAuthUrl('mock-state-123', 'http://localhost:3000/api/calendar/google/callback');

    expect(url).toContain('accounts.google.com');
    expect(url).toContain('state=mock-state-123');
    expect(url).toContain('response_type=code');
  });

  it('OutlookCalendarProvider generates proper auth URL with state', () => {
    const provider = new OutlookCalendarProvider();
    const url = provider.getAuthUrl('mock-state-456', 'http://localhost:3000/api/calendar/outlook/callback');

    expect(url).toContain('login.microsoftonline.com');
    expect(url).toContain('state=mock-state-456');
    expect(url).toContain('response_type=code');
  });

  it('GoogleCalendarProvider mock exchange code works cleanly', async () => {
    const provider = new GoogleCalendarProvider();
    const tokens = await provider.exchangeCode('mock-code-789', 'http://localhost/callback');

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.providerAccountId).toBeDefined();
  });

  it('OutlookCalendarProvider mock exchange code works cleanly', async () => {
    const provider = new OutlookCalendarProvider();
    const tokens = await provider.exchangeCode('mock-code-012', 'http://localhost/callback');

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.providerAccountId).toBeDefined();
  });
});
