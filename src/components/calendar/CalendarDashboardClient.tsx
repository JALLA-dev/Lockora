'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarConnectionManager } from './CalendarConnectionManager';
import { getCalendarConnections } from '@/app/actions/calendar-connections';
import { getAvailabilityRules } from '@/app/actions/availability';
import { getMeetingTypes } from '@/app/actions/meeting-types';
import { getUserBookings } from '@/app/actions/bookings';
import {
  Calendar,
  Clock,
  Video,
  ListOrdered,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export type CalendarErrorState =
  | 'AUTH_EXPIRED'
  | 'CONFIG_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'SERVER_ERROR'
  | null;

interface CalendarDashboardClientProps {
  initialConnections: any[];
  initialRules: any;
  initialMeetingTypes: any[];
  initialBookings: any[];
  initialError: CalendarErrorState;
}

export function CalendarDashboardClient({
  initialConnections,
  initialRules,
  initialMeetingTypes,
  initialBookings,
  initialError,
}: CalendarDashboardClientProps) {
  const [connections, setConnections] = useState(initialConnections);
  const [rules, setRules] = useState(initialRules);
  const [meetingTypes, setMeetingTypes] = useState(initialMeetingTypes);
  const [bookings, setBookings] = useState(initialBookings);
  const [errorState, setErrorState] = useState<CalendarErrorState>(initialError);
  const [isRetrying, setIsRetrying] = useState(false);

  const activeConnCount = (connections || []).filter((c) => c.status === 'ACTIVE').length;
  const activeBookingsCount = (bookings || []).filter((b) => b.status === 'CONFIRMED').length;

  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorState(null);

    // Timeout protection: 10 seconds max
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 10000)
    );

    try {
      const fetchDataPromise = Promise.all([
        getCalendarConnections(),
        getAvailabilityRules(),
        getMeetingTypes(),
        getUserBookings(),
      ]);

      const [resConn, resRules, resTypes, resBookings] = (await Promise.race([
        fetchDataPromise,
        timeoutPromise,
      ])) as [any[], any, any[], any[]];

      setConnections(resConn);
      setRules(resRules);
      setMeetingTypes(resTypes);
      setBookings(resBookings);
      setErrorState(null);
    } catch (err: any) {
      if (err?.message === 'AUTH_EXPIRED') {
        setErrorState('AUTH_EXPIRED');
      } else if (err?.message === 'TIMEOUT' || err?.message?.includes('network')) {
        setErrorState('PROVIDER_UNAVAILABLE');
      } else {
        setErrorState('SERVER_ERROR');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // State-specific error views
  if (errorState) {
    let title = 'Unable to load Calendar';
    let description = 'Unable to load Calendar. Please try again.';
    let icon = <AlertTriangle className="w-8 h-8 text-amber-500" />;
    let showAuthBtn = false;

    if (errorState === 'AUTH_EXPIRED') {
      title = 'Session Expired';
      description = 'Your session has expired. Please sign in again to access Lockora Calendar.';
      icon = <LogOut className="w-8 h-8 text-red-500" />;
      showAuthBtn = true;
    } else if (errorState === 'CONFIG_ERROR') {
      title = 'Configuration Problem';
      description = 'Calendar integration is not configured.';
      icon = <AlertTriangle className="w-8 h-8 text-amber-500" />;
    } else if (errorState === 'PROVIDER_UNAVAILABLE') {
      title = 'Service Unavailable';
      description = 'Calendar service is temporarily unavailable. Please try again.';
      icon = <AlertTriangle className="w-8 h-8 text-amber-500" />;
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 max-w-md mx-auto text-center space-y-4">
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-3 pt-2 w-full">
          {showAuthBtn ? (
            <a
              href="/sign-in"
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Sign In Again
            </a>
          ) : (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
        </div>
      </div>
    );
  }

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

      {/* Zero Connection State Banner if no active connections */}
      {activeConnCount === 0 && (
        <div className="p-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> No calendar connected
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Connect your calendar to start accepting bookings automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <a
              href="/api/calendar/google/connect"
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Connect Google Calendar
            </a>
            <a
              href="/api/calendar/outlook/connect"
              className="text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Connect Outlook Calendar
            </a>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Connected Calendars</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {activeConnCount === 0 ? 'None' : activeConnCount}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">Google & Outlook OAuth</p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Meeting Types</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{meetingTypes.length}</p>
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
