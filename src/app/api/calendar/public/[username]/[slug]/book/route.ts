import { NextResponse } from 'next/server';
import { BookingService } from '@/lib/calendar/BookingService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> }
) {
  try {
    const { username, slug } = await params;
    const body = await request.json();

    const { visitorName, visitorEmail, visitorNotes, startTimeIso, visitorTimeZone } = body;

    if (!visitorName || !visitorEmail || !startTimeIso) {
      return NextResponse.json(
        { error: 'Name, email, and time slot selection are required.' },
        { status: 400 }
      );
    }

    const bookingResult = await BookingService.createBooking({
      username,
      slug,
      visitorName,
      visitorEmail,
      visitorNotes,
      startTimeIso,
      visitorTimeZone,
    });

    return NextResponse.json({ success: true, booking: bookingResult });
  } catch (err: any) {
    console.error('Error creating public booking:', err?.message);
    return NextResponse.json(
      { error: err?.message || 'Failed to create booking. Please try another slot.' },
      { status: 400 }
    );
  }
}
