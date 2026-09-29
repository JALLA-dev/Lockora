import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').unique(),
  
  // Vault crypto fields
  vaultSalt: text('vault_salt'),
  publicKey: text('public_key'),
  encryptedPrivateKey: text('encrypted_private_key'),
  encryptedPrivateKeyRecovery: text('encrypted_private_key_recovery'),

  // Security preferences
  autoLockMinutes: integer('auto_lock_minutes').default(15).notNull(),

  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const otps = pgTable('otps', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  code: text('code').notNull(),
  purpose: text('purpose').notNull(), // 'SETUP', 'CHANGE_PASSWORD'
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
