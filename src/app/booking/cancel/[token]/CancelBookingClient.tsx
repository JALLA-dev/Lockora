'use client';

import { useState } from 'react';
import { cancelPublicBooking } from '@/app/actions/public-booking';
import { Ban, Calendar, Clock, CheckCircle2 } from 'lucide-react';

export function CancelBookingClient({
  token,
  meetingTitle,
  startTime,
  hostName,
  status
}: {
  token: string;
  meetingTitle: string;
  startTime: string;
  hostName: string;
  status: string;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(status === 'CANCELLED');

  if (success) {
    return (
      <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <Ban className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Booking Cancelled</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This meeting has been successfully cancelled. Both you and the host have been notified.
          </p>
        </div>
      </div>
    );
  }

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const res = await cancelPublicBooking(token, reason || 'No reason provided');
    if (res.error) {
      setErrorMsg(res.error);
      setSubmitting(false);
    } else {
      setSuccess(true);
    }
  };

  const dt = new Date(startTime);

  return (
    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mb-4">
          <Ban className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Cancel Meeting</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Are you sure you want to cancel this meeting with {hostName}?
        </p>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{meetingTitle}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleCancel} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Reason for cancellation (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Let the host know why you're cancelling..."
            className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white h-20"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50"
        >
          {submitting ? 'Cancelling...' : 'Cancel Meeting'}
        </button>
      </form>
    </div>
  );
}
