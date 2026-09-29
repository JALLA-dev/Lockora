'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarConnectionManager } from './CalendarConnectionManager';
import { getCalendarConnections } from '@/app/actions/calendar-connections';
import { getAvailabilityRules } from '@/app/actions/availability';
import { getMeetingTypes } from '@/app/actions/meeting-types';
import { getUserBookings } from '@/app/actions/bookings';
import { updateUsername } from '@/app/actions/user';
import {
  Calendar,
  Clock,
  Video,
  ListOrdered,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Settings,
  Plus,
  Link as LinkIcon,
  User,
  CheckCircle2,
  Copy
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
  initialUsername?: string | null;
}

export function CalendarDashboardClient({
  initialConnections,
  initialRules,
  initialMeetingTypes,
  initialBookings,
  initialError,
  initialUsername,
}: CalendarDashboardClientProps) {
  const [connections, setConnections] = useState(initialConnections);
  const [rules, setRules] = useState(initialRules);
  const [meetingTypes, setMeetingTypes] = useState(initialMeetingTypes);
  const [bookings, setBookings] = useState(initialBookings);
  const [errorState, setErrorState] = useState<CalendarErrorState>(initialError);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [username, setUsername] = useState(initialUsername || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const activeConnCount = (connections || []).filter((c) => c.status === 'ACTIVE').length;
  const activeBookingsCount = (bookings || []).filter((b) => b.status === 'CONFIRMED').length;
  const hasUsername = !!initialUsername;

  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorState(null);

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
      } else if (err?.message === 'CONFIG_ERROR') {
        setErrorState('CONFIG_ERROR');
      } else if (err?.message === 'TIMEOUT' || err?.message?.includes('network')) {
        setErrorState('PROVIDER_UNAVAILABLE');
      } else {
        setErrorState('SERVER_ERROR');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setIsSavingUsername(true);
    try {
      const res = await updateUsername(username);
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update username');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const copyPublicLink = (slug: string) => {
    if (!initialUsername) return;
    const url = `${window.location.origin}/book/${initialUsername}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (errorState) {
    let title = 'Unable to load Calendar';
    let description = 'Unable to load Calendar. Please try again.';
    let icon = <AlertTriangle className="w-8 h-8 text-amber-500" />;
    let showAuthBtn = false;

    if (errorState === 'AUTH_EXPIRED') {
      title = 'Session Expired';
      description = 'Your session has expired. Please sign in again.';
      icon = <LogOut className="w-8 h-8 text-red-500" />;
      showAuthBtn = true;
    } else if (errorState === 'CONFIG_ERROR') {
      title = 'Calendar Provider Not Configured';
      description = 'OAuth provider is not configured. Please contact the administrator.';
      icon = <AlertTriangle className="w-8 h-8 text-amber-500" />;
    } else if (errorState === 'PROVIDER_UNAVAILABLE') {
      title = 'Service Temporarily Unavailable';
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

  if (showSettings) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-500" /> Settings: Calendar Connections
          </h1>
          <button
            onClick={() => setShowSettings(false)}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            &larr; Back to Scheduling
          </button>
        </div>
        
        {/* Username Setting */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-lg">Public Booking Profile</h3>
              <p className="text-sm text-zinc-500 mb-4">Set your unique username for public booking links (e.g. lockora.com/book/your-name)</p>
              
              <form onSubmit={handleSaveUsername} className="flex gap-3 max-w-md">
                <div className="flex-1 flex rounded-lg shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-sm">
                    /book/
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="username"
                    className="flex-1 min-w-0 rounded-none rounded-r-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingUsername || username === initialUsername}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSavingUsername ? 'Saving...' : 'Save'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <CalendarConnectionManager connections={connections} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-indigo-500" /> Scheduling
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Create event types, share booking links, and manage your availability.
          </p>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/calendar/availability"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Availability
          </Link>
          <Link
            href="/dashboard/calendar/bookings"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5 text-indigo-500" /> Bookings ({activeBookingsCount})
          </Link>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-500" /> Calendar Connections
          </button>
        </div>
      </div>

      {!hasUsername && (
        <div className="p-5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-400 text-sm flex items-center gap-2">
              <User className="w-4 h-4" /> Setup Required
            </h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Set up your public booking profile to create booking links.
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            Set Username
          </button>
        </div>
      )}

      {hasUsername && activeConnCount === 0 && (
        <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-500 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> No Calendar Connected
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              You must connect a Google or Microsoft calendar in Settings to accept bookings.
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Event Types Section */}
      <div className={`space-y-4 ${!hasUsername ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Event Types</h2>
          <Link
            href="/dashboard/calendar/meeting-types/new"
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Event Type
          </Link>
        </div>

        {meetingTypes.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
            <Video className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">No Event Types</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
              Create your first event type to let people book time with you.
            </p>
            <Link
              href="/dashboard/calendar/meeting-types/new"
              className="inline-flex items-center gap-2 mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <Plus className="w-3.5 h-3.5" /> Create Event Type
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetingTypes.map((type) => (
              <div key={type.id} className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-zinc-900 dark:text-white">{type.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${type.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">{type.durationMinutes} mins • {type.locationType === 'teams' ? 'Microsoft Teams' : type.locationType === 'meet' ? 'Google Meet' : 'Custom Location'}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-lg">
                    <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">/book/{initialUsername}/{type.slug}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <Link href={`/dashboard/calendar/meeting-types/${type.id}`} className="flex-1 text-center py-2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    Edit
                  </Link>
                  <button 
                    onClick={() => copyPublicLink(type.slug)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {copiedSlug === type.slug ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
