import { getAvailabilityRules } from '@/app/actions/availability';
import { AvailabilityEditor } from '@/components/calendar/AvailabilityEditor';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function AvailabilityPage() {
  const rules = await getAvailabilityRules();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/dashboard/calendar"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Calendar Overview
      </Link>

      <AvailabilityEditor initialRules={rules} />
    </div>
  );
}
