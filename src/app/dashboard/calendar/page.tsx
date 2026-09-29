import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { bookings, meetingTypes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Calendar, Clock, Video, Globe, Ban, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Calendar Bookings - Lockora',
};

export default async function CalendarBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const { tab } = await searchParams;
  const currentTab = tab || 'upcoming';

  const userBookings = await db
    .select({
      booking: bookings,
      meetingType: meetingTypes,
    })
    .from(bookings)
    .innerJoin(meetingTypes, eq(bookings.meetingTypeId, meetingTypes.id))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.startTime));

  const now = new Date();

  const upcoming = userBookings.filter(
    (b) => b.booking.status === 'CONFIRMED' && b.booking.endTime > now
  ).sort((a, b) => a.booking.startTime.getTime() - b.booking.startTime.getTime());

  const past = userBookings.filter(
    (b) => b.booking.status === 'CONFIRMED' && b.booking.endTime <= now
  );

  const cancelled = userBookings.filter((b) => b.booking.status === 'CANCELLED');

  const displayedBookings =
    currentTab === 'upcoming' ? upcoming : currentTab === 'past' ? past : cancelled;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Calendar Bookings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          View and manage your upcoming, past, and cancelled meetings.
        </p>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'past', label: 'Past', count: past.length },
            { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
          ].map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/calendar?tab=${t.id}`}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                ${
                  currentTab === t.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }
              `}
            >
              {t.label}
              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-0.5 px-2.5 rounded-full text-xs">
                {t.count}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="space-y-4">
        {displayedBookings.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
            <Calendar className="mx-auto h-12 w-12 text-zinc-400 mb-3" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-white">No {currentTab} bookings</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              You don't have any {currentTab} meetings scheduled at the moment.
            </p>
          </div>
        ) : (
          displayedBookings.map((b) => (
            <div
              key={b.booking.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 shrink-0 bg-indigo-500"
                  />
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                      {b.meetingType.title}
                    </h3>
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mt-0.5">
                      with {b.booking.visitorName} ({b.booking.visitorEmail})
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium pl-6">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(b.booking.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(b.booking.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} - {new Date(b.booking.endTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  {b.booking.meetingUrl ? (
                    <a
                      href={b.booking.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join Meeting
                    </a>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      {b.meetingType.locationType === 'in_person' ? 'In Person' : 'Phone'}
                    </span>
                  )}
                </div>
              </div>

              {currentTab === 'upcoming' && (
                <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                  <Link
                    href={`/booking/reschedule/${b.booking.secureToken}`}
                    target="_blank"
                    className="flex-1 sm:flex-none justify-center px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold rounded-lg transition-colors border border-transparent dark:border-zinc-700 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reschedule
                  </Link>
                  <Link
                    href={`/booking/cancel/${b.booking.secureToken}`}
                    target="_blank"
                    className="flex-1 sm:flex-none justify-center px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors border border-red-200 dark:border-red-500/20 flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" /> Cancel
                  </Link>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
