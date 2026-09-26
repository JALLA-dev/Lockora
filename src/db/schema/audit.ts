import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  result: text('result').notNull(), // 'SUCCESS' | 'FAILURE'
  ipAddress: text('ip_address'),
  timestamp: timestamp('timestamp').notNull(),
});
