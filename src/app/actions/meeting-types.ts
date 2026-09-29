'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { meetingTypes, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

export async function getMeetingTypes() {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  try {
    await ensureCalendarTablesExist();

    const types = await db
      .select()
      .from(meetingTypes)
      .where(eq(meetingTypes.userId, userId))
      .orderBy(desc(meetingTypes.createdAt));

    return types || [];
  } catch (err: any) {
    console.error('[getMeetingTypes Error]:', err?.message);
    return [];
  }
}

export async function createMeetingType(data: {
  title: string;
  slug?: string;
  description?: string;
  durationMinutes: number;
  locationType: 'teams' | 'custom';
  locationUrl?: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();
  const rawSlug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = `${rawSlug}-${crypto.randomBytes(3).toString('hex')}`;

  const newId = crypto.randomUUID();

  await db.insert(meetingTypes).values({
    id: newId,
    userId,
    title: data.title,
    slug,
    description: data.description || null,
    durationMinutes: data.durationMinutes || 30,
    locationType: data.locationType || 'teams',
    locationUrl: data.locationUrl || null,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'MEETING_TYPE_CREATED',
    resource: newId,
    result: 'SUCCESS',
    timestamp,
  });

  return { success: true, id: newId, slug };
}

export async function toggleMeetingTypeStatus(id: string, isActive: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  await db
    .update(meetingTypes)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)));

  return { success: true };
}
