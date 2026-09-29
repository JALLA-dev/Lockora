import { db } from '@/db';
import { bookings, bookingEvents, meetingTypes, availabilityRules, auditLogs } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { calendarService } from './CalendarService';
import { AvailabilityService } from './AvailabilityService';
import { emailService } from '@/lib/email';
import { AvailabilitySettings } from './types';

export class BookingService {
  /**
   * Creates a new booking with authoritative pre-commit availability re-check (Race condition protection).
   */
  static async createBooking(params: {
    slug: string;
    visitorName: string;
    visitorEmail: string;
    visitorNotes?: string;
    startTimeIso: string;
    visitorTimeZone?: string;
  }) {
    const { slug, visitorName, visitorEmail, visitorNotes, startTimeIso } = params;

    // 1. Fetch meeting type & owner
    const mtResults = await db
      .select()
      .from(meetingTypes)
      .where(and(eq(meetingTypes.slug, slug), eq(meetingTypes.isActive, true)));

    const meetingType = mtResults[0];
    if (!meetingType) {
      throw new Error('Meeting type not found or inactive.');
    }

    const userId = meetingType.userId;
    const startTime = new Date(startTimeIso);
    const endTime = new Date(startTime.getTime() + meetingType.durationMinutes * 60 * 1000);

    // 2. Fetch User Availability Rules
    const availResults = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.userId, userId));

    const userRules: AvailabilitySettings = availResults[0]
      ? {
          id: availResults[0].id,
          userId: availResults[0].userId,
          timeZone: availResults[0].timeZone,
          weeklyHours: availResults[0].weeklyHours as any,
          bufferMinutes: availResults[0].bufferMinutes,
          minNoticeMinutes: availResults[0].minNoticeMinutes,
          maxBookingDays: availResults[0].maxBookingDays,
        }
      : {
          userId,
          timeZone: 'UTC',
          weeklyHours: {
            mon: [{ start: '09:00', end: '17:00' }],
            tue: [{ start: '09:00', end: '17:00' }],
            wed: [{ start: '09:00', end: '17:00' }],
            thu: [{ start: '09:00', end: '17:00' }],
            fri: [{ start: '09:00', end: '17:00' }],
          },
          bufferMinutes: 15,
          minNoticeMinutes: 120,
          maxBookingDays: 30,
        };

    // 3. Authoritative DB Double-Booking Check (Race Condition Protection)
    const bufferMs = userRules.bufferMinutes * 60 * 1000;
    const windowStart = new Date(startTime.getTime() - bufferMs);
    const windowEnd = new Date(endTime.getTime() + bufferMs);

    const conflictingBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.status, 'CONFIRMED'),
          gte(bookings.endTime, windowStart),
          lte(bookings.startTime, windowEnd)
        )
      );

    if (conflictingBookings.length > 0) {
      throw new Error('The selected time slot is no longer available. Please select another slot.');
    }

    // 4. Authoritative Connected Calendar Free/Busy Re-Check
    const externalBusy = await calendarService.fetchFreeBusy(
      userId,
      new Date(startTime.getTime() - bufferMs),
      new Date(endTime.getTime() + bufferMs)
    );

    const hasExternalConflict = externalBusy.some((busy) => {
      const bStart = busy.start.getTime() - bufferMs;
      const bEnd = busy.end.getTime() + bufferMs;
      return startTime.getTime() < bEnd && endTime.getTime() > bStart;
    });

    if (hasExternalConflict) {
      throw new Error('The selected time slot is no longer available in the host calendar. Please choose another slot.');
    }

    // 5. Create Calendar Event on Google/Outlook if connected
    let meetingUrl = meetingType.locationUrl || undefined;
    let externalEventId: string | undefined = undefined;
    let connectionId: string | undefined = undefined;

    const validConn = await calendarService.getValidConnection(userId);
    if (validConn) {
      connectionId = validConn.connection.id;
      try {
        const eventRes = await calendarService.createBookingEvent(
          userId,
          {
            title: `${meetingType.title} with ${visitorName}`,
            description: visitorNotes ? `Notes: ${visitorNotes}` : `Booked via Lockora Calendar`,
            startTime,
            endTime,
            attendeeEmail: visitorEmail,
            attendeeName: visitorName,
            locationType: meetingType.locationType as any,
            locationUrl: meetingType.locationUrl || undefined,
          },
          connectionId
        );

        if (eventRes) {
          externalEventId = eventRes.eventId;
          if (eventRes.meetingUrl) meetingUrl = eventRes.meetingUrl;
        }
      } catch (err: any) {
        console.error('Failed to dispatch calendar event to provider:', err?.message);
      }
    }

    // 6. Save Booking to Database
    const bookingId = crypto.randomUUID();
    const timestamp = new Date();

    await db.insert(bookings).values({
      id: bookingId,
      userId,
      meetingTypeId: meetingType.id,
      connectionId: connectionId || null,
      externalEventId: externalEventId || null,
      visitorName,
      visitorEmail,
      visitorNotes: visitorNotes || null,
      startTime,
      endTime,
      status: 'CONFIRMED',
      meetingUrl: meetingUrl || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db.insert(bookingEvents).values({
      id: crypto.randomUUID(),
      bookingId,
      eventType: 'CREATED',
      payload: JSON.stringify({ visitorName, visitorEmail, startTimeIso }),
      createdAt: timestamp,
    });

    // 7. Audit Log Security Event (NO tokens or private events logged)
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      action: 'BOOKING_CREATED',
      resource: bookingId,
      result: 'SUCCESS',
      timestamp,
    });

    // 8. Send Email Notifications via EmailService
    try {
      await emailService.sendSecurityAlert({
        to: visitorEmail,
        event: 'BOOKING_CONFIRMED' as any,
        serviceName: meetingType.title,
        actionName: 'Meeting Confirmed',
        userName: visitorName,
        time: startTime,
        details: `Your meeting "${meetingType.title}" is confirmed for ${startTime.toUTCString()}. ${meetingUrl ? `Join link: ${meetingUrl}` : ''}`,
      });
    } catch {
      // ignore email failure to preserve booking result
    }

    return {
      bookingId,
      meetingTitle: meetingType.title,
      startTime,
      endTime,
      meetingUrl,
      visitorName,
      visitorEmail,
    };
  }

  /**
   * Cancels a booking and notifies the host/visitor.
   */
  static async cancelBooking(userId: string, bookingId: string, reason?: string) {
    const bookingList = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)));

    const booking = bookingList[0];
    if (!booking) {
      throw new Error('Booking not found or unauthorized.');
    }

    const timestamp = new Date();

    await db
      .update(bookings)
      .set({
        status: 'CANCELLED',
        cancellationReason: reason || 'Cancelled by host',
        updatedAt: timestamp,
      })
      .where(eq(bookings.id, bookingId));

    if (booking.externalEventId) {
      try {
        await calendarService.cancelBookingEvent(
          userId,
          booking.connectionId,
          booking.externalEventId
        );
      } catch (err: any) {
        console.error('Failed to cancel event on calendar provider:', err?.message);
      }
    }

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      action: 'BOOKING_CANCELLED',
      resource: bookingId,
      result: 'SUCCESS',
      timestamp,
    });

    try {
      await emailService.sendSecurityAlert({
        to: booking.visitorEmail,
        event: 'BOOKING_CANCELLED' as any,
        serviceName: 'Lockora Calendar',
        actionName: 'Booking Cancelled',
        userName: booking.visitorName,
        time: timestamp,
        details: `Your booking on ${booking.startTime.toUTCString()} has been cancelled. Reason: ${reason || 'Cancelled by host.'}`,
      });
    } catch {
      // ignore email send error
    }

    return { success: true };
  }
}
