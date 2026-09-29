import { getCalendarConnections } from '@/app/actions/calendar-connections';
import { getAvailabilityRules } from '@/app/actions/availability';
import { getMeetingTypes } from '@/app/actions/meeting-types';
import { getUserBookings } from '@/app/actions/bookings';
import { getLockoraUser } from '@/app/actions/user';
import { CalendarDashboardClient, CalendarErrorState } from '@/components/calendar/CalendarDashboardClient';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export default async function CalendarDashboardPage() {
  let connections: any[] = [];
  let rules: any = null;
  let meetingTypesList: any[] = [];
  let bookingsList: any[] = [];
  let initialError: CalendarErrorState = null;
  let username: string | null = null;

  try {
    // Ensure tables exist safely
    await ensureCalendarTablesExist();

    const [resConn, resRules, resTypes, resBookings, resUser] = await Promise.all([
      getCalendarConnections(),
      getAvailabilityRules(),
      getMeetingTypes(),
      getUserBookings(),
      getLockoraUser(),
    ]);

    connections = resConn || [];
    rules = resRules || null;
    meetingTypesList = resTypes || [];
    bookingsList = resBookings || [];
    username = resUser?.username || null;
  } catch (err: any) {
    console.error('[CalendarDashboardPage Load Error]:', err?.message);
    if (err?.message === 'AUTH_EXPIRED') {
      initialError = 'AUTH_EXPIRED';
    } else {
      initialError = 'SERVER_ERROR';
    }
  }

  return (
    <CalendarDashboardClient
      initialConnections={connections}
      initialRules={rules}
      initialMeetingTypes={meetingTypesList}
      initialBookings={bookingsList}
      initialError={initialError}
      initialUsername={username}
    />
  );
}
