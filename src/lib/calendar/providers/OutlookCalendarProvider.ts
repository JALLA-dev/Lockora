import { CalendarProvider } from './CalendarProvider';
import {
  CalendarEventData,
  CalendarEventResult,
  FreeBusySlot,
  TokenExchangeResult,
  TokenRefreshResult,
} from '../types';

export class OutlookCalendarProvider implements CalendarProvider {
  readonly providerName = 'outlook' as const;

  private getClientId(): string {
    return process.env.AZURE_OUTLOOK_CLIENT_ID || process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || 'mock-outlook-client-id';
  }

  private getClientSecret(): string {
    return process.env.AZURE_OUTLOOK_CLIENT_SECRET || 'mock-outlook-client-secret';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const clientId = this.getClientId();
    const scopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      response_mode: 'query',
      state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
    if (code.startsWith('mock-')) {
      return {
        accessToken: `mock-outlook-access-token-${Date.now()}`,
        refreshToken: `mock-outlook-refresh-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        providerAccountId: 'mock-outlook-user@outlook.com',
        scopes: ['Calendars.ReadWrite'],
      };
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
      throw new Error(`Microsoft Outlook OAuth token exchange failed: ${errText}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    let providerAccountId = 'primary';
    try {
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        if (me.userPrincipalName || me.mail) {
          providerAccountId = me.userPrincipalName || me.mail;
        }
      }
    } catch {
      // fallback
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
        accessToken: `mock-outlook-access-token-refreshed-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
      throw new Error(`Microsoft Outlook token refresh failed: ${errText}`);
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

    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: [calendarId || 'me'],
        startTime: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
        endTime: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
        availabilityViewInterval: 15,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Microsoft Graph getSchedule query failed: ${errText}`);
    }

    const data = await response.json();
    const scheduleInfo = data.value?.[0];
    const scheduleItems = scheduleInfo?.scheduleItems || [];

    return scheduleItems.map((item: any) => ({
      start: new Date(item.start.dateTime + 'Z'),
      end: new Date(item.end.dateTime + 'Z'),
    }));
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEventData
  ): Promise<CalendarEventResult> {
    if (accessToken.startsWith('mock-')) {
      const mockEventId = `mock-outlook-event-${Date.now()}`;
      return {
        eventId: mockEventId,
        meetingUrl: 'https://teams.microsoft.com/l/meetup-join/mock-lockora-teams',
      };
    }

    const body: any = {
      subject: event.title,
      body: {
        contentType: 'HTML',
        content: event.description || 'Booked via Lockora Calendar',
      },
      start: { dateTime: event.startTime.toISOString(), timeZone: 'UTC' },
      end: { dateTime: event.endTime.toISOString(), timeZone: 'UTC' },
      attendees: [
        {
          emailAddress: {
            address: event.attendeeEmail,
            name: event.attendeeName,
          },
          type: 'required',
        },
      ],
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    };

    const endpoint =
      calendarId && calendarId !== 'primary' && calendarId !== 'me'
        ? `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`
        : 'https://graph.microsoft.com/v1.0/me/events';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Microsoft Graph create event failed: ${errText}`);
    }

    const data = await response.json();
    const meetingUrl = data.onlineMeeting?.joinUrl || data.webLink || event.locationUrl;

    return {
      eventId: data.id,
      meetingUrl,
      htmlLink: data.webLink,
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

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
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
    if (accessToken.startsWith('mock-')) {
      return true;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: { dateTime: newStart.toISOString(), timeZone: 'UTC' },
        end: { dateTime: newEnd.toISOString(), timeZone: 'UTC' },
      }),
    });

    return response.ok;
  }
}
