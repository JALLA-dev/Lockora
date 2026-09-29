import { getMeetingTypeById } from '@/app/actions/meeting-types';
import { getAvailabilitySchedules } from '@/app/actions/availability';
import { getLockoraUser } from '@/app/actions/user';
import { MeetingTypeEditor } from '@/components/calendar/MeetingTypeEditor';
import { notFound } from 'next/navigation';

export default async function EditMeetingTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [meetingType, schedules, user] = await Promise.all([
    getMeetingTypeById(id),
    getAvailabilitySchedules(),
    getLockoraUser()
  ]);

  if (!meetingType) {
    notFound();
  }

  return <MeetingTypeEditor initialData={meetingType} schedules={schedules} username={user?.username || 'you'} />;
}
