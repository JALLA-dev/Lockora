'use client';

import { UserProfile } from '@clerk/nextjs';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Account Profile</h2>
        <p className="text-zinc-400 mt-1">
          Manage your <span className="text-blue-400 font-medium">Lockora account</span> — 
          name, email, password reset, active sessions, and account deletion.
          This is separate from your <span className="text-indigo-400 font-medium">Vault Password</span>.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden">
        <UserProfile
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-2xl border border-zinc-800 bg-zinc-900 rounded-xl',
              navbar: 'bg-zinc-900 border-r border-zinc-800',
              navbarButton: 'text-zinc-300 hover:text-white',
              navbarButtonActive: 'bg-indigo-600 text-white rounded-lg',
              pageScrollBox: 'bg-zinc-900',
              formFieldInput: 'bg-zinc-800 border-zinc-700 text-white',
              formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500',
              headerTitle: 'text-white',
              headerSubtitle: 'text-zinc-400',
            }
          }}
        />
      </div>
    </div>
  );
}
