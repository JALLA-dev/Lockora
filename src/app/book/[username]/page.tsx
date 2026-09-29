import { getPublicProfile } from '@/app/actions/public-booking';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, MapPin, ShieldCheck, ArrowRight, Video } from 'lucide-react';
import Image from 'next/image';

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile || !profile.user) {
    notFound();
  }

  const { user, eventTypes } = profile;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 md:p-10 flex flex-col justify-between relative overflow-hidden">
      
      {/* Background styling */}
      <div className="absolute top-0 left-0 w-full h-64 bg-indigo-600/10 dark:bg-indigo-900/20 pointer-events-none" />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full relative z-10 pt-12 space-y-10">
        
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-zinc-900 shadow-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {(user.username?.[0] || 'U').toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
              @{user.username}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Schedule a meeting with {user.username}
            </p>
          </div>
        </div>

        {/* Event Types List */}
        <div className="max-w-3xl mx-auto w-full space-y-6">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Available Event Types</h2>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800 ml-4"></div>
          </div>

          {eventTypes.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No public event types available right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventTypes.map((type: any) => (
                <Link
                  key={type.id}
                  href={`/book/${username}/${type.slug}`}
                  className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {type.title}
                      </h3>
                      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <ArrowRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 flex flex-wrap gap-4 mt-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-4 h-4 text-zinc-400" /> {type.durationMinutes} min
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        {type.locationType === 'teams' ? (
                          <><Video className="w-4 h-4 text-blue-500" /> Teams</>
                        ) : type.locationType === 'meet' ? (
                          <><Video className="w-4 h-4 text-emerald-500" /> Meet</>
                        ) : (
                          <><MapPin className="w-4 h-4 text-zinc-400" /> Custom</>
                        )}
                      </span>
                    </div>

                    {type.description && (
                      <p className="text-sm text-zinc-500 mt-4 line-clamp-2">
                        {type.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-zinc-400 py-8 relative z-10 mt-12 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-indigo-400" /> Powered by Lockora Secure Infrastructure
      </footer>
    </div>
  );
}
