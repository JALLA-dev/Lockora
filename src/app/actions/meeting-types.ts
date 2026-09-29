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

export async function getMeetingTypeById(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  try {
    await ensureCalendarTablesExist();

    const [type] = await db
      .select()
      .from(meetingTypes)
      .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)));

    return type || null;
  } catch (err: any) {
    console.error('[getMeetingTypeById Error]:', err?.message);
    return null;
  }
}

export async function createMeetingType(data: {
  title: string;
  slug?: string;
  description?: string;
  durationMinutes: number;
  locationType: string;
  locationUrl?: string;
  isActive?: boolean;
  isSecret?: boolean;
  scheduleId?: string;
  bufferBefore?: number;
  bufferAfter?: number;
  minNoticeMinutes?: number;
  maxBookingDays?: number;
  maxBookingsPerDay?: number | null;
  questions?: any;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();
  
  // Use provided slug or generate one
  let slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  if (!slug) slug = `meeting-${crypto.randomBytes(3).toString('hex')}`;

  const newId = crypto.randomUUID();

  try {
    await db.insert(meetingTypes).values({
      id: newId,
      userId,
      title: data.title,
      slug,
      description: data.description || null,
      durationMinutes: data.durationMinutes || 30,
      locationType: data.locationType || 'teams',
      locationUrl: data.locationUrl || null,
      isActive: data.isActive ?? true,
      isSecret: data.isSecret ?? false,
      scheduleId: data.scheduleId || null,
      bufferBefore: data.bufferBefore || 0,
      bufferAfter: data.bufferAfter || 0,
      minNoticeMinutes: data.minNoticeMinutes || 120,
      maxBookingDays: data.maxBookingDays || 30,
      maxBookingsPerDay: data.maxBookingsPerDay || null,
      questions: data.questions || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (err: any) {
    if (err.code === '23505') {
      throw new Error('A meeting type with this URL slug already exists.');
    }
    throw err;
  }

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

export async function updateMeetingType(id: string, data: {
  title: string;
  slug: string;
  description?: string;
  durationMinutes: number;
  locationType: string;
  locationUrl?: string;
  isActive?: boolean;
  isSecret?: boolean;
  scheduleId?: string;
  bufferBefore?: number;
  bufferAfter?: number;
  minNoticeMinutes?: number;
  maxBookingDays?: number;
  maxBookingsPerDay?: number | null;
  questions?: any;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();

  try {
    await db
      .update(meetingTypes)
      .set({
        title: data.title,
        slug: data.slug,
        description: data.description || null,
        durationMinutes: data.durationMinutes,
        locationType: data.locationType,
        locationUrl: data.locationUrl || null,
        isActive: data.isActive ?? true,
        isSecret: data.isSecret ?? false,
        scheduleId: data.scheduleId || null,
        bufferBefore: data.bufferBefore || 0,
        bufferAfter: data.bufferAfter || 0,
        minNoticeMinutes: data.minNoticeMinutes || 120,
        maxBookingDays: data.maxBookingDays || 30,
        maxBookingsPerDay: data.maxBookingsPerDay || null,
        questions: data.questions || null,
        updatedAt: timestamp,
      })
      .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, userId)));
  } catch (err: any) {
    if (err.code === '23505') {
      throw new Error('A meeting type with this URL slug already exists.');
    }
    throw err;
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'MEETING_TYPE_UPDATED',
    resource: id,
    result: 'SUCCESS',
    timestamp,
  });

  return { success: true };
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
