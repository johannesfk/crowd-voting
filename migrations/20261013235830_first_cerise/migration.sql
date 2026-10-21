CREATE TABLE `ballot` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`device_id` text NOT NULL,
	`cast_at` integer NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ballot_contest_device` ON `ballot` (`contest_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `vote` (
	`ballot_id` text NOT NULL,
	`entry_id` text NOT NULL,
	PRIMARY KEY(`ballot_id`, `entry_id`),
	FOREIGN KEY (`ballot_id`) REFERENCES `ballot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE cascade
);
