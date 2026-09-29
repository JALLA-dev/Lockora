'use client';

import { useState } from 'react';
import { updateAvailabilityRules } from '@/app/actions/availability';
import { Clock, Globe, Shield, Save, Check } from 'lucide-react';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export function AvailabilityEditor({ initialRules }: { initialRules: any }) {
  const [timeZone, setTimeZone] = useState(initialRules.timeZone || 'UTC');
  const [bufferMinutes, setBufferMinutes] = useState(initialRules.bufferMinutes || 15);
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(initialRules.minNoticeMinutes || 120);
  const [maxBookingDays, setMaxBookingDays] = useState(initialRules.maxBookingDays || 30);
  const [weeklyHours, setWeeklyHours] = useState(
    initialRules.weeklyHours || {
      mon: [{ start: '09:00', end: '17:00' }],
      tue: [{ start: '09:00', end: '17:00' }],
      wed: [{ start: '09:00', end: '17:00' }],
      thu: [{ start: '09:00', end: '17:00' }],
      fri: [{ start: '09:00', end: '17:00' }],
      sat: [],
      sun: [],
    }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleDayActive = (dayKey: string) => {
    setWeeklyHours((prev: any) => {
      const current = prev[dayKey] || [];
      if (current.length > 0) {
        return { ...prev, [dayKey]: [] };
      } else {
        return { ...prev, [dayKey]: [{ start: '09:00', end: '17:00' }] };
      }
    });
  };

  const updateHours = (dayKey: string, field: 'start' | 'end', value: string) => {
    setWeeklyHours((prev: any) => {
      const current = prev[dayKey] || [{ start: '09:00', end: '17:00' }];
      const updated = [{ ...current[0], [field]: value }];
      return { ...prev, [dayKey]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateAvailabilityRules({
        timeZone,
        weeklyHours,
        bufferMinutes: Number(bufferMinutes),
        minNoticeMinutes: Number(minNoticeMinutes),
        maxBookingDays: Number(maxBookingDays),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to update availability rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Working Hours & Availability Rules
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Define when visitors are allowed to book meetings with you.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" /> Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Availability'}
            </>
          )}
        </button>
      </div>

      {/* Global Config */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" /> Timezone
          </label>
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
          >
            <option value="UTC">UTC (Universal Time)</option>
            <option value="America/New_York">Eastern Time (US & Canada)</option>
            <option value="America/Chicago">Central Time (US & Canada)</option>
            <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Kolkata">India Standard Time (IST)</option>
            <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Buffer Time
          </label>
          <select
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
          >
            <option value={0}>No buffer</option>
            <option value={5}>5 minutes before/after</option>
            <option value={10}>10 minutes before/after</option>
            <option value={15}>15 minutes before/after</option>
            <option value={30}>30 minutes before/after</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Minimum Booking Notice
          </label>
          <select
            value={minNoticeMinutes}
            onChange={(e) => setMinNoticeMinutes(Number(e.target.value))}
            className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
          >
            <option value={0}>Immediate booking</option>
            <option value={60}>1 hour ahead</option>
            <option value={120}>2 hours ahead</option>
            <option value={240}>4 hours ahead</option>
            <option value={1440}>24 hours ahead</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Maximum Booking Window
          </label>
          <select
            value={maxBookingDays}
            onChange={(e) => setMaxBookingDays(Number(e.target.value))}
            className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-white"
          >
            <option value={7}>Up to 7 days ahead</option>
            <option value={14}>Up to 14 days ahead</option>
            <option value={30}>Up to 30 days ahead</option>
            <option value={60}>Up to 60 days ahead</option>
          </select>
        </div>
      </div>

      {/* Weekly Hours Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Weekly Schedule</h3>
        {DAYS.map((day) => {
          const hours = weeklyHours[day.key] || [];
          const isActive = hours.length > 0;
          const currentHour = hours[0] || { start: '09:00', end: '17:00' };

          return (
            <div
              key={day.key}
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40"
            >
              <div className="flex items-center gap-3 w-40">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggleDayActive(day.key)}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className={`text-sm font-medium ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                  {day.label}
                </span>
              </div>

              {isActive ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={currentHour.start}
                    onChange={(e) => updateHours(day.key, 'start', e.target.value)}
                    className="text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-zinc-900 dark:text-white"
                  />
                  <span className="text-xs text-zinc-400">to</span>
                  <input
                    type="time"
                    value={currentHour.end}
                    onChange={(e) => updateHours(day.key, 'end', e.target.value)}
                    className="text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-zinc-900 dark:text-white"
                  />
                </div>
              ) : (
                <span className="text-xs text-zinc-400 italic">Unavailable</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
