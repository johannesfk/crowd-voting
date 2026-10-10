import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { INITIAL_PHASE, type ContestPhase } from '#lib/contest/phases.js';

/**
 * A Contest: one party or event, from Registration through Voting to a Published
 * Podium. Many Contests can exist at once, and a Contest never moves backwards
 * through the phases (see `#lib/contest/phases.js`).
 *
 * The remaining tables of the data model — device, entry, participant, ballot and
 * vote — arrive with the tickets that need them.
 */
export const contest = sqliteTable('contest', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	description: text('description').notNull(),
	// Two optional notices: one shown on the registration form, one on the ballot.
	// Both may be empty.
	registrationNotice: text('registration_notice'),
	votingNotice: text('voting_notice'),
	phase: text('phase').$type<ContestPhase>().notNull().default(INITIAL_PHASE),
	// Milliseconds, not seconds: the operator creates several Contests in the
	// same sitting, and a coarser resolution ties them so "newest first" is no
	// order at all.
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});
