'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, MoreHorizontal, Link as LinkIcon, Calendar, Clock, Copy, Settings, CheckCircle2, Video } from 'lucide-react';
import { toggleMeetingTypeStatus } from '@/app/actions/meeting-types';

export function SchedulingDashboardClient({ 
  meetingTypes, 
  username 
}: { 
  meetingTypes: any[], 
  username: string 
}) {
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyPublicLink = (slug: string) => {
    if (!username) return;
    const url = `${window.location.origin}/book/${username}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const hasUsername = !!username;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            Scheduling
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Create and manage events that people can book with you.
          </p>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings/calendars"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> Calendar Connections
          </Link>
          <Link
            href="/dashboard/scheduling/event-types/new"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create
          </Link>
        </div>
      </div>

      {!hasUsername && (
        <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-500 text-sm flex items-center gap-2">
              Setup Required
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              You must set a public username in Settings before you can share booking links.
            </p>
          </div>
          <Link
            href="/dashboard/settings/calendars"
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {/* Event Types Grid */}
      <div className={`space-y-4 ${!hasUsername ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
        {meetingTypes.length === 0 ? (
          <div className="py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
            <Calendar className="w-12 h-12 text-zinc-400 mb-4" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Create your first event type</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto mb-6">
              Create a meeting that people can book with you.
            </p>
            <Link
              href="/dashboard/scheduling/event-types/new"
              className="inline-flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Event
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetingTypes.map((type) => (
              <div key={type.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                <div className="h-1.5 w-full bg-indigo-500"></div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{type.title}</h3>
                    
                    {/* Simplified 3-dot menu placeholder for MVP */}
                    <div className="relative group">
                      <button className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <div className="p-1 flex flex-col">
                          <Link href={`/dashboard/scheduling/event-types/${type.id}`} className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-left">Edit</Link>
                          <button onClick={() => copyPublicLink(type.slug)} className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-left">Copy link</button>
                          <button className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md text-left">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-zinc-500 font-medium mb-3">
                    {type.durationMinutes} min • One-on-one
                  </div>
                  
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-4 flex items-center gap-1.5">
                    {type.locationType === 'teams' ? (
                      <Video className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    {type.locationType === 'teams' ? 'Microsoft Teams' : type.locationType === 'meet' ? 'Google Meet' : 'Custom Location'}
                  </div>

                  {type.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4 flex-1">
                      {type.description}
                    </p>
                  )}
                  {!type.description && <div className="flex-1"></div>}
                  
                  <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mb-4 truncate">
                    lockora.com/book/{username}/{type.slug}
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button 
                      onClick={() => copyPublicLink(type.slug)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {copiedSlug === type.slug ? (
                        <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
