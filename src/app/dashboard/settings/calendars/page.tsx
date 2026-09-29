import { getCalendarConnections } from '@/app/actions/calendar-connections';
import { getLockoraUser } from '@/app/actions/user';
import { CalendarsSettingsClient } from './CalendarsSettingsClient';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export default async function CalendarSettingsPage() {
  await ensureCalendarTablesExist();
  const connections = (await getCalendarConnections()) || [];
  const user = await getLockoraUser();

  return (
    <CalendarsSettingsClient 
      initialConnections={connections}
      initialUsername={user?.username || ''}
    />
  );
}
