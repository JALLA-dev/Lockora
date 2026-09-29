'use client';

import { useState, useEffect } from 'react';
import { reschedulePublicBooking } from '@/app/actions/public-booking';
import { Calendar, Clock, CheckCircle2, Globe, ArrowRight, RefreshCw } from 'lucide-react';

interface AvailableSlot {
  start: string;
  end: string;
  displayTime: string;
  timeZone: string;
}

export function RescheduleBookingClient({
  token,
  meetingTitle,
  startTime,
  hostName,
  status,
  username,
  slug
}: {
  token: string;
  meetingTitle: string;
  startTime: string;
  hostName: string;
  status: string;
  username: string;
  slug: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [visitorTimeZone, setVisitorTimeZone] = useState<string>('UTC');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setVisitorTimeZone(detected);
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchSlots() {
      setLoadingSlots(true);
      setErrorMsg(null);
      setSelectedSlot(null);
      try {
        const res = await fetch(
          `/api/calendar/public/${username}/${slug}/slots?date=${selectedDate}&tz=${encodeURIComponent(visitorTimeZone)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load availability slots');

        if (active) setSlots(data.slots || []);
      } catch (err: any) {
        if (active) setErrorMsg(err?.message || 'Error loading slots');
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    fetchSlots();
    return () => { active = false; };
  }, [username, slug, selectedDate, visitorTimeZone]);

  if (status !== 'CONFIRMED' && !success) {
    return (
      <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-6 text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2">Cannot Reschedule</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This booking is {status.toLowerCase()} and cannot be rescheduled.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Meeting Rescheduled!</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your meeting with {hostName} has been successfully rescheduled. Both of you will receive an updated confirmation email.
          </p>
        </div>
      </div>
    );
  }

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setErrorMsg(null);

    const res = await reschedulePublicBooking(token, selectedSlot.start);
    if (res.error) {
      setErrorMsg(res.error);
      setSubmitting(false);
    } else {
      setSuccess(true);
    }
  };

  const currentDt = new Date(startTime);

  return (
    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-4xl mx-auto shadow-2xl grid grid-cols-1 md:grid-cols-3">
      {/* Left Column: Meeting Info */}
      <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 pr-0 md:pr-8 pb-6 md:pb-0 mb-6 md:mb-0 space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-3">
            <RefreshCw className="w-3.5 h-3.5" /> Reschedule Meeting
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">{meetingTitle}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">with {hostName}</p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
          <p className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">Current Time</p>
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {currentDt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {currentDt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: New Slot Selection */}
      <div className="md:col-span-2 md:pl-8 space-y-6">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" /> Select New Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-500" /> Time Zone
            </label>
            <select
              value={visitorTimeZone}
              onChange={(e) => setVisitorTimeZone(e.target.value)}
              className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (US)</option>
              <option value="Asia/Kolkata">IST (India)</option>
              {/* Additional common timezones... */}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-500" /> Available Times
          </label>
          
          {loadingSlots ? (
            <div className="py-8 text-center text-xs text-zinc-400">Loading new slots...</div>
          ) : slots.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
              No available time slots on this date.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                    selectedSlot?.start === slot.start
                      ? 'border-indigo-500 bg-indigo-500 text-white shadow-md'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-indigo-50 dark:bg-zinc-900 dark:hover:bg-indigo-900/20 text-zinc-900 dark:text-white'
                  }`}
                >
                  {slot.displayTime}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedSlot && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mb-4">
              <span className="text-xs text-zinc-500 block mb-1">Confirm New Time:</span>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {selectedSlot.displayTime} ({visitorTimeZone}) — {selectedDate}
              </p>
            </div>
            <button
              onClick={handleReschedule}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50"
            >
              {submitting ? 'Confirming Reschedule...' : 'Confirm Reschedule'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
