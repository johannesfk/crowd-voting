// The Contest data layer: reading and writing Contests, and nothing else. Routes
// and remote functions call these and stay thin; the rules a Contest obeys — the
// phases in `#lib/contest/phases.js` — live in the domain modules.

import { desc, eq } from 'drizzle-orm';
import { acceptsEntries, nextPhase, type ContestPhase } from '#lib/contest/phases.js';
import { getDb } from './db/index.js';
import { contest } from './db/schema.js';

export type Contest = typeof contest.$inferSelect;

export type NewContest = {
	title: string;
	description: string;
	/** Shown on the registration form. Empty means "show nothing". */
	registrationNotice: string | null;
	/** Shown on the ballot. Empty means "show nothing". */
	votingNotice: string | null;
};

/** Every Contest, newest first, so last year's party is as findable as tonight's. */
export async function listContests(): Promise<Contest[]> {
	return getDb().select().from(contest).orderBy(desc(contest.createdAt));
}

/** One Contest by its unguessable identifier, or `undefined` if there is none. */
export async function getContest(id: string): Promise<Contest | undefined> {
	return getDb().select().from(contest).where(eq(contest.id, id)).get();
}

/**
 * Creates a Contest in Registration. The identifier is an unguessable UUID rather
 * than something derived from the title, so an unpublished Contest cannot be found
 * by guessing a URL.
 */
export async function createContest(input: NewContest): Promise<Contest> {
	const [created] = await getDb().insert(contest).values(input).returning();
	return created;
}

/** A Contest with nowhere left to go: Published is the end of the machine. */
export class NoNextPhase extends Error {}

/** Registration is not open, so there is no voting to open. */
export class VotingAlreadyOpen extends Error {}

/**
 * Closes Registration and opens Voting in one deliberate act, and returns the
 * Contest where it now stands.
 *
 * This is a named edge rather than a generic one-step move on purpose. Registration
 * → Voting is the handover, and it is the only edge that may be taken from
 * Registration; a generic `advanceContest` callable from anywhere would let a later
 * ticket close voting by accident, skipping the deliberate close that the results
 * are supposed to depend on. The phase itself is still the machine's to decide:
 * this refuses to move a Contest that is not in Registration rather than guessing.
 */
export async function openVoting(current: Contest): Promise<Contest> {
	if (!acceptsEntries(current.phase)) throw new VotingAlreadyOpen();

	// `acceptsEntries` is true only in Registration and the machine's next edge out
	// of Registration is Voting, so this is never null here.
	const next = nextPhase(current.phase) as ContestPhase;

	const [updated] = await getDb()
		.update(contest)
		.set({ phase: next })
		.where(eq(contest.id, current.id))
		.returning();

	return updated;
}
