import Link from 'next/link';
import { getCalendarConnections } from '@/app/actions/calendar-connections';
import { getAvailabilityRules } from '@/app/actions/availability';
import { getMeetingTypes } from '@/app/actions/meeting-types';
import { getUserBookings } from '@/app/actions/bookings';
import { CalendarConnectionManager } from '@/components/calendar/CalendarConnectionManager';
import { Calendar, Clock, Video, ListOrdered } from 'lucide-react';

export default async function CalendarDashboardPage() {
  const [connections, rules, meetingTypesList, bookingsList] = await Promise.all([
    getCalendarConnections(),
    getAvailabilityRules(),
    getMeetingTypes(),
    getUserBookings(),
  ]);

  const activeConnCount = connections.filter((c) => c.status === 'ACTIVE').length;
  const activeBookingsCount = bookingsList.filter((b) => b.status === 'CONFIRMED').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-indigo-500" /> Lockora Calendar
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Secure scheduling & calendar sync powered by Lockora architecture.
          </p>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/calendar/availability"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Working Hours
          </Link>
          <Link
            href="/dashboard/calendar/meeting-types"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <Video className="w-3.5 h-3.5 text-indigo-500" /> Meeting Types
          </Link>
          <Link
            href="/dashboard/calendar/bookings"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5 text-indigo-500" /> Bookings ({activeBookingsCount})
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Connected Calendars</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{activeConnCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Google & Outlook OAuth</p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Meeting Types</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{meetingTypesList.length}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Active Public Booking Pages</p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Scheduled Bookings</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{activeBookingsCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Confirmed Visitor Meetings</p>
        </div>
      </div>

      {/* Connection Manager */}
      <CalendarConnectionManager connections={connections} />
    </div>
  );
}
