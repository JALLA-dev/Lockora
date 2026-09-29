'use client';

import { useState } from 'react';
import { updateAvailabilitySchedule, createAvailabilitySchedule, deleteAvailabilitySchedule } from '@/app/actions/availability';
import { Clock, Globe, Save, Check, Plus, Trash2, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const DEFAULT_HOURS = {
  mon: [{ start: '09:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '17:00' }],
  sat: [],
  sun: [],
};

export function AvailabilityManagerClient({ initialSchedules = [] }: { initialSchedules: any[] }) {
  const router = useRouter();
  const [schedules, setSchedules] = useState(initialSchedules);
  const [activeScheduleId, setActiveScheduleId] = useState(initialSchedules[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeSchedule = schedules.find(s => s.id === activeScheduleId) || schedules[0];

  const handleSelectSchedule = (id: string) => {
    setActiveScheduleId(id);
  };

  const handleCreateNew = async () => {
    setSaving(true);
    try {
      const res = await createAvailabilitySchedule({
        name: `Schedule ${schedules.length + 1}`,
        timeZone: 'UTC',
        weeklyHours: DEFAULT_HOURS,
        isDefault: schedules.length === 0,
      });
      if (res.success) {
        const updatedSchedules = [
          ...schedules,
          {
            id: res.id,
            name: `Schedule ${schedules.length + 1}`,
            timeZone: 'UTC',
            weeklyHours: DEFAULT_HOURS,
            isDefault: schedules.length === 0,
          }
        ];
        setSchedules(updatedSchedules);
        setActiveScheduleId(res.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule? Event types using it may become unavailable.')) return;
    try {
      await deleteAvailabilitySchedule(id);
      const updatedSchedules = schedules.filter(s => s.id !== id);
      setSchedules(updatedSchedules);
      if (activeScheduleId === id) {
        setActiveScheduleId(updatedSchedules[0]?.id || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (!activeSchedule) return;
    const updatedSchedules = schedules.map(s => 
      s.id === activeSchedule.id ? { ...s, [field]: value } : s
    );
    setSchedules(updatedSchedules);
  };

  const toggleDayActive = (dayKey: string) => {
    if (!activeSchedule) return;
    const currentHours = activeSchedule.weeklyHours[dayKey] || [];
    const newHours = currentHours.length > 0 ? [] : [{ start: '09:00', end: '17:00' }];
    
    handleChange('weeklyHours', {
      ...activeSchedule.weeklyHours,
      [dayKey]: newHours
    });
  };

  const updateHours = (dayKey: string, field: 'start' | 'end', value: string) => {
    if (!activeSchedule) return;
    const currentHours = activeSchedule.weeklyHours[dayKey] || [{ start: '09:00', end: '17:00' }];
    const newHours = [{ ...currentHours[0], [field]: value }];
    
    handleChange('weeklyHours', {
      ...activeSchedule.weeklyHours,
      [dayKey]: newHours
    });
  };

  const handleSave = async () => {
    if (!activeSchedule) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateAvailabilitySchedule(activeSchedule.id, {
        name: activeSchedule.name,
        timeZone: activeSchedule.timeZone,
        weeklyHours: activeSchedule.weeklyHours,
        isDefault: activeSchedule.isDefault,
      });
      // If we set this to default, update local state for other schedules
      if (activeSchedule.isDefault) {
        setSchedules(schedules.map(s => ({
          ...s,
          isDefault: s.id === activeSchedule.id
        })));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to update availability rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            Availability
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Configure your working hours and when you're available for meetings.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Left Sidebar: Schedules List */}
        <div className="w-full md:w-72 shrink-0 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Schedules</h2>
            <button
              onClick={handleCreateNew}
              disabled={saving}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 transition-colors disabled:opacity-50"
              title="Create new schedule"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col">
            {schedules.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSchedule(s.id)}
                className={`flex items-center justify-between px-4 py-3 text-sm transition-colors text-left ${
                  activeScheduleId === s.id 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-l-2 border-indigo-600 font-medium'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-2 border-transparent'
                }`}
              >
                <span>{s.name} {s.isDefault ? '(Default)' : ''}</span>
              </button>
            ))}
            {schedules.length === 0 && (
              <div className="p-6 text-center text-zinc-500 text-sm">
                No schedules found.
              </div>
            )}
          </div>
        </div>

        {/* Main Editor */}
        {activeSchedule && (
          <div className="flex-1 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 lg:p-8 space-y-8">
              
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
                <div className="flex-1 max-w-sm space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Schedule Name</label>
                  <input
                    type="text"
                    value={activeSchedule.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full text-xl font-bold bg-transparent border-none p-0 focus:ring-0 text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-3">
                  {!activeSchedule.isDefault && schedules.length > 1 && (
                    <button
                      onClick={() => handleDelete(activeSchedule.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saved ? (
                      <><Check className="w-4 h-4 text-emerald-300" /> Saved!</>
                    ) : (
                      <><Save className="w-4 h-4" /> Save</>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> Timezone
                  </label>
                  <select
                    value={activeSchedule.timeZone}
                    onChange={(e) => handleChange('timeZone', e.target.value)}
                    className="w-full max-w-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
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
                
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={activeSchedule.isDefault}
                    onChange={(e) => handleChange('isDefault', e.target.checked)}
                    disabled={activeSchedule.isDefault} // Can't uncheck default directly, must check another one
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5 disabled:opacity-50"
                  />
                  <label htmlFor="isDefault" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Set as default schedule
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-500" /> Weekly Hours
                </h3>
                
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-950/20">
                  {DAYS.map((day) => {
                    const hours = activeSchedule.weeklyHours[day.key] || [];
                    const isActive = hours.length > 0;
                    const currentHour = hours[0] || { start: '09:00', end: '17:00' };

                    return (
                      <div
                        key={day.key}
                        className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-white dark:hover:bg-zinc-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 w-40 shrink-0">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => toggleDayActive(day.key)}
                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                          />
                          <span className={`text-sm font-semibold ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                            {day.label}
                          </span>
                        </div>

                        {isActive ? (
                          <div className="flex items-center gap-3">
                            <input
                              type="time"
                              value={currentHour.start}
                              onChange={(e) => updateHours(day.key, 'start', e.target.value)}
                              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <span className="text-sm font-medium text-zinc-400">-</span>
                            <input
                              type="time"
                              value={currentHour.end}
                              onChange={(e) => updateHours(day.key, 'end', e.target.value)}
                              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-zinc-400 italic">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
