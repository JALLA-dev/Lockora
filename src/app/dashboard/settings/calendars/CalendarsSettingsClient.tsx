'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarConnectionManager } from '@/components/calendar/CalendarConnectionManager';
import { updateUsername } from '@/app/actions/user';
import { Settings, User } from 'lucide-react';

export function CalendarsSettingsClient({ 
  initialConnections, 
  initialUsername 
}: { 
  initialConnections: any[], 
  initialUsername: string 
}) {
  const [username, setUsername] = useState(initialUsername || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setIsSavingUsername(true);
    setUsernameSuccess(false);
    try {
      const res = await updateUsername(username);
      if (res.success) {
        setUsernameSuccess(true);
        setTimeout(() => setUsernameSuccess(false), 3000);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update username');
    } finally {
      setIsSavingUsername(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-500" /> Calendar Connections
        </h1>
        <Link
          href="/dashboard/scheduling"
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          &larr; Back to Scheduling
        </Link>
      </div>
      
      {/* Username Setting */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
            <User className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-lg">Public Booking Profile</h3>
            <p className="text-sm text-zinc-500 mb-4">Set your unique username for public booking links (e.g. lockora.com/book/your-name)</p>
            
            <form onSubmit={handleSaveUsername} className="flex gap-3 max-w-md">
              <div className="flex-1 flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-sm">
                  /book/
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="username"
                  className="flex-1 min-w-0 rounded-none rounded-r-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingUsername || username === initialUsername}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                {isSavingUsername ? 'Saving...' : 'Save'}
              </button>
            </form>
            {usernameSuccess && (
              <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">Username saved successfully!</p>
            )}
          </div>
        </div>
      </div>

      <CalendarConnectionManager connections={initialConnections} />
    </div>
  );
}
