'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Globe, User, Mail, MessageSquare, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface AvailableSlot {
  start: string;
  end: string;
  displayTime: string;
  timeZone: string;
}

export function PublicBookingWidget({ slug }: { slug: string }) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [visitorTimeZone, setVisitorTimeZone] = useState<string>('UTC');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [meetingTitle, setMeetingTitle] = useState<string>('30 Minute Consultation');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [description, setDescription] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorNotes, setVisitorNotes] = useState('');

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  // Auto-detect visitor timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setVisitorTimeZone(detected);
    } catch {
      // fallback to UTC
    }
  }, []);

  // Fetch slots whenever selectedDate, visitorTimeZone, or slug changes
  useEffect(() => {
    let active = true;
    async function fetchSlots() {
      setLoadingSlots(true);
      setErrorMsg(null);
      setSelectedSlot(null);
      try {
        const res = await fetch(
          `/api/calendar/public/${slug}/slots?date=${selectedDate}&tz=${encodeURIComponent(visitorTimeZone)}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load availability slots');
        }

        if (active) {
          setSlots(data.slots || []);
          if (data.meetingTitle) setMeetingTitle(data.meetingTitle);
          if (data.durationMinutes) setDurationMinutes(data.durationMinutes);
          if (data.description) setDescription(data.description);
        }
      } catch (err: any) {
        if (active) setErrorMsg(err?.message || 'Error loading slots');
      } finally {
        if (active) setLoadingSlots(false);
      }
    }

    fetchSlots();
    return () => {
      active = false;
    };
  }, [slug, selectedDate, visitorTimeZone]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/calendar/public/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName,
          visitorEmail,
          visitorNotes,
          startTimeIso: selectedSlot.start,
          visitorTimeZone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      setBookingSuccess(data.booking);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to book slot.');
    } finally {
      setSubmitting(false);
    }
  };

  if (bookingSuccess) {
    return (
      <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Booking Confirmed!</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A confirmation email has been dispatched to <span className="font-semibold text-zinc-900 dark:text-white">{bookingSuccess.visitorEmail}</span>.
          </p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between font-medium text-zinc-900 dark:text-white">
            <span>Meeting:</span>
            <span>{bookingSuccess.meetingTitle}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span>Date & Time:</span>
            <span>
              {new Date(bookingSuccess.startTime).toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </span>
          </div>
          {bookingSuccess.meetingUrl && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Join Meeting:</span>
              <a
                href={bookingSuccess.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 font-medium underline"
              >
                Click to Join
              </a>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setBookingSuccess(null);
            setSelectedSlot(null);
          }}
          className="w-full text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          Book Another Slot
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3">
      {/* Left Column: Meeting Info */}
      <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-3 border border-indigo-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> Lockora Calendar
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">{meetingTitle}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-zinc-400" /> {durationMinutes} minutes
          </p>
        </div>

        {description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-white dark:bg-zinc-900/80 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {description}
          </p>
        )}

        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
            <Globe className="w-3 h-3" /> Time Zone
          </label>
          <select
            value={visitorTimeZone}
            onChange={(e) => setVisitorTimeZone(e.target.value)}
            className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
          >
            <option value="UTC">UTC (Universal Time)</option>
            <option value="America/New_York">Eastern Time (US)</option>
            <option value="America/Chicago">Central Time (US)</option>
            <option value="America/Los_Angeles">Pacific Time (US)</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Kolkata">India Standard Time (IST)</option>
            <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
          </select>
        </div>
      </div>

      {/* Center & Right Column: Slot Selection & Visitor Form */}
      <div className="md:col-span-2 p-6 md:p-8 space-y-6">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {!selectedSlot ? (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" /> Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-zinc-900 dark:text-white shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" /> Available Times ({visitorTimeZone})
              </label>

              {loadingSlots ? (
                <div className="py-8 text-center text-xs text-zinc-400">Checking availability...</div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  No available time slots for this date. Please select another date.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {slots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-indigo-600 hover:text-white dark:bg-zinc-900 dark:hover:bg-indigo-600 text-zinc-900 dark:text-white text-xs font-semibold text-center transition-all hover:scale-[1.02]"
                    >
                      {slot.displayTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Visitor Booking Details Form */
          <form onSubmit={handleBook} className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-xs text-zinc-400">Selected Slot:</span>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedSlot.displayTime} ({visitorTimeZone}) — {selectedDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline"
              >
                Change Slot
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Smith"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alice@example.com"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Message / Purpose (Optional)
                </label>
                <textarea
                  placeholder="Please share any context for the meeting..."
                  value={visitorNotes}
                  onChange={(e) => setVisitorNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white h-20"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg transition-colors shadow-lg disabled:opacity-50"
              >
                {submitting ? 'Confirming Reservation...' : 'Confirm Meeting Reservation'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
