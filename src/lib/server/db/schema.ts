import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { INITIAL_PHASE, type ContestPhase } from '#lib/contest/phases.js';

/**
 * A Contest: one party or event, from Registration through Voting to a Published
 * Podium. Many Contests can exist at once, and a Contest never moves backwards
 * through the phases (see `#lib/contest/phases.js`).
 *
 * The ballot and vote tables arrive with the tickets that need them; the tables
 * below are everything an Entry needs to exist.
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

/**
 * One browser's visit to one Contest. The row is what "this device" means
 * everywhere else: an Entry records the device that registered it, and later a
 * Ballot records the device that cast it, so own-entry detection is a foreign
 * key rather than a guess (ADR 0004).
 *
 * The token itself never reaches the database — only its digest — so a copy of
 * the database is not a set of credentials. The network and fingerprint hashes
 * are the advisory Duplicate signal: the operator may see them, and they never
 * refuse anyone a request, because a venue's guests share one access point.
 */
export const device = sqliteTable(
	'device',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		contestId: text('contest_id')
			.notNull()
			.references(() => contest.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		// Fixed on the first visit and never changed, so one device sees one
		// order of the ballot for the whole Contest.
		shuffleSeed: text('shuffle_seed').notNull(),
		networkHash: text('network_hash'),
		fingerprintHash: text('fingerprint_hash'),
		firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('device_contest_token').on(table.contestId, table.tokenHash)]
);

/**
 * One costume, registered by the audience and voted on as a single unit — a group
 * of any size is still one Entry. The photo lives in object storage; only its key
 * is kept here, because photographs are the largest thing the platform stores and
 * do not belong in the database.
 */
export const entry = sqliteTable('entry', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	contestId: text('contest_id')
		.notNull()
		.references(() => contest.id, { onDelete: 'cascade' }),
	// What the Entry is dressed up as, in the audience member's own words.
	costume: text('costume').notNull(),
	photoKey: text('photo_key').notNull(),
	// The browser that registered it, which is also what makes it that browser's
	// own Entry on the ballot.
	deviceId: text('device_id')
		.notNull()
		.references(() => device.id),
	// A Hidden Entry is withheld by the operator before voting opens. It is
	// writable only while the Contest is in Registration, which is what freezes
	// the entry list once voting starts.
	hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
	registeredAt: integer('registered_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

/** One named person in an Entry, in the order they were typed. */
export const participant = sqliteTable(
	'participant',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		entryId: text('entry_id')
			.notNull()
			.references(() => entry.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		position: integer('position').notNull()
	},
	(table) => [uniqueIndex('participant_entry_position').on(table.entryId, table.position)]
);
