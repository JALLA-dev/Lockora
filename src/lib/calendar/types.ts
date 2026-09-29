export type CalendarProviderType = 'outlook';

export interface CalendarInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  canEdit: boolean;
}

export interface CalendarEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail: string;
  attendeeName: string;
  locationType?: 'teams' | 'custom';
  locationUrl?: string;
}

export interface CalendarEventResult {
  eventId: string;
  meetingUrl?: string;
  htmlLink?: string;
}

export interface FreeBusySlot {
  start: Date;
  end: Date;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  providerAccountId: string;
  scopes: string[];
}

export interface TokenRefreshResult {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}

export interface WeeklyWorkingHours {
  [day: string]: Array<{ start: string; end: string }>;
}

export interface AvailabilitySettings {
  id?: string;
  userId: string;
  timeZone: string;
  weeklyHours: WeeklyWorkingHours;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxBookingDays: number;
}

export interface AvailableSlot {
  start: string; // ISO string in UTC or target timezone
  end: string;   // ISO string in UTC or target timezone
  displayTime: string; // e.g. "10:00 AM"
  timeZone: string;
}
