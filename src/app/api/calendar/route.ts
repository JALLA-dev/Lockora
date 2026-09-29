import { NextResponse } from 'next/server';
import { getCalendarState } from '@/app/actions/calendar-connections';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = await getCalendarState();
    return NextResponse.json(state);
  } catch (error: any) {
    console.error('[Calendar API Error]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error?.message },
      { status: 500 }
    );
  }
}
