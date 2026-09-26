'use server';

import { db } from '@/db';
import { secrets, users, auditLogs } from '@/db/schema';
import { eq, and, isNull, lte, gte } from 'drizzle-orm';
import { emailService } from '@/lib/email';
import crypto from 'crypto';

export async function processNotifications() {
  const now = new Date();
  
  // 1. One Day Before Expiry
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
  const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

  const expiringTomorrow = await db.query.secrets.findMany({
    where: (s) => and(
      eq(s.isDeleted, false),
      isNull(s.expiryReminder1DaySentAt),
      gte(s.expiryAt, tomorrowStart),
      lte(s.expiryAt, tomorrowEnd)
    ),
  });

  for (const secret of expiringTomorrow) {
    const user = await db.query.users.findFirst({ where: (u) => eq(u.id, secret.userId) });
    if (user && user.email) {
      await emailService.sendSecurityAlert(
        user.email,
        `Your secret '${secret.name}' expires tomorrow.`,
        new Date()
      );
      await db.update(secrets)
        .set({ expiryReminder1DaySentAt: new Date() })
        .where(eq(secrets.id, secret.id));
        
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: user.id,
        action: 'EXPIRY_REMINDER_SENT',
        resource: secret.id,
        result: 'SUCCESS',
        timestamp: new Date(),
      });
    }
  }
  
  // 2. Day Of Expiry
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const todayEnd = new Date(now.setHours(23, 59, 59, 999));

  const expiringToday = await db.query.secrets.findMany({
    where: (s) => and(
      eq(s.isDeleted, false),
      isNull(s.expiryReminderDayOfSentAt),
      gte(s.expiryAt, todayStart),
      lte(s.expiryAt, todayEnd)
    ),
  });

  for (const secret of expiringToday) {
    const user = await db.query.users.findFirst({ where: (u) => eq(u.id, secret.userId) });
    if (user && user.email) {
      await emailService.sendSecurityAlert(
        user.email,
        `Your secret '${secret.name}' expires today.`,
        new Date()
      );
      await db.update(secrets)
        .set({ expiryReminderDayOfSentAt: new Date() })
        .where(eq(secrets.id, secret.id));
        
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        userId: user.id,
        action: 'EXPIRY_REMINDER_SENT',
        resource: secret.id,
        result: 'SUCCESS',
        timestamp: new Date(),
      });
    }
  }

  return { success: true };
}
