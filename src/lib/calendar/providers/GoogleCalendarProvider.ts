import { CalendarProvider } from './CalendarProvider';
import {
  CalendarEventData,
  CalendarEventResult,
  CalendarInfo,
  FreeBusySlot,
  TokenExchangeResult,
  TokenRefreshResult,
} from '../types';

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerName = 'google' as const;

  private getClientId(): string | null {
    return process.env.GOOGLE_CLIENT_ID || null;
  }

  private getClientSecret(): string | null {
    return process.env.GOOGLE_CLIENT_SECRET || null;
  }

  isConfigured(): boolean {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    return Boolean(clientId && clientSecret);
  }

  getAuthUrl(state: string, redirectUri?: string): string {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('CONFIG_ERROR');
    }

    const callbackUri =
      redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3000/api/calendar/google/callback';

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline', // Required to get a refresh token
      prompt: 'consent', // Required to always get a refresh token on reconnect
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<TokenExchangeResult> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('CONFIG_ERROR');
    }

    const callbackUri =
      redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3000/api/calendar/google/callback';

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Google Token Exchange Failed]:', errText);
      throw new Error('PROVIDER_UNAVAILABLE');
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    // Fetch user email
    let providerAccountId = 'unknown@google.com';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        if (userInfo.email) {
          providerAccountId = userInfo.email;
        }
      }
    } catch {
      // ignore
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '', // Sometimes missing if prompt!=consent
      expiresAt,
      providerAccountId,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('CONFIG_ERROR');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Google Token Refresh Failed]:', errText);
      throw new Error('PROVIDER_UNAVAILABLE');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      refreshToken: data.refresh_token || refreshToken, // Google rarely sends a new refresh token here
    };
  }

  async getCalendars(accessToken: string): Promise<CalendarInfo[]> {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error('[Google getCalendars Failed]:', await response.text());
      return [{ id: 'primary', name: 'Primary Calendar', isPrimary: true, canEdit: true }];
    }

    const data = await response.json();
    const items = data.items || [];

    if (items.length === 0) {
      return [{ id: 'primary', name: 'Primary Calendar', isPrimary: true, canEdit: true }];
    }

    return items.map((cal: any) => ({
      id: cal.id,
      name: cal.summary || 'Google Calendar',
      isPrimary: Boolean(cal.primary),
      canEdit: cal.accessRole === 'writer' || cal.accessRole === 'owner',
    }));
  }

  async getFreeBusy(
    accessToken: string,
    calendarId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FreeBusySlot[]> {
    const targetCalendar = calendarId || 'primary';

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        items: [{ id: targetCalendar }],
      }),
    });

    if (!response.ok) {
      console.error('[Google getFreeBusy Failed]:', await response.text());
      return [];
    }

    const data = await response.json();
    const busySlots = data.calendars?.[targetCalendar]?.busy || [];

    return busySlots.map((item: any) => ({
      start: new Date(item.start),
      end: new Date(item.end),
    }));
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEventData
  ): Promise<CalendarEventResult> {
    const targetCalendar = calendarId || 'primary';

    const body: any = {
      summary: event.title,
      description: event.description || 'Booked via Lockora Calendar',
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
      attendees: [
        {
          email: event.attendeeEmail,
          displayName: event.attendeeName,
        },
      ],
    };

    // Google Meet support
    if (event.locationUrl === 'meet') {
      body.conferenceData = {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    } else if (event.locationUrl && event.locationUrl !== 'teams') {
      body.location = event.locationUrl;
    }

    const queryParams = event.locationUrl === 'meet' ? '?conferenceDataVersion=1' : '';

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events${queryParams}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Google createEvent Failed]:', errText);
      throw new Error('PROVIDER_UNAVAILABLE');
    }

    const data = await response.json();
    
    // Extract Meet link if available
    const meetingUrl = data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri 
                       || data.hangoutLink
                       || (event.locationUrl !== 'meet' && event.locationUrl !== 'teams' ? event.locationUrl : undefined);

    return {
      eventId: data.id,
      meetingUrl,
      htmlLink: data.htmlLink,
    };
  }

  async cancelEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<boolean> {
    const targetCalendar = calendarId || 'primary';
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.ok;
  }

  async rescheduleEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    newStart: Date,
    newEnd: Date
  ): Promise<boolean> {
    const targetCalendar = calendarId || 'primary';
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: { dateTime: newStart.toISOString() },
        end: { dateTime: newEnd.toISOString() },
      }),
    });

    return response.ok;
  }
}
