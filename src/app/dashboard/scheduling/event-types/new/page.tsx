import { getAvailabilitySchedules } from '@/app/actions/availability';
import { getLockoraUser } from '@/app/actions/user';
import { MeetingTypeEditor } from '@/components/calendar/MeetingTypeEditor';

export default async function NewMeetingTypePage() {
  const user = await getLockoraUser();
  const schedules = await getAvailabilitySchedules();
  
  return <MeetingTypeEditor schedules={schedules} username={user?.username || 'you'} />;
}
