'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMeetingType, updateMeetingType } from '@/app/actions/meeting-types';
import { 
  ArrowLeft, Clock, MapPin, AlignLeft, Info, Calendar as CalendarIcon, 
  Settings, CheckCircle2, Lock, Globe, Plus, Trash2 
} from 'lucide-react';
import Link from 'next/link';

interface MeetingTypeEditorProps {
  initialData?: any;
  schedules?: any[];
  username?: string;
}

export function MeetingTypeEditor({ initialData, schedules = [], username = 'you' }: MeetingTypeEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');
  const isEditing = !!initialData;

  const defaultSchedule = schedules.find(s => s.isDefault) || schedules[0];

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    durationMinutes: initialData?.durationMinutes || 30,
    locationType: (initialData?.locationType || 'teams') as 'teams' | 'meet' | 'custom',
    locationUrl: initialData?.locationUrl || '',
    slug: initialData?.slug || '',
    isActive: initialData?.isActive ?? true,
    isSecret: initialData?.isSecret ?? false,
    scheduleId: initialData?.scheduleId || defaultSchedule?.id || '',
    bufferBefore: initialData?.bufferBefore || 0,
    bufferAfter: initialData?.bufferAfter || 0,
    minNoticeMinutes: initialData?.minNoticeMinutes || 120,
    maxBookingDays: initialData?.maxBookingDays || 30,
    maxBookingsPerDay: initialData?.maxBookingsPerDay || 0,
    questions: initialData?.questions || [
      { id: '1', name: 'Name', type: 'text', required: true, system: true },
      { id: '2', name: 'Email', type: 'email', required: true, system: true },
    ],
  });

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setFormData({
      ...formData,
      title: newTitle,
      slug: isEditing ? formData.slug : generateSlug(newTitle),
    });
  };

  const handleQuestionChange = (id: string, field: string, value: any) => {
    setFormData({
      ...formData,
      questions: formData.questions.map((q: any) => q.id === id ? { ...q, [field]: value } : q)
    });
  };

  const addQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions, 
        { id: Math.random().toString(), name: 'New Question', type: 'text', required: false, system: false }
      ]
    });
  };

  const removeQuestion = (id: string) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((q: any) => q.id !== id)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      setActiveSection('basic');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        maxBookingsPerDay: formData.maxBookingsPerDay === 0 ? null : formData.maxBookingsPerDay
      };
      
      let res;
      if (isEditing && initialData.id) {
        res = await updateMeetingType(initialData.id, payload);
      } else {
        res = await createMeetingType(payload);
      }
      
      if (res.success) {
        router.push('/dashboard/scheduling');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save meeting type');
    } finally {
      setLoading(false);
    }
  };

  const SectionNav = ({ id, label, icon: Icon, active }: any) => (
    <button
      type="button"
      onClick={() => setActiveSection(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
        active 
          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-r-2 border-indigo-600' 
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <Link href="/dashboard/scheduling" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Scheduling
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isEditing ? 'Edit Event Type' : 'Create Event Type'}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/scheduling')}
            className="px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
            Save & Continue
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <SectionNav id="basic" label="Basic Information" icon={Info} active={activeSection === 'basic'} />
          <SectionNav id="location" label="Location & Duration" icon={MapPin} active={activeSection === 'location'} />
          <SectionNav id="availability" label="Availability Settings" icon={CalendarIcon} active={activeSection === 'availability'} />
          <SectionNav id="limits" label="Limits & Buffers" icon={Clock} active={activeSection === 'limits'} />
          <SectionNav id="booking_page" label="Booking Page" icon={Globe} active={activeSection === 'booking_page'} />
          <SectionNav id="questions" label="Invitee Questions" icon={AlignLeft} active={activeSection === 'questions'} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 lg:p-8">
          
          {/* BASIC INFO */}
          {activeSection === 'basic' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Basic Information</h2>
                <p className="text-sm text-zinc-500">The foundational details of your meeting.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Event Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 30 Minute Discovery Call"
                    value={formData.title}
                    onChange={handleTitleChange}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description (Optional)</label>
                  <p className="text-xs text-zinc-500 mb-2">Provide instructions or agenda for the invitee.</p>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-white h-32 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="In this meeting, we will discuss..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* LOCATION & DURATION */}
          {activeSection === 'location' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Location & Duration</h2>
                <p className="text-sm text-zinc-500">Define where and how long the meeting will take place.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duration</label>
                  <div className="flex flex-wrap gap-3">
                    {[15, 30, 45, 60, 90, 120].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setFormData({ ...formData, durationMinutes: mins })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          formData.durationMinutes === mins
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Location Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { id: 'teams', label: 'Microsoft Teams', desc: 'Auto-generate link' },
                      { id: 'meet', label: 'Google Meet', desc: 'Auto-generate link' },
                      { id: 'custom', label: 'Custom URL', desc: 'Zoom, Webex, etc' }
                    ].map((loc) => (
                      <div
                        key={loc.id}
                        onClick={() => setFormData({ ...formData, locationType: loc.id as any })}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                          formData.locationType === loc.id
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/5'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-zinc-900 dark:text-white">{loc.label}</span>
                          {formData.locationType === loc.id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <span className="text-xs text-zinc-500">{loc.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.locationType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Custom Location URL</label>
                    <input
                      type="url"
                      placeholder="https://zoom.us/j/..."
                      value={formData.locationUrl}
                      onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AVAILABILITY */}
          {activeSection === 'availability' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Availability Settings</h2>
                <p className="text-sm text-zinc-500">Select which schedule to use for this event type.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Schedule</label>
                <select
                  value={formData.scheduleId}
                  onChange={(e) => setFormData({ ...formData, scheduleId: e.target.value })}
                  className="w-full max-w-md rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} {s.isDefault ? '(Default)' : ''}</option>
                  ))}
                  {schedules.length === 0 && (
                    <option value="">No schedules available</option>
                  )}
                </select>
                <p className="mt-3 text-xs text-zinc-500">
                  Schedules define your general working hours. You can manage them in the <Link href="/dashboard/availability" className="text-indigo-600 dark:text-indigo-400 hover:underline">Availability page</Link>.
                </p>
              </div>
            </div>
          )}

          {/* LIMITS AND BUFFERS */}
          {activeSection === 'limits' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Limits & Buffers</h2>
                <p className="text-sm text-zinc-500">Set rules for when people can book and how many meetings you take.</p>
              </div>

              <div className="space-y-6 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Buffer Before Event (Minutes)</label>
                  <p className="text-xs text-zinc-500 mb-2">Give yourself time to prepare before the meeting.</p>
                  <select
                    value={formData.bufferBefore}
                    onChange={(e) => setFormData({ ...formData, bufferBefore: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
                  >
                    <option value={0}>0 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Buffer After Event (Minutes)</label>
                  <p className="text-xs text-zinc-500 mb-2">Give yourself time to wrap up or travel.</p>
                  <select
                    value={formData.bufferAfter}
                    onChange={(e) => setFormData({ ...formData, bufferAfter: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
                  >
                    <option value={0}>0 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Minimum Scheduling Notice</label>
                  <p className="text-xs text-zinc-500 mb-2">Prevent last-minute bookings.</p>
                  <select
                    value={formData.minNoticeMinutes}
                    onChange={(e) => setFormData({ ...formData, minNoticeMinutes: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
                  >
                    <option value={0}>No minimum</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                    <option value={1440}>24 hours</option>
                    <option value={2880}>48 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date Range (Booking Window)</label>
                  <p className="text-xs text-zinc-500 mb-2">How far into the future can people book?</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={formData.maxBookingDays}
                      onChange={(e) => setFormData({ ...formData, maxBookingDays: Number(e.target.value) })}
                      className="w-24 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">days into the future</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Maximum Bookings Per Day</label>
                  <p className="text-xs text-zinc-500 mb-2">Limit how many of these events can occur in a single day.</p>
                  <select
                    value={formData.maxBookingsPerDay}
                    onChange={(e) => setFormData({ ...formData, maxBookingsPerDay: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white"
                  >
                    <option value={0}>Unlimited</option>
                    <option value={1}>1 per day</option>
                    <option value={2}>2 per day</option>
                    <option value={3}>3 per day</option>
                    <option value={4}>4 per day</option>
                    <option value={5}>5 per day</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* BOOKING PAGE */}
          {activeSection === 'booking_page' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Booking Page Options</h2>
                <p className="text-sm text-zinc-500">Configure how your page appears to invitees.</p>
              </div>

              <div className="space-y-6 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Event URL Slug</label>
                  <div className="flex rounded-lg shadow-sm">
                    <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-sm">
                      lockora.com/book/{username}/
                    </span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="flex-1 min-w-0 rounded-none rounded-r-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Privacy Settings</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isSecret: false })}
                      className={`flex-1 flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        !formData.isSecret
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/5'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
                      }`}
                    >
                      <Globe className={`w-6 h-6 mb-2 ${!formData.isSecret ? 'text-indigo-600' : 'text-zinc-400'}`} />
                      <span className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">Public</span>
                      <span className="text-xs text-zinc-500 text-center">Shows on your main booking profile page.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isSecret: true })}
                      className={`flex-1 flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                        formData.isSecret
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/5'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
                      }`}
                    >
                      <Lock className={`w-6 h-6 mb-2 ${formData.isSecret ? 'text-indigo-600' : 'text-zinc-400'}`} />
                      <span className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">Secret</span>
                      <span className="text-xs text-zinc-500 text-center">Only visible to people who have the exact link.</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="block text-sm font-medium text-zinc-900 dark:text-white">Active Status</span>
                    <span className="text-xs text-zinc-500">Turn this event type on or off.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QUESTIONS */}
          {activeSection === 'questions' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">Invitee Questions</h2>
                <p className="text-sm text-zinc-500">Information to collect from the invitee when they book.</p>
              </div>

              <div className="space-y-4">
                {formData.questions.map((q: any, i: number) => (
                  <div key={q.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 relative group">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Question Name</label>
                        <input
                          type="text"
                          value={q.name}
                          onChange={(e) => handleQuestionChange(q.id, 'name', e.target.value)}
                          disabled={q.system}
                          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
                          <select
                            value={q.type}
                            onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                            disabled={q.system}
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white disabled:opacity-50"
                          >
                            <option value="text">Short Text</option>
                            <option value="textarea">Multiple Lines</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone Number</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => handleQuestionChange(q.id, 'required', e.target.checked)}
                            disabled={q.system}
                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">Required</span>
                        </div>
                      </div>
                    </div>
                    {!q.system && (
                      <button
                        onClick={() => removeQuestion(q.id)}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 py-2"
                >
                  <Plus className="w-4 h-4" /> Add new question
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
