'use client';

import { useState } from 'react';
import { Calendar, CheckCircle2, RefreshCw, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import { disconnectCalendar } from '@/app/actions/calendar-connections';

interface Connection {
  id: string;
  provider: string;
  providerAccountId: string;
  status: string;
  createdAt: Date;
}

export function CalendarConnectionManager({ connections }: { connections: Connection[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const googleConn = connections.find((c) => c.provider === 'google' && c.status === 'ACTIVE');
  const outlookConn = connections.find((c) => c.provider === 'outlook' && c.status === 'ACTIVE');

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this calendar provider?')) return;
    setLoading(id);
    try {
      await disconnectCalendar(id);
      window.location.reload();
    } catch (err: any) {
      alert(err?.message || 'Failed to disconnect');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          Connected Calendar Providers
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Connect your Google Calendar or Microsoft Outlook Calendar to automatically sync availability and create meeting invites. OAuth access tokens are encrypted at rest with AES-256-GCM.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Calendar Card */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-white">Google Calendar</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Google Workspace & Personal</p>
                  </div>
                </div>
                {googleConn ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">Not Connected</span>
                )}
              </div>

              {googleConn && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 p-2 rounded mb-4 font-mono truncate">
                  Account: {googleConn.providerAccountId}
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end">
              {googleConn ? (
                <button
                  onClick={() => handleDisconnect(googleConn.id)}
                  disabled={loading === googleConn.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 px-3 py-1.5 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/calendar/google/connect"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect Google Calendar
                </a>
              )}
            </div>
          </div>

          {/* Microsoft Outlook Card */}
          <div className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-white">Microsoft Outlook</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Microsoft 365 & Outlook.com</p>
                  </div>
                </div>
                {outlookConn ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">Not Connected</span>
                )}
              </div>

              {outlookConn && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 p-2 rounded mb-4 font-mono truncate">
                  Account: {outlookConn.providerAccountId}
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end">
              {outlookConn ? (
                <button
                  onClick={() => handleDisconnect(outlookConn.id)}
                  disabled={loading === outlookConn.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 px-3 py-1.5 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/calendar/outlook/connect"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect Outlook Calendar
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
