'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { calendarConnections, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { ensureCalendarTablesExist } from '@/lib/calendar/db-init';
import { calendarService } from '@/lib/calendar/CalendarService';

export async function getCalendarConnections() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('AUTH_EXPIRED');
  }

  try {
    await ensureCalendarTablesExist();

    const connections = await db
      .select({
        id: calendarConnections.id,
        provider: calendarConnections.provider,
        providerAccountId: calendarConnections.providerAccountId,
        calendarId: calendarConnections.calendarId,
        destinationCalendar: calendarConnections.destinationCalendar,
        calendarEmail: calendarConnections.calendarEmail,
        status: calendarConnections.status,
        tokenExpiresAt: calendarConnections.tokenExpiresAt,
        createdAt: calendarConnections.createdAt,
        updatedAt: calendarConnections.updatedAt,
      })
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, userId))
      .orderBy(desc(calendarConnections.createdAt));

    return connections || [];
  } catch (err: any) {
    console.error('[getCalendarConnections Error]:', err?.message);
    return [];
  }
}

export async function getCalendarState() {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  const state: any = {
    google: { connected: false },
    microsoft: { connected: false }
  };

  try {
    const connections = await getCalendarConnections();
    
    for (const provider of ['google', 'microsoft']) {
      const conn = connections.find(c => c.provider === provider && c.status === 'ACTIVE');
      if (conn) {
        state[provider] = {
          connected: true,
          id: conn.id,
          account: conn.calendarEmail || conn.providerAccountId || null,
          destinationCalendar: conn.destinationCalendar || conn.calendarId || 'primary',
          calendars: []
        };
        
        try {
          const cals = await calendarService.fetchUserCalendars(userId, conn.id);
          state[provider].calendars = cals || [];
        } catch (err: any) {
          console.error(`[getCalendarState] Failed to fetch calendars for ${provider}:`, err?.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[getCalendarState Error]:', err?.message);
  }

  return state;
}

export async function fetchConnectionCalendars(connectionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  return calendarService.fetchUserCalendars(userId, connectionId);
}

export async function updateSelectedCalendar(connectionId: string, calendarId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();

  await db
    .update(calendarConnections)
    .set({
      destinationCalendar: calendarId, // Using the new destination field
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(calendarConnections.id, connectionId),
        eq(calendarConnections.userId, userId)
      )
    );

  return { success: true };
}

export async function disconnectCalendar(connectionId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('AUTH_EXPIRED');

  await ensureCalendarTablesExist();
  const timestamp = new Date();

  await db
    .update(calendarConnections)
    .set({
      status: 'REVOKED',
      revokedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(calendarConnections.id, connectionId),
        eq(calendarConnections.userId, userId)
      )
    );

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId,
    action: 'CALENDAR_DISCONNECTED',
    resource: 'CALENDAR_PROVIDER',
    result: 'SUCCESS',
    timestamp,
  });

  return { success: true };
}
