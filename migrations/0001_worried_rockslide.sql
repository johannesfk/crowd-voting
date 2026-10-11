CREATE TABLE `device` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`shuffle_seed` text NOT NULL,
	`network_hash` text,
	`fingerprint_hash` text,
	`first_seen_at` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_contest_token` ON `device` (`contest_id`,`token_hash`);--> statement-breakpoint
CREATE TABLE `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`costume` text NOT NULL,
	`photo_key` text NOT NULL,
	`device_id` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`registered_at` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_entry_position` ON `participant` (`entry_id`,`position`);