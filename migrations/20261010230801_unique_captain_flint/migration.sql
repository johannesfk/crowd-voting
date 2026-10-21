CREATE TABLE `contest` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`registration_notice` text,
	`voting_notice` text,
	`phase` text DEFAULT 'registration' NOT NULL,
	`created_at` integer NOT NULL
);
