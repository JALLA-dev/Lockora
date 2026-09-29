'use client';

import { useState } from 'react';
import { cancelUserBooking } from '@/app/actions/bookings';
import { Calendar, Clock, User, Mail, Video, XCircle, CheckCircle2 } from 'lucide-react';

interface BookingItem {
  id: string;
  visitorName: string;
  visitorEmail: string;
  visitorNotes: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
  meetingUrl: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  meetingTitle: string | null;
}

export function BookingsList({ bookings }: { bookings: BookingItem[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    const reason = prompt('Please enter a cancellation reason:');
    if (reason === null) return;

    setLoadingId(id);
    try {
      await cancelUserBooking(id, reason);
      window.location.reload();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel booking');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          Scheduled Bookings & Meetings
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          View and manage upcoming appointments booked through your Lockora Calendar pages.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
          <Calendar className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">No bookings recorded yet.</p>
          <p className="text-xs text-zinc-500">Share your public booking link to receive meeting reservations.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const isCancelled = b.status === 'CANCELLED';

            return (
              <div
                key={b.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isCancelled
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                        {b.meetingTitle || 'Scheduled Meeting'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isCancelled
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-zinc-400" /> {b.visitorName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-zinc-400" /> {b.visitorEmail}
                      </span>
                      <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(b.startTime).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {b.visitorNotes && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic bg-zinc-100 dark:bg-zinc-900 p-2 rounded">
                        Notes: &quot;{b.visitorNotes}&quot;
                      </p>
                    )}

                    {isCancelled && b.cancellationReason && (
                      <p className="text-xs text-red-500 font-medium">Reason: {b.cancellationReason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {b.meetingUrl && !isCancelled && (
                      <a
                        href={b.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" /> Join Meeting
                      </a>
                    )}

                    {!isCancelled && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={loadingId === b.id}
                        className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-500/10 px-2.5 py-1.5 rounded-md transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
