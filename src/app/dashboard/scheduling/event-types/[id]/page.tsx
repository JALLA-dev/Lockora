import { getMeetingTypeById } from '@/app/actions/meeting-types';
import { getAvailabilitySchedules } from '@/app/actions/availability';
import { MeetingTypeEditor } from '@/components/calendar/MeetingTypeEditor';
import { notFound } from 'next/navigation';

export default async function EditMeetingTypePage({ params }: { params: { id: string } }) {
  const [meetingType, schedules] = await Promise.all([
    getMeetingTypeById(params.id),
    getAvailabilitySchedules()
  ]);

  if (!meetingType) {
    notFound();
  }

  return <MeetingTypeEditor initialData={meetingType} schedules={schedules} />;
}
