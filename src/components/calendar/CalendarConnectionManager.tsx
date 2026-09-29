'use client';

import { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, RefreshCw, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  disconnectCalendar,
  fetchConnectionCalendars,
  updateSelectedCalendar,
} from '@/app/actions/calendar-connections';

interface Connection {
  id: string;
  provider: string;
  providerAccountId: string;
  calendarId: string;
  status: string;
  createdAt: Date;
}

export function CalendarConnectionManager({ connections }: { connections: Connection[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);
  const [selectedCalId, setSelectedCalId] = useState<string>('primary');

  const outlookConn = connections.find((c) => c.provider === 'outlook' && c.status === 'ACTIVE');

  useEffect(() => {
    if (outlookConn) {
      setSelectedCalId(outlookConn.calendarId || 'primary');
      fetchConnectionCalendars(outlookConn.id)
        .then((cals) => {
          if (cals && cals.length > 0) {
            setAvailableCalendars(cals);
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }, [outlookConn?.id]);

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect Microsoft Outlook Calendar?')) return;
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

  const handleCalendarChange = async (calId: string) => {
    if (!outlookConn) return;
    setSelectedCalId(calId);
    try {
      await updateSelectedCalendar(outlookConn.id, calId);
    } catch (err: any) {
      alert(err?.message || 'Failed to update selected calendar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          Connected Calendar Provider
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Connect your Microsoft Outlook Calendar to automatically sync availability and generate Microsoft Teams meeting links. OAuth access tokens are encrypted at rest with AES-256-GCM.
        </p>

        {/* Outlook Calendar Card */}
        <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between max-w-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                  <Calendar className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white text-base">Microsoft Outlook Calendar</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Microsoft 365, Outlook.com & Work Accounts</p>
                </div>
              </div>
              {outlookConn ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <span className="text-xs text-zinc-400 font-medium">Not Connected</span>
              )}
            </div>

            {outlookConn && (
              <div className="space-y-3 my-4 bg-zinc-100 dark:bg-zinc-900/80 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Account:</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-white">{outlookConn.providerAccountId}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Selected Calendar:</span>
                  <select
                    value={selectedCalId}
                    onChange={(e) => handleCalendarChange(e.target.value)}
                    className="text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-zinc-900 dark:text-white font-medium"
                  >
                    {availableCalendars.length > 0 ? (
                      availableCalendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.isPrimary ? '(Primary)' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="primary">Primary Calendar</option>
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            {outlookConn ? (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Sync Calendar
                </button>

                <button
                  onClick={() => handleDisconnect(outlookConn.id)}
                  disabled={loading === outlookConn.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 px-3 py-1.5 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/calendar/outlook/connect"
                className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm ml-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Connect Outlook Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
