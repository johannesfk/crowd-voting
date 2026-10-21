// The Contest data layer: reading and writing Contests, and nothing else. Routes
// and remote functions call these and stay thin; the rules a Contest obeys — the
// phases in `#lib/contest/phases.js` — live in the domain modules.

import { and, eq } from 'drizzle-orm';
import { acceptsEntries, acceptsVotes, nextPhase, type ContestPhase } from '#lib/contest/phases.js';
import { getDb } from './db/index.js';
import { contest } from './db/schema.js';
import { deleteContestPhotos } from './photos.js';

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
	return getDb().query.contest.findMany({
		orderBy: (table, { desc }) => [desc(table.createdAt)]
	});
}

/** One Contest by its unguessable identifier, or `undefined` if there is none. */
export async function getContest(id: string): Promise<Contest | undefined> {
	return getDb().query.contest.findFirst({ where: { id } });
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

/** Voting is not open, so there is nothing to close. */
export class VotingNotOpen extends Error {}

/** The standings are not final yet, so there is nothing to publish. */
export class NothingToPublish extends Error {}

/**
 * Writes one phase edge, and only if the Contest is still where the caller read it.
 *
 * The phase being left is part of the `where`, so two requests that both read a Contest
 * in Results cannot both publish it: the second matches no row and is refused rather
 * than re-stamping `publishedAt` on a Contest that is already public. `nextPhase` still
 * decides which phase comes next — this only makes writing it safe.
 *
 * Returns `undefined` when the row had already moved on, which every caller turns into
 * the same refusal its own precondition would have given.
 */
async function advance(
	current: Contest,
	next: ContestPhase,
	extra: { publishedAt?: Date } = {}
): Promise<Contest | undefined> {
	const [updated] = await getDb()
		.update(contest)
		.set({ phase: next, ...extra })
		.where(and(eq(contest.id, current.id), eq(contest.phase, current.phase)))
		.returning();

	return updated;
}

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
	const updated = await advance(current, next);
	// Refused when the Contest left Registration between the check above and the write,
	// which from the operator's side is the same fact: voting is already open.
	if (updated === undefined) throw new VotingAlreadyOpen();

	return updated;
}

/**
 * Closes voting and freezes the result, in one deliberate act.
 *
 * Results means "final but private": the standings stop moving and nobody but the
 * operator can see them, which is a separate decision from publishing. Nothing here
 * publishes anything, and there is no way back — the machine does not run backwards,
 * so closing is not undoable and the operator is told so before doing it.
 *
 * Named and guarded for the same reason `openVoting` is: the edge that ends voting is
 * the one the result depends on, and it must be taken on purpose rather than as a
 * side effect of something else moving a phase along.
 */
export async function closeVoting(current: Contest): Promise<Contest> {
	if (!acceptsVotes(current.phase)) throw new VotingNotOpen();

	const updated = await advance(current, nextPhase(current.phase) as ContestPhase);
	if (updated === undefined) throw new VotingNotOpen();

	return updated;
}

/**
 * Makes the standings public, in one deliberate act, and stamps the moment.
 *
 * Separate from closing voting because they are two different decisions and the gap
 * between them is the point: Results is final but private, so the operator gets to
 * decide *when* the room finds out, rather than the room finding out the moment they
 * stop the voting. That gap is where the Podium is presented.
 *
 * Irreversible by the machine's own rule — there is no edge back from Published, so
 * there is no `unpublish`, and refusing a second publication rather than silently
 * re-stamping the first is what makes that obvious to whoever tries. A second
 * publication refuses because the phase it was leaving is no longer there.
 */
export async function publishResults(current: Contest): Promise<Contest> {
	// Publication is only ever out of Results. Not out of Voting, because the result
	// would still be moving; not out of Registration, because there is no result. The
	// machine has no edge back from Published, so there is no `unpublish` either.
	if (current.phase !== 'results') throw new NothingToPublish();

	// Through the machine, like every other edge: the phase name is `nextPhase`'s to
	// spell, not this module's.
	const updated = await advance(current, nextPhase(current.phase) as ContestPhase, {
		publishedAt: new Date()
	});
	if (updated === undefined) throw new NothingToPublish();

	return updated;
}

/**
 * Removes a Contest and everything it owns: entries, participants, ballots, votes
 * and every photograph of its guests. Hard, in any phase, with no soft-delete
 * staging area to come back from (ADR 0002).
 *
 * Photographs first, and that order is the whole of the retry story. Rows are what a
 * second run needs in order to find the Contest and enumerate what it still owns; a
 * run that took the rows first and then failed would leave photographs of real
 * people in storage with nothing anywhere pointing at them and no link to resume
 * from. In this order an interrupted deletion leaves the Contest standing, so
 * running the deletion again finishes it: R2 does not mind deleting a key twice, and
 * a row delete that matches nothing is not an error either.
 *
 * Refusing a phase here would buy nothing. Deletion is not a step on the machine —
 * the Contest leaves by not existing — so a Contest abandoned halfway through
 * Registration is as finished as one that was Published, and asking the operator to
 * run it through voting first would be asking them to invite a room to a party they
 * have cancelled.
 */
export async function deleteContest(current: Contest): Promise<void> {
	await deleteContestPhotos(current.id);
	// The schema cascades from here: entries take their participants and votes, the
	// Contest takes its devices, entries and ballots, and the ballots take their
	// votes. One statement, so a failure leaves the whole Contest or none of it.
	await getDb().delete(contest).where(eq(contest.id, current.id));
}

/**
 * Sets the background the Podium presents on for this Contest: an opaque colour, or
 * `null` for transparent.
 *
 * Writable in any phase, which is the one deliberate exception to this module's habit of
 * refusing anything once the machine has moved. Setting a background is presentation
 * setup rather than a step on the result: an operator who picks the wrong colour at
 * seven in the evening must be able to change it at half past, and refusing that would
 * mean a Contest could not be presented at all.
 */
export async function setPresentationBackground(
	current: Contest,
	background: string | null
): Promise<Contest> {
	const [updated] = await getDb()
		.update(contest)
		.set({ presentationBackground: background })
		.where(eq(contest.id, current.id))
		.returning();

	return updated;
}
