import { CalendarProvider } from './CalendarProvider';
import {
  CalendarEventData,
  CalendarEventResult,
  CalendarInfo,
  FreeBusySlot,
  TokenExchangeResult,
  TokenRefreshResult,
} from '../types';

export class OutlookCalendarProvider implements CalendarProvider {
  readonly providerName = 'outlook' as const;

  private getClientId(): string | null {
    return (
      process.env.MICROSOFT_CLIENT_ID ||
      process.env.AZURE_OUTLOOK_CLIENT_ID ||
      null
    );
  }

  private getClientSecret(): string | null {
    return (
      process.env.MICROSOFT_CLIENT_SECRET ||
      process.env.AZURE_OUTLOOK_CLIENT_SECRET ||
      null
    );
  }

  private getTenantId(): string {
    return process.env.MICROSOFT_TENANT_ID || process.env.AZURE_TENANT_ID || 'common';
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

    const tenantId = this.getTenantId();
    const callbackUri =
      redirectUri ||
      process.env.MICROSOFT_REDIRECT_URI ||
      'http://localhost:3000/api/calendar/outlook/callback';

    const scopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: callbackUri,
      scope: scopes,
      response_mode: 'query',
      state,
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<TokenExchangeResult> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('CONFIG_ERROR');
    }

    const tenantId = this.getTenantId();
    const callbackUri =
      redirectUri ||
      process.env.MICROSOFT_REDIRECT_URI ||
      'http://localhost:3000/api/calendar/outlook/callback';

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUri,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Microsoft Graph Token Exchange Failed]:', errText);
      throw new Error('PROVIDER_UNAVAILABLE');
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    let providerAccountId = 'me';
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
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('CONFIG_ERROR');
    }

    const tenantId = this.getTenantId();

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
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
      console.error('[Microsoft Graph Token Refresh Failed]:', errText);
      throw new Error('PROVIDER_UNAVAILABLE');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      refreshToken: data.refresh_token || refreshToken,
    };
  }

  async getCalendars(accessToken: string): Promise<CalendarInfo[]> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error('[Microsoft Graph getCalendars Failed]:', await response.text());
      return [{ id: 'primary', name: 'Primary Calendar', isPrimary: true, canEdit: true }];
    }

    const data = await response.json();
    const calendarsList = data.value || [];

    if (calendarsList.length === 0) {
      return [{ id: 'primary', name: 'Primary Calendar', isPrimary: true, canEdit: true }];
    }

    return calendarsList.map((cal: any) => ({
      id: cal.id,
      name: cal.name || 'Outlook Calendar',
      isPrimary: Boolean(cal.isDefaultCalendar),
      canEdit: Boolean(cal.canEdit),
    }));
  }

  async getFreeBusy(
    accessToken: string,
    calendarId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FreeBusySlot[]> {
    const targetSchedule = calendarId && calendarId !== 'primary' ? calendarId : 'me';

    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schedules: [targetSchedule],
        startTime: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
        endTime: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
        availabilityViewInterval: 15,
      }),
    });

    if (!response.ok) {
      console.error('[Microsoft Graph getSchedule Failed]:', await response.text());
      return [];
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
      console.error('[Microsoft Graph createEvent Failed]:', errText);
      throw new Error('PROVIDER_UNAVAILABLE');
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
