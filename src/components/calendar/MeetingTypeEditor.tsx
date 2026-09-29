'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createMeetingType, updateMeetingType } from '@/app/actions/meeting-types';
import { ArrowLeft, Clock, MapPin, AlignLeft, Info, Calendar as CalendarIcon, Settings, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface MeetingTypeEditorProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    durationMinutes: number;
    locationType: string;
    locationUrl: string | null;
    isActive: boolean;
  };
}

export function MeetingTypeEditor({ initialData }: MeetingTypeEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');
  const isEditing = !!initialData;

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    durationMinutes: initialData?.durationMinutes || 30,
    locationType: (initialData?.locationType || 'teams') as 'teams' | 'meet' | 'custom',
    locationUrl: initialData?.locationUrl || '',
    slug: initialData?.slug || '',
    isActive: initialData?.isActive ?? true,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) return;
    
    setLoading(true);
    try {
      let res;
      if (isEditing && initialData.id) {
        res = await updateMeetingType(initialData.id, formData);
      } else {
        res = await createMeetingType(formData);
      }
      
      if (res.success) {
        router.push('/dashboard/calendar');
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
          <Link href="/dashboard/calendar" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Scheduling
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Create Event Type
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/calendar')}
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
          <SectionNav id="limits" label="Booking Limits" icon={Clock} active={activeSection === 'limits'} />
          <SectionNav id="questions" label="Invitee Questions" icon={AlignLeft} active={activeSection === 'questions'} />
          <SectionNav id="advanced" label="Advanced Settings" icon={Settings} active={activeSection === 'advanced'} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 lg:p-8">
          
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
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Public URL</label>
                  <div className="flex rounded-lg shadow-sm">
                    <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-sm">
                      lockora.com/book/you/
                    </span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="flex-1 min-w-0 rounded-none rounded-r-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-2.5 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
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
                    {[15, 30, 45, 60].map((mins) => (
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

          {['availability', 'limits', 'questions', 'advanced'].includes(activeSection) && (
            <div className="py-12 text-center text-zinc-500 animate-in fade-in">
              <Settings className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-zinc-900 dark:text-white mb-1">Advanced Settings Placeholder</p>
              <p className="text-sm">These sections will be implemented in the next phase of the editor build.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
