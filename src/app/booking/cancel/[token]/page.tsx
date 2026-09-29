import { BookingService } from '@/lib/calendar/BookingService';
import { notFound } from 'next/navigation';
import { CancelBookingClient } from './CancelBookingClient';
import Image from 'next/image';

export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  
  const bookingData = await BookingService.getBookingByToken(token);
  if (!bookingData) {
    notFound();
  }

  const { booking, meetingType, user } = bookingData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white p-4 md:p-10 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <Image src="/lockora-icon.svg" alt="Lockora" width={32} height={32} className="rounded-lg" />
          <span className="font-bold text-lg tracking-tight">Lockora Calendar</span>
        </div>
      </header>

      <main className="my-auto py-8 relative z-10">
        <CancelBookingClient 
          token={token}
          meetingTitle={meetingType.title}
          startTime={booking.startTime.toISOString()}
          hostName={user.username!}
          status={booking.status}
        />
      </main>

      <footer className="text-center text-xs text-zinc-500 py-4 relative z-10">
        Powered by Lockora Secure Infrastructure
      </footer>
    </div>
  );
}
