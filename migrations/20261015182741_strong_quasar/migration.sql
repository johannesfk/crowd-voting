ALTER TABLE `contest` ADD `presentation_background` text;
--> statement-breakpoint
-- Backfilled rather than left null, because null is not "unset" here: it is the
-- operator's transparent background, and a Contest created before this column existed
-- has never been asked for one. Falling into transparency on a projector would be the
-- one way to present nothing at all.
UPDATE `contest` SET `presentation_background` = '#101014' WHERE `presentation_background` IS NULL;