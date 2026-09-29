import { NextResponse } from 'next/server';
import { db } from '@/db';
import { meetingTypes, availabilityRules, bookings } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { AvailabilityService } from '@/lib/calendar/AvailabilityService';
import { calendarService } from '@/lib/calendar/CalendarService';
import { TimeZoneService } from '@/lib/calendar/TimeZoneService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date'); // "YYYY-MM-DD"
    const visitorTimeZone = url.searchParams.get('tz') || 'UTC';

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: 'Valid date parameter in YYYY-MM-DD format is required.' },
        { status: 400 }
      );
    }

    // 1. Fetch meeting type
    const mtResults = await db
      .select()
      .from(meetingTypes)
      .where(and(eq(meetingTypes.slug, slug), eq(meetingTypes.isActive, true)));

    const meetingType = mtResults[0];
    if (!meetingType) {
      return NextResponse.json({ error: 'Booking page not found or inactive.' }, { status: 404 });
    }

    const userId = meetingType.userId;

    // 2. Fetch Availability Rules
    const availResults = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.userId, userId));

    const userRules = availResults[0]
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
            sat: [],
            sun: [],
          },
          bufferMinutes: 15,
          minNoticeMinutes: 120,
          maxBookingDays: 30,
        };

    // 3. Compute target day UTC boundaries
    const dayStartUtc = TimeZoneService.getUtcDateFromZoneTime(dateStr, '00:00', userRules.timeZone);
    const dayEndUtc = TimeZoneService.getUtcDateFromZoneTime(dateStr, '23:59', userRules.timeZone);

    // 4. Fetch External Busy Slots from Microsoft Outlook via Graph
    const externalBusySlots = await calendarService.fetchFreeBusy(userId, dayStartUtc, dayEndUtc);

    // 5. Fetch Existing Lockora Bookings for day
    const existingBookings = await db
      .select({
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.status, 'CONFIRMED'),
          gte(bookings.endTime, dayStartUtc),
          lte(bookings.startTime, dayEndUtc)
        )
      );

    // 6. Generate Available Slots
    const slots = AvailabilityService.generateAvailableSlots({
      dateStr,
      targetTimeZone: visitorTimeZone,
      meetingDurationMinutes: meetingType.durationMinutes,
      availabilitySettings: userRules,
      externalBusySlots,
      existingBookings,
    });

    return NextResponse.json({
      meetingTitle: meetingType.title,
      durationMinutes: meetingType.durationMinutes,
      description: meetingType.description,
      timeZone: visitorTimeZone,
      slots,
    });
  } catch (err: any) {
    console.error('Error fetching public availability slots:', err?.message);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch availability.' },
      { status: 500 }
    );
  }
}
