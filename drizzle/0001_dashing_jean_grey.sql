CREATE TABLE `user_ai_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_integrations` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`secret_ciphertext` text NOT NULL,
	`secret_iv` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_integrations_owner_provider_idx` ON `user_integrations` (`user_id`,`provider`);
--> statement-breakpoint
CREATE INDEX `user_integrations_owner_idx` ON `user_integrations` (`user_id`);
