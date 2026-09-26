CREATE TABLE `secret_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`encrypted_data_key` text NOT NULL,
	`permissions` text DEFAULT 'read' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `encrypted_private_key_recovery` text;