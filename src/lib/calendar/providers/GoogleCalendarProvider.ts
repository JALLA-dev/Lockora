import { CalendarProvider } from './CalendarProvider';
import {
  CalendarEventData,
  CalendarEventResult,
  FreeBusySlot,
  TokenExchangeResult,
  TokenRefreshResult,
} from '../types';

export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerName = 'google' as const;

  private getClientId(): string {
    return process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'mock-google-client-id';
  }

  private getClientSecret(): string {
    return process.env.GOOGLE_CALENDAR_CLIENT_SECRET || 'mock-google-client-secret';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = this.getClientId();
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
    if (code.startsWith('mock-')) {
      return {
        accessToken: `mock-google-access-token-${Date.now()}`,
        refreshToken: `mock-google-refresh-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        providerAccountId: 'mock-google-user@example.com',
        scopes: ['https://www.googleapis.com/auth/calendar'],
      };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google OAuth token exchange failed: ${errText}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    // Fetch user email as providerAccountId
    let providerAccountId = 'primary';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        if (userInfo.email) providerAccountId = userInfo.email;
      }
    } catch {
      // fallback to primary
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt,
      providerAccountId,
      scopes: data.scope ? data.scope.split(' ') : [],
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
    if (refreshToken.startsWith('mock-')) {
      return {
        accessToken: `mock-google-access-token-refreshed-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google OAuth token refresh failed: ${errText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      refreshToken: data.refresh_token || refreshToken,
    };
  }

  async getFreeBusy(
    accessToken: string,
    calendarId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FreeBusySlot[]> {
    if (accessToken.startsWith('mock-')) {
      return [];
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        items: [{ id: calendarId || 'primary' }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google FreeBusy query failed: ${errText}`);
    }

    const data = await response.json();
    const calendarData = data.calendars?.[calendarId || 'primary'];
    const busyList = calendarData?.busy || [];

    return busyList.map((slot: { start: string; end: string }) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }));
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEventData
  ): Promise<CalendarEventResult> {
    if (accessToken.startsWith('mock-')) {
      const mockEventId = `mock-event-${Date.now()}`;
      return {
        eventId: mockEventId,
        meetingUrl: 'https://meet.google.com/mock-lockora-meet',
        htmlLink: `https://calendar.google.com/event?id=${mockEventId}`,
      };
    }

    const body: any = {
      summary: event.title,
      description: event.description || 'Booked via Lockora Calendar',
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
      attendees: [
        { email: event.attendeeEmail, displayName: event.attendeeName },
      ],
    };

    if (event.locationType === 'google_meet' || !event.locationType) {
      body.conferenceData = {
        createRequest: {
          requestId: `lockora-meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const calId = encodeURIComponent(calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?conferenceDataVersion=1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Calendar create event failed: ${errText}`);
    }

    const data = await response.json();
    const meetingUrl =
      data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
      data.hangoutLink ||
      event.locationUrl;

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
    if (accessToken.startsWith('mock-')) {
      return true;
    }

    const calId = encodeURIComponent(calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return response.ok;
  }

  async rescheduleEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    newStart: Date,
    newEnd: Date
  ): Promise<boolean> {
    if (accessToken.startsWith('mock-')) {
      return true;
    }

    const calId = encodeURIComponent(calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        }),
      }
    );

    return response.ok;
  }
}
