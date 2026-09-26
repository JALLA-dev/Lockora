ALTER TABLE `users` ADD `vault_salt` text;--> statement-breakpoint
ALTER TABLE `users` ADD `public_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `encrypted_private_key` text;