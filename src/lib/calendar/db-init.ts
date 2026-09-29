import { db } from '@/db';
import { sql } from 'drizzle-orm';

let isInitialized = false;

/**
 * Ensures all Lockora Calendar database tables exist on PostgreSQL.
 * Safe & idempotent DDL: uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ... IF NOT EXISTS.
 * Never drops, alters, or resets existing user/secret tables.
 *
 * Calendar provider is ALWAYS 'microsoft' — Google Calendar is not supported.
 */
export async function ensureCalendarTablesExist() {
  if (isInitialized) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "oauth_states" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "provider" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "calendar_connections" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "provider" text NOT NULL,
        "provider_account_id" text NOT NULL,
        "calendar_id" text NOT NULL DEFAULT 'primary',
        "calendar_email" text,
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
        "location_type" text DEFAULT 'teams' NOT NULL,
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
    `);

    // Idempotent column additions for existing deployments
    // Add calendar_email if not yet present
    await db.execute(sql`
      ALTER TABLE "calendar_connections"
        ADD COLUMN IF NOT EXISTS "calendar_email" text;
    `).catch(() => { /* column may already exist */ });

    // Clean up expired OAuth states
    await db.execute(sql`
      DELETE FROM "oauth_states" WHERE "expires_at" < NOW();
    `).catch(() => { /* table may not exist yet */ });

    isInitialized = true;
  } catch (err: any) {
    console.warn('[Calendar DB Init] Non-fatal table init notice:', err?.message);
    // Still mark as initialized if tables likely already exist
    if (err?.message?.includes('already exists') || err?.code === '42P07') {
      isInitialized = true;
    }
  }
}
