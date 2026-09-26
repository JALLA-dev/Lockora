import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const secretShares = pgTable('secret_shares', {
  id: text('id').primaryKey(),
  secretId: text('secret_id').notNull(),
  ownerId: text('owner_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  
  // SDK encrypted with recipient's Public Key
  encryptedDataKey: text('encrypted_data_key').notNull(),
  
  permissions: text('permissions').default('read').notNull(), // 'read', 'reveal', 'edit', etc.
  
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
