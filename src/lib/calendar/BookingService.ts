import { db } from '@/db';
import { bookings, bookingEvents, meetingTypes, availabilitySchedules, auditLogs, users } from '@/db/schema';
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
    username: string;
    slug: string;
    visitorName: string;
    visitorEmail: string;
    visitorNotes?: string;
    startTimeIso: string;
    visitorTimeZone?: string;
  }) {
    const { username, slug, visitorName, visitorEmail, visitorNotes, startTimeIso } = params;

    // 1. Fetch user by username
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (!user) {
      throw new Error('User not found.');
    }
    const userId = user.id;

    // 1b. Fetch meeting type
    const mtResults = await db
      .select()
      .from(meetingTypes)
      .where(
        and(
          eq(meetingTypes.userId, userId),
          eq(meetingTypes.slug, slug),
          eq(meetingTypes.isActive, true)
        )
      );

    const meetingType = mtResults[0];
    if (!meetingType) {
      throw new Error('Meeting type not found or inactive.');
    }

    const startTime = new Date(startTimeIso);
    const endTime = new Date(startTime.getTime() + meetingType.durationMinutes * 60 * 1000);

    // 2. Fetch User Availability Schedule
    let schedule: any;
    if (meetingType.scheduleId) {
      const [found] = await db
        .select()
        .from(availabilitySchedules)
        .where(eq(availabilitySchedules.id, meetingType.scheduleId));
      schedule = found;
    } 
    
    if (!schedule) {
      // Fallback to default schedule
      const defaultSchedules = await db
        .select()
        .from(availabilitySchedules)
        .where(and(eq(availabilitySchedules.userId, userId), eq(availabilitySchedules.isDefault, true)));
      schedule = defaultSchedules[0];
    }

    const userRules: AvailabilitySettings = schedule
      ? {
          id: schedule.id,
          userId: schedule.userId,
          timeZone: schedule.timeZone,
          weeklyHours: schedule.weeklyHours as any,
          bufferMinutes: Math.max(meetingType.bufferBefore || 0, meetingType.bufferAfter || 0),
          minNoticeMinutes: meetingType.minNoticeMinutes || 120,
          maxBookingDays: meetingType.maxBookingDays || 30,
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
            sat: [],
            sun: [],
          },
          bufferMinutes: Math.max(meetingType.bufferBefore || 0, meetingType.bufferAfter || 0),
          minNoticeMinutes: meetingType.minNoticeMinutes || 120,
          maxBookingDays: meetingType.maxBookingDays || 30,
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

    // 5. Create Calendar Event on Outlook if connected (Microsoft Graph)
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
      secureToken: crypto.randomBytes(32).toString('hex'),
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

  /**
   * Gets booking details securely via token.
   */
  static async getBookingByToken(secureToken: string) {
    const [bookingData] = await db
      .select({
        booking: bookings,
        meetingType: meetingTypes,
        user: users,
      })
      .from(bookings)
      .innerJoin(meetingTypes, eq(bookings.meetingTypeId, meetingTypes.id))
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.secureToken, secureToken));

    return bookingData || null;
  }

  /**
   * Cancels a booking via the visitor's secure token.
   */
  static async cancelBookingByToken(secureToken: string, reason?: string) {
    const bookingData = await this.getBookingByToken(secureToken);
    if (!bookingData) throw new Error('Invalid or expired booking token');

    return this.cancelBooking(bookingData.booking.userId, bookingData.booking.id, reason || 'Cancelled by visitor');
  }

  /**
   * Reschedules a booking via token.
   */
  static async rescheduleBookingByToken(secureToken: string, newStartTimeIso: string) {
    const bookingData = await this.getBookingByToken(secureToken);
    if (!bookingData) throw new Error('Invalid or expired booking token');
    if (bookingData.booking.status !== 'CONFIRMED') throw new Error('Cannot reschedule a cancelled or completed booking');

    const newStart = new Date(newStartTimeIso);
    const newEnd = new Date(newStart.getTime() + bookingData.meetingType.durationMinutes * 60 * 1000);

    // 1. Double booking checks (for simplicity, we skip full AvailabilityService logic in MVP)
    const conflictingBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, bookingData.booking.userId),
          eq(bookings.status, 'CONFIRMED'),
          gte(bookings.endTime, newStart),
          lte(bookings.startTime, newEnd)
        )
      );

    // Filter out the current booking from conflicts
    const realConflicts = conflictingBookings.filter(b => b.id !== bookingData.booking.id);
    if (realConflicts.length > 0) {
      throw new Error('The selected time slot is no longer available. Please select another slot.');
    }

    // Check Outlook external calendar
    const externalBusy = await calendarService.fetchFreeBusy(
      bookingData.booking.userId,
      newStart,
      newEnd
    );

    const hasExternalConflict = externalBusy.some((busy) => {
      return newStart.getTime() < busy.end.getTime() && newEnd.getTime() > busy.start.getTime();
    });

    if (hasExternalConflict) {
      throw new Error('The selected time slot is no longer available in the host calendar.');
    }

    const timestamp = new Date();

    // Update Lockora booking
    await db
      .update(bookings)
      .set({
        startTime: newStart,
        endTime: newEnd,
        updatedAt: timestamp,
      })
      .where(eq(bookings.id, bookingData.booking.id));

    // Update External Provider
    if (bookingData.booking.externalEventId) {
      try {
        await calendarService.rescheduleBookingEvent(
          bookingData.booking.userId,
          bookingData.booking.connectionId,
          bookingData.booking.externalEventId,
          newStart,
          newEnd
        );
      } catch (err: any) {
        console.error('Failed to reschedule on calendar provider:', err?.message);
      }
    }

    // Send email alert
    try {
      await emailService.sendSecurityAlert({
        to: bookingData.booking.visitorEmail,
        event: 'BOOKING_CONFIRMED' as any,
        serviceName: bookingData.meetingType.title,
        actionName: 'Booking Rescheduled',
        userName: bookingData.booking.visitorName,
        time: timestamp,
        details: `Your booking has been successfully rescheduled to ${newStart.toUTCString()}.`,
      });
    } catch {
      // ignore
    }

    return { success: true };
  }
}
