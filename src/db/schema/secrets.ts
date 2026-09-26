import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const secrets = pgTable('secrets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  
  // Plaintext Metadata
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Password', 'API Key', etc.
  tags: text('tags'), // JSON array of strings
  
  // Encrypted Payload
  encryptedData: text('encrypted_data').notNull(), 
  
  // The SDK (Secret Data Key) encrypted with the owner's public key (RSA-OAEP)
  encryptedDataKey: text('encrypted_data_key').notNull(),
  
  // Extra Metadata
  safeMetadata: text('safe_metadata'), // JSON array of non-sensitive custom fields
  expiryAt: timestamp('expiry_at'),
  expiryReminder1DaySentAt: timestamp('expiry_reminder_1d_sent_at'),
  expiryReminderDayOfSentAt: timestamp('expiry_reminder_day_sent_at'),
  
  requiresRotation: boolean('requires_rotation').default(false).notNull(),
  rotationDueAt: timestamp('rotation_due_at'),
  rotationReminderSentAt: timestamp('rotation_reminder_sent_at'),
  lastRotatedAt: timestamp('last_rotated_at'),
  
  // Metadata for the crypto
  encryptionVersion: integer('encryption_version').default(1).notNull(),

  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),

  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
