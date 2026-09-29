import { getAvailabilitySchedules } from '@/app/actions/availability';
import { AvailabilityManagerClient } from '@/components/calendar/AvailabilityManagerClient';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export default async function AvailabilityPage() {
  await ensureCalendarTablesExist();
  const schedules = await getAvailabilitySchedules();

  return <AvailabilityManagerClient initialSchedules={schedules} />;
}
