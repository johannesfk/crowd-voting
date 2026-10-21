import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { INITIAL_PHASE, type ContestPhase } from '#lib/contest/phases.js';
import { DEFAULT_PODIUM_BACKGROUND } from '#lib/contest/podium.js';

/**
 * A Contest: one party or event, from Registration through Voting to a Published
 * Podium. Many Contests can exist at once, and a Contest never moves backwards
 * through the phases (see `#lib/contest/phases.js`).
 *
 * The ballot and vote tables arrive with the tickets that need them; the tables
 * below are everything an Entry needs to exist, plus the Ballot and its Votes.
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
	// When the operator made the standings public, and `null` until they do. Kept as
	// a moment rather than only as the phase, because "published an hour ago" is a
	// thing the audience link shows and a phase name is not.
	publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
	// The Podium's background, per Contest: an opaque colour for a projector, or
	// `null` meaning fully transparent, so the reveal composites over video in OBS.
	// Never a third value meaning "let the browser decide" — a transparent background
	// has to composite as transparent on the projector and in the exported image alike,
	// so what the operator picked is what is stored.
	presentationBackground: text('presentation_background').$defaultFn(
		() => DEFAULT_PODIUM_BACKGROUND
	),
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
export const entry = sqliteTable(
	'entry',
	{
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
	},
	// One Entry per device per Contest, ever — the same shape as the Ballot's, and
	// enforced by the database for the same reason: registration is final, so a second
	// Entry from one device is a bug rather than a replacement. Two posts in the same
	// instant both pass the route's check and the second loses here.
	//
	// The device index is separate on purpose: the composite above only helps a
	// query that names the Contest as well, and the `device → entries` relation
	// joins on the device alone.
	(table) => [
		uniqueIndex('entry_contest_device').on(table.contestId, table.deviceId),
		index('entry_device').on(table.deviceId)
	]
);

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

/**
 * The choices one device cast in one Contest. There is at most one per device per
 * Contest, ever, and that is a database constraint rather than a check in a
 * route: casting is final, so a second Ballot is not a replacement, it is a bug
 * (ADR 0004).
 *
 * The Ballot holds no weight of its own. A Vote is one selected Entry and every
 * Vote weighs the same, so there is nothing on this table about a person
 * preferring one pick to another.
 */
export const ballot = sqliteTable(
	'ballot',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		contestId: text('contest_id')
			.notNull()
			.references(() => contest.id, { onDelete: 'cascade' }),
		deviceId: text('device_id')
			.notNull()
			.references(() => device.id),
		castAt: integer('cast_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	// The device index is separate on purpose: the composite above only helps a
	// query that names the Contest as well, and the `device → ballots` relation
	// joins on the device alone.
	(table) => [
		uniqueIndex('ballot_contest_device').on(table.contestId, table.deviceId),
		index('ballot_device').on(table.deviceId)
	]
);

/**
 * One selected Entry within a Ballot. The composite primary key is the rule that
 * an Entry cannot be picked twice on one ballot: the second insert fails at the
 * database rather than being remembered by whoever wrote the route.
 */
export const vote = sqliteTable(
	'vote',
	{
		ballotId: text('ballot_id')
			.notNull()
			.references(() => ballot.id, { onDelete: 'cascade' }),
		entryId: text('entry_id')
			.notNull()
			.references(() => entry.id, { onDelete: 'cascade' })
	},
	// The primary key answers for the ballot, which is how a Ballot is read with
	// its Votes. The `entry → votes` relation asks the other way round, and the
	// key's second column cannot answer that.
	(table) => [
		primaryKey({ columns: [table.ballotId, table.entryId] }),
		index('vote_entry').on(table.entryId)
	]
);
