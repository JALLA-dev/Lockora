'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { availabilitySchedules, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';

const DEFAULT_HOURS = {
  mon: [{ start: '09:00', end: '17:00' }],
  tue: [{ start: '09:00', end: '17:00' }],
  wed: [{ start: '09:00', end: '17:00' }],
  thu: [{ start: '09:00', end: '17:00' }],
  fri: [{ start: '09:00', end: '17:00' }],
  sat: [],
  sun: [],
};

export async function getAvailabilitySchedules() {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  try {
    await ensureCalendarTablesExist();

    const schedules = await db
      .select()
      .from(availabilitySchedules)
      .where(eq(availabilitySchedules.userId, userId));

    // If none exist, auto-create a default one
    if (!schedules || schedules.length === 0) {
      const defaultId = crypto.randomUUID();
      const timestamp = new Date();
      await db.insert(availabilitySchedules).values({
        id: defaultId,
        userId,
        name: 'Working Hours',
        timeZone: 'UTC',
        weeklyHours: DEFAULT_HOURS,
        isDefault: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return [{
        id: defaultId,
        userId,
        name: 'Working Hours',
        timeZone: 'UTC',
        weeklyHours: DEFAULT_HOURS,
        isDefault: true,
      }];
    }

    return schedules;
  } catch (err: any) {
    console.error('[getAvailabilitySchedules Error]:', err?.message);
    return [];
  }
}

export async function createAvailabilitySchedule(data: { name: string, timeZone: string, weeklyHours: any, isDefault: boolean }) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();
  const id = crypto.randomUUID();

  if (data.isDefault) {
    await db.update(availabilitySchedules).set({ isDefault: false }).where(eq(availabilitySchedules.userId, userId));
  }

  await db.insert(availabilitySchedules).values({
    id,
    userId,
    name: data.name,
    timeZone: data.timeZone,
    weeklyHours: data.weeklyHours,
    isDefault: data.isDefault,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { success: true, id };
}

export async function updateAvailabilitySchedule(id: string, data: { name: string, timeZone: string, weeklyHours: any, isDefault: boolean }) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();

  if (data.isDefault) {
    await db.update(availabilitySchedules).set({ isDefault: false }).where(eq(availabilitySchedules.userId, userId));
  }

  await db
    .update(availabilitySchedules)
    .set({
      name: data.name,
      timeZone: data.timeZone,
      weeklyHours: data.weeklyHours,
      isDefault: data.isDefault,
      updatedAt: timestamp,
    })
    .where(and(eq(availabilitySchedules.id, id), eq(availabilitySchedules.userId, userId)));

  return { success: true };
}

export async function deleteAvailabilitySchedule(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  await db.delete(availabilitySchedules).where(and(eq(availabilitySchedules.id, id), eq(availabilitySchedules.userId, userId)));

  return { success: true };
}
