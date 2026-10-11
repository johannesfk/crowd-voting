// The Contest data layer: reading and writing Contests, and nothing else. Routes
// and remote functions call these and stay thin; the rules a Contest obeys — the
// phases in `#lib/contest/phases.js` — live in the domain modules.

import { desc, eq } from 'drizzle-orm';
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
