import { getAvailabilitySchedules } from '@/app/actions/availability';
import { MeetingTypeEditor } from '@/components/calendar/MeetingTypeEditor';

export default async function NewMeetingTypePage() {
  const schedules = await getAvailabilitySchedules();
  return <MeetingTypeEditor schedules={schedules} />;
}
