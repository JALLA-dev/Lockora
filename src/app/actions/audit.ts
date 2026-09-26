'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { auditLogs, secrets } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function getAuditLogs() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Fetch audit logs for the current user
  const logs = await db.query.auditLogs.findMany({
    where: eq(auditLogs.userId, userId),
    orderBy: [desc(auditLogs.timestamp)],
    limit: 100,
  });

  // Fetch secrets to map resource ID to secret name if possible
  const userSecrets = await db.query.secrets.findMany({
    where: eq(secrets.userId, userId),
    columns: {
      id: true,
      name: true,
    }
  });

  const secretMap = new Map(userSecrets.map(s => [s.id, s.name]));

  // Add the secret name to the log if it's a secret resource
  return logs.map(log => ({
    ...log,
    resourceName: secretMap.get(log.resource) || log.resource,
  }));
}
