import {
  CalendarEventData,
  CalendarEventResult,
  CalendarInfo,
  FreeBusySlot,
  TokenExchangeResult,
  TokenRefreshResult,
} from '../types';

export interface CalendarProvider {
  readonly providerName: 'outlook' | 'google';

  isConfigured(): boolean;

  getAuthUrl(state: string, redirectUri?: string): string;

  exchangeCode(code: string, redirectUri?: string): Promise<TokenExchangeResult>;

  refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult>;

  getCalendars(accessToken: string): Promise<CalendarInfo[]>;

  getFreeBusy(
    accessToken: string,
    calendarId: string,
    startTime: Date,
    endTime: Date
  ): Promise<FreeBusySlot[]>;

  createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEventData
  ): Promise<CalendarEventResult>;

  cancelEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<boolean>;

  rescheduleEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    newStart: Date,
    newEnd: Date
  ): Promise<boolean>;
}
