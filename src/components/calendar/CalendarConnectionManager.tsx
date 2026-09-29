'use client';

import { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, RefreshCw, Trash2, ExternalLink, ShieldCheck, Mail } from 'lucide-react';
import { disconnectCalendar, updateSelectedCalendar, getCalendarState } from '@/app/actions/calendar-connections';

export function CalendarConnectionManager({ connections: _oldConnections }: { connections: any[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [calendarState, setCalendarState] = useState<any>(null);
  const [isFetchingState, setIsFetchingState] = useState(true);

  const fetchState = async () => {
    setIsFetchingState(true);
    try {
      const state = await getCalendarState();
      setCalendarState(state);
    } catch (err) {
      console.error('Failed to fetch calendar state', err);
    } finally {
      setIsFetchingState(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleDisconnect = async (id: string, providerName: string) => {
    if (!confirm(`Are you sure you want to disconnect ${providerName}?`)) return;
    setLoading(id);
    try {
      await disconnectCalendar(id);
      await fetchState();
    } catch (err: any) {
      alert(err?.message || 'Failed to disconnect');
    } finally {
      setLoading(null);
    }
  };

  const handleCalendarChange = async (connId: string, calId: string) => {
    try {
      await updateSelectedCalendar(connId, calId);
      await fetchState();
    } catch (err: any) {
      alert(err?.message || 'Failed to update selected calendar');
    }
  };

  const ProviderCard = ({ 
    providerKey, 
    title, 
    connectUrl, 
    description 
  }: { 
    providerKey: 'google' | 'microsoft', 
    title: string, 
    connectUrl: string, 
    description: string 
  }) => {
    const providerState = calendarState?.[providerKey];
    const isConnected = providerState?.connected;
    const connId = providerState?.id;
    const displayEmail = providerState?.account;
    const cals = providerState?.calendars || [];
    const selected = providerState?.destinationCalendar || 'primary';

    return (
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${providerKey === 'google' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                <Calendar className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white text-base">{title}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
              </div>
            </div>
            {isFetchingState ? (
              <span className="text-xs text-zinc-400 font-medium animate-pulse">Loading...</span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="text-xs text-zinc-400 font-medium">Not Connected</span>
            )}
          </div>

          {isConnected && (
            <div className="space-y-3 my-4 bg-zinc-100 dark:bg-zinc-900/80 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              {displayEmail && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Account:
                  </span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-white">{displayEmail}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Destination Calendar:</span>
                <select
                  value={selected}
                  onChange={(e) => handleCalendarChange(connId, e.target.value)}
                  className="text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-zinc-900 dark:text-white font-medium max-w-[200px] truncate"
                >
                  {cals.length > 0 ? (
                    cals.map((c: any) => (
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
          {isConnected ? (
            <div className="flex items-center justify-between w-full">
              <button
                onClick={fetchState}
                className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingState ? 'animate-spin' : ''}`} /> Sync
              </button>

              <button
                onClick={() => handleDisconnect(connId, title)}
                disabled={loading === connId}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-500/10 px-3 py-1.5 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
          ) : (
            <a
              href={connectUrl}
              className={`flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg transition-colors shadow-sm ml-auto ${providerKey === 'google' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Connect {title}
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          Calendar Connections
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Connect your calendars to automatically sync availability and generate meeting links. OAuth access tokens are securely encrypted at rest with AES-256-GCM.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProviderCard 
            providerKey="google"
            title="Google Calendar" 
            connectUrl="/api/calendar/google/connect" 
            description="Google Workspace & Gmail Accounts" 
          />
          <ProviderCard 
            providerKey="microsoft"
            title="Microsoft Outlook" 
            connectUrl="/api/calendar/outlook/connect" 
            description="Microsoft 365, Outlook.com & Work Accounts" 
          />
        </div>
      </div>
    </div>
  );
}
