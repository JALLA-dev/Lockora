import { getMeetingTypeById } from '@/app/actions/meeting-types';
import { MeetingTypeEditor } from '@/components/calendar/MeetingTypeEditor';
import { notFound } from 'next/navigation';

export default async function EditMeetingTypePage({ params }: { params: { id: string } }) {
  const meetingType = await getMeetingTypeById(params.id);

  if (!meetingType) {
    notFound();
  }

  return <MeetingTypeEditor initialData={meetingType} />;
}
