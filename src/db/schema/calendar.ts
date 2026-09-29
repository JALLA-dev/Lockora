import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const calendarConnections = pgTable('calendar_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(), // 'google' | 'outlook'
  providerAccountId: text('provider_account_id').notNull(),
  calendarId: text('calendar_id').notNull(),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  scopes: text('scopes').notNull(), // JSON string array
  status: text('status').default('ACTIVE').notNull(), // 'ACTIVE' | 'EXPIRED' | 'REVOKED'
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  revokedAt: timestamp('revoked_at'),
});

export const availabilityRules = pgTable('availability_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  timeZone: text('time_zone').default('UTC').notNull(),
  weeklyHours: jsonb('weekly_hours').notNull(), // { mon: [{ start: "09:00", end: "17:00" }], ... }
  bufferMinutes: integer('buffer_minutes').default(15).notNull(),
  minNoticeMinutes: integer('min_notice_minutes').default(120).notNull(),
  maxBookingDays: integer('max_booking_days').default(30).notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const meetingTypes = pgTable('meeting_types', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').default(30).notNull(),
  locationType: text('location_type').default('google_meet').notNull(), // 'google_meet' | 'teams' | 'custom'
  locationUrl: text('location_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const bookingPages = pgTable('booking_pages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  meetingTypeId: text('meeting_type_id').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  meetingTypeId: text('meeting_type_id').notNull(),
  connectionId: text('connection_id'),
  externalEventId: text('external_event_id'),
  visitorName: text('visitor_name').notNull(),
  visitorEmail: text('visitor_email').notNull(),
  visitorNotes: text('visitor_notes'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: text('status').default('CONFIRMED').notNull(), // 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'FAILED'
  meetingUrl: text('meeting_url'),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const bookingEvents = pgTable('booking_events', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  eventType: text('event_type').notNull(), // 'CREATED' | 'RESCHEDULED' | 'CANCELLED' | 'SYNC_FAILED'
  payload: text('payload'),
  createdAt: timestamp('created_at').notNull(),
});

export const calendarSyncLogs = pgTable('calendar_sync_logs', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull(),
  status: text('status').notNull(), // 'SUCCESS' | 'FAILED'
  details: text('details'),
  timestamp: timestamp('timestamp').notNull(),
});
