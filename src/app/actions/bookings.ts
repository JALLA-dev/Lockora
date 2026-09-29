'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, meetingTypes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { BookingService } from '@/lib/calendar/BookingService';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export async function getUserBookings() {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  try {
    await ensureCalendarTablesExist();

    const userBookings = await db
      .select({
        id: bookings.id,
        visitorName: bookings.visitorName,
        visitorEmail: bookings.visitorEmail,
        visitorNotes: bookings.visitorNotes,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        meetingUrl: bookings.meetingUrl,
        cancellationReason: bookings.cancellationReason,
        createdAt: bookings.createdAt,
        meetingTitle: meetingTypes.title,
      })
      .from(bookings)
      .leftJoin(meetingTypes, eq(bookings.meetingTypeId, meetingTypes.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.startTime));

    return userBookings || [];
  } catch (err: any) {
    console.error('[getUserBookings Error]:', err?.message);
    return [];
  }
}

export async function cancelUserBooking(bookingId: string, reason?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  return BookingService.cancelBooking(userId, bookingId, reason);
}
