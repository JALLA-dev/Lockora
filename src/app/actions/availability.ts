'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { availabilityRules, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

const DEFAULT_RULES = {
  userId: '',
  timeZone: 'UTC',
  weeklyHours: {
    mon: [{ start: '09:00', end: '17:00' }],
    tue: [{ start: '09:00', end: '17:00' }],
    wed: [{ start: '09:00', end: '17:00' }],
    thu: [{ start: '09:00', end: '17:00' }],
    fri: [{ start: '09:00', end: '17:00' }],
    sat: [],
    sun: [],
  },
  bufferMinutes: 15,
  minNoticeMinutes: 120,
  maxBookingDays: 30,
};

export async function getAvailabilityRules() {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  try {
    await ensureCalendarTablesExist();

    const rules = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.userId, userId));

    if (!rules || rules.length === 0) {
      return { ...DEFAULT_RULES, userId };
    }

    return rules[0];
  } catch (err: any) {
    console.error('[getAvailabilityRules Error]:', err?.message);
    return { ...DEFAULT_RULES, userId };
  }
}

export async function updateAvailabilityRules(data: {
  timeZone: string;
  weeklyHours: any;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxBookingDays: number;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();
  const existing = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.userId, userId));

  if (existing && existing.length > 0) {
    await db
      .update(availabilityRules)
      .set({
        timeZone: data.timeZone,
        weeklyHours: data.weeklyHours,
        bufferMinutes: data.bufferMinutes,
        minNoticeMinutes: data.minNoticeMinutes,
        maxBookingDays: data.maxBookingDays,
        updatedAt: timestamp,
      })
      .where(eq(availabilityRules.userId, userId));
  } else {
    await db.insert(availabilityRules).values({
      id: crypto.randomUUID(),
      userId,
      timeZone: data.timeZone,
      weeklyHours: data.weeklyHours,
      bufferMinutes: data.bufferMinutes,
      minNoticeMinutes: data.minNoticeMinutes,
      maxBookingDays: data.maxBookingDays,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'AVAILABILITY_UPDATED',
    resource: 'AVAILABILITY',
    result: 'SUCCESS',
    timestamp,
  });

  return { success: true };
}
