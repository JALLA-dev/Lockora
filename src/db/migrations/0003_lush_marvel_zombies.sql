ALTER TABLE `secrets` ADD `safe_metadata` text;--> statement-breakpoint
ALTER TABLE `secrets` ADD `expiry_at` integer;--> statement-breakpoint
ALTER TABLE `secrets` ADD `requires_rotation` integer DEFAULT false NOT NULL;