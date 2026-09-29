'use server';

import { db } from '@/db';
import { users, meetingTypes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export async function getPublicProfile(username: string) {
  try {
    await ensureCalendarTablesExist();

    // Find the user by username
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.username, username));

    if (!user) return null;

    // Find all active, non-secret meeting types for this user
    const publicEvents = await db
      .select()
      .from(meetingTypes)
      .where(
        and(
          eq(meetingTypes.userId, user.id),
          eq(meetingTypes.isActive, true),
          eq(meetingTypes.isSecret, false)
        )
      );

    return {
      user,
      eventTypes: publicEvents,
    };
  } catch (err: any) {
    console.error('[getPublicProfile Error]:', err?.message);
    return null;
  }
}

export async function getPublicEventType(username: string, slug: string) {
  try {
    await ensureCalendarTablesExist();

    // Find the user
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.username, username));

    if (!user) return null;

    // Find the specific active meeting type (secret ones can still be accessed directly by slug)
    const [eventType] = await db
      .select()
      .from(meetingTypes)
      .where(
        and(
          eq(meetingTypes.userId, user.id),
          eq(meetingTypes.slug, slug),
          eq(meetingTypes.isActive, true)
        )
      );

    if (!eventType) return null;

    return {
      user,
      eventType,
    };
  } catch (err: any) {
    console.error('[getPublicEventType Error]:', err?.message);
    return null;
  }
}

import { BookingService } from '@/lib/calendar/BookingService';

export async function cancelPublicBooking(token: string, reason: string) {
  try {
    await BookingService.cancelBookingByToken(token, reason);
    return { success: true };
  } catch (err: any) {
    console.error('[cancelPublicBooking Error]:', err?.message);
    return { error: err?.message || 'Failed to cancel booking' };
  }
}

export async function reschedulePublicBooking(token: string, newStartTimeIso: string) {
  try {
    await BookingService.rescheduleBookingByToken(token, newStartTimeIso);
    return { success: true };
  } catch (err: any) {
    console.error('[reschedulePublicBooking Error]:', err?.message);
    return { error: err?.message || 'Failed to reschedule booking' };
  }
}
