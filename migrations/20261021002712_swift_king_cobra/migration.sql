CREATE INDEX `ballot_device` ON `ballot` (`device_id`);--> statement-breakpoint
CREATE INDEX `entry_device` ON `entry` (`device_id`);--> statement-breakpoint
CREATE INDEX `vote_entry` ON `vote` (`entry_id`);