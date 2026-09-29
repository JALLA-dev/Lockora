'use client';

import { useState } from 'react';
import { createMeetingType } from '@/app/actions/meeting-types';
import { Video, Copy, ExternalLink, Plus, Check } from 'lucide-react';

interface MeetingType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  locationType: string;
  isActive: boolean;
}

export function MeetingTypeForm({ initialTypes }: { initialTypes: MeetingType[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [locationType, setLocationType] = useState<'teams' | 'custom'>('teams');
  const [loading, setLoading] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const res = await createMeetingType({
        title,
        description,
        durationMinutes: Number(durationMinutes),
        locationType,
      });

      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create meeting type');
    } finally {
      setLoading(false);
    }
  };

  const copyPublicLink = (slug: string) => {
    const url = `${window.location.origin}/booking/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-500" />
              Meeting Types & Public Booking Pages
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create meeting types to share public booking pages with your clients and visitors.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Meeting Type
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {types.length === 0 ? (
            <div className="col-span-2 text-center py-10 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
              <Video className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">No meeting types configured yet.</p>
              <p className="text-xs text-zinc-500">Create your first meeting type to generate a shareable booking link.</p>
            </div>
          ) : (
            types.map((type) => (
              <div
                key={type.id}
                className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">{type.title}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {type.durationMinutes} mins
                    </span>
                  </div>
                  {type.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">{type.description}</p>
                  )}
                  <p className="text-xs text-zinc-500 capitalize">Location: {type.locationType.replace('_', ' ')}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <button
                    onClick={() => copyPublicLink(type.slug)}
                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                  >
                    {copiedSlug === type.slug ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied Link!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Booking Link
                      </>
                    )}
                  </button>

                  <a
                    href={`/booking/${type.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Open Page <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Create New Meeting Type</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30 Minute Security Consultation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Describe the purpose of this meeting..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Duration</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Location</label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as any)}
                    className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white"
                  >
                    <option value="teams">Microsoft Teams</option>
                    <option value="custom">Custom URL</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="text-xs font-semibold px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Meeting Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
