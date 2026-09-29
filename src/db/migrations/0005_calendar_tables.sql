CREATE TABLE IF NOT EXISTS "calendar_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "calendar_id" text NOT NULL,
  "encrypted_access_token" text NOT NULL,
  "encrypted_refresh_token" text NOT NULL,
  "token_expires_at" timestamp NOT NULL,
  "scopes" text NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "revoked_at" timestamp
);

CREATE TABLE IF NOT EXISTS "availability_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "time_zone" text DEFAULT 'UTC' NOT NULL,
  "weekly_hours" jsonb NOT NULL,
  "buffer_minutes" integer DEFAULT 15 NOT NULL,
  "min_notice_minutes" integer DEFAULT 120 NOT NULL,
  "max_booking_days" integer DEFAULT 30 NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "meeting_types" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "description" text,
  "duration_minutes" integer DEFAULT 30 NOT NULL,
  "location_type" text DEFAULT 'google_meet' NOT NULL,
  "location_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_pages" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "meeting_type_id" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "meeting_type_id" text NOT NULL,
  "connection_id" text,
  "external_event_id" text,
  "visitor_name" text NOT NULL,
  "visitor_email" text NOT NULL,
  "visitor_notes" text,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp NOT NULL,
  "status" text DEFAULT 'CONFIRMED' NOT NULL,
  "meeting_url" text,
  "cancellation_reason" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_events" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" text,
  "created_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "calendar_sync_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "connection_id" text NOT NULL,
  "status" text NOT NULL,
  "details" text,
  "timestamp" timestamp NOT NULL
);
