import { getMeetingTypes } from '@/app/actions/meeting-types';
import { getLockoraUser } from '@/app/actions/user';
import { SchedulingDashboardClient } from './SchedulingDashboardClient';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export default async function SchedulingDashboardPage() {
  await ensureCalendarTablesExist();
  const meetingTypesList = (await getMeetingTypes()) || [];
  const user = await getLockoraUser();

  return (
    <SchedulingDashboardClient 
      meetingTypes={meetingTypesList}
      username={user?.username || ''}
    />
  );
}
