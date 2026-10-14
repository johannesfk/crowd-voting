// Ballots and their Votes: recording one, and finding out whether this device has
// already cast one.
//
// The rules live here rather than in the route, because none of them are about
// HTTP. A Ballot is only accepted while the Contest is in Voting, only once per
// device, only with one to three picks, and only for Entries the operator left on
// the ballot and the device did not register itself. Casting is final, so nothing
// in this module amends, replaces or withdraws anything.

import { and, eq } from 'drizzle-orm';
import { MIN_VOTES, parsePicks, pickCountAllowed, tallyVotes } from '#lib/contest/ballot.js';
import { acceptsVotes } from '#lib/contest/phases.js';
import type { DuplicateDevice } from '#lib/contest/standings.js';
import { getDb } from './db/index.js';
import { ballot, device, vote } from './db/schema.js';
import { listVisibleEntries } from './entry.js';
import type { Contest } from './contest.js';

export type Ballot = typeof ballot.$inferSelect;

/**
 * SQLite's own wording for a unique-index violation. Matched on the constraint
 * marker rather than on D1's message text, which is free to reword; the fallback
 * re-reads the Ballot anyway, so this only has to be right often enough to keep the
 * common case off the slow path.
 */
const UNIQUE_CONSTRAINT = 'SQLITE_CONSTRAINT';

/** Voting is not open, so there is no ballot to cast. */
export class VotingClosed extends Error {}

/** This device has already voted in this Contest, ever. */
export class AlreadyVoted extends Error {}

/** A ballot with no picks at all is not a vote. */
export class NoPicks extends Error {}

/** A ballot may hold at most three picks, whatever the browser let somebody do. */
export class TooManyPicks extends Error {}

/** The Entry is not on this Contest's ballot: unknown, or the operator hid it. */
export class NotOnBallot extends Error {}

/** A device cannot vote for the Entry it registered itself (ADR 0004). */
export class OwnEntry extends Error {}

/**
 * What this device has already cast, so a device that has voted is recognised
 * rather than being offered the ballot a second time.
 */
export async function findBallotByDevice(
	contestId: string,
	deviceId: string
): Promise<Ballot | undefined> {
	return getDb()
		.select()
		.from(ballot)
		.where(and(eq(ballot.contestId, contestId), eq(ballot.deviceId, deviceId)))
		.get();
}

/**
 * How many Ballots a Contest has taken, and how many Ballots each Entry is in.
 *
 * The count is the whole of the ranking: every pick weighs the same, so an Entry's
 * rank is the number of Ballots containing it and there is nothing here about one
 * pick being better than another.
 */
export async function countVotes(
	contestId: string
): Promise<{ ballots: number; votes: Map<string, number> }> {
	const cast = await getDb()
		.select({ id: ballot.id })
		.from(ballot)
		.where(eq(ballot.contestId, contestId));

	if (cast.length === 0) return { ballots: 0, votes: new Map() };

	const counted = await getDb()
		.select({ entryId: vote.entryId })
		.from(vote)
		.innerJoin(ballot, eq(ballot.id, vote.ballotId))
		.where(eq(ballot.contestId, contestId));

	return { ballots: cast.length, votes: tallyVotes(counted) };
}

/**
 * Every device that has cast a Ballot in this Contest, with the advisory signals it
 * arrived with and what it picked.
 *
 * Read only to show the operator where a result looks odd. Nothing here is consulted
 * when deciding whether to accept a vote, and no code path turns a duplicate into a
 * refusal — venue guests share one access point, so a hard limit on it would reject
 * most of the room (ADR 0004).
 */
export async function listVotingDevices(contestId: string): Promise<DuplicateDevice[]> {
	const rows = await getDb()
		.select({
			deviceId: device.id,
			networkHash: device.networkHash,
			fingerprintHash: device.fingerprintHash,
			ballotId: ballot.id
		})
		.from(ballot)
		.innerJoin(device, eq(device.id, ballot.deviceId))
		.where(eq(ballot.contestId, contestId));

	if (rows.length === 0) return [];

	const picked = await getDb()
		.select({ ballotId: vote.ballotId, entryId: vote.entryId })
		.from(vote)
		.innerJoin(ballot, eq(ballot.id, vote.ballotId))
		.where(eq(ballot.contestId, contestId));

	const picksByBallot = new Map<string, string[]>();
	for (const row of picked) {
		picksByBallot.set(row.ballotId, [...(picksByBallot.get(row.ballotId) ?? []), row.entryId]);
	}

	return rows.map((row) => ({
		id: row.deviceId,
		networkHash: row.networkHash,
		fingerprintHash: row.fingerprintHash,
		picks: picksByBallot.get(row.ballotId) ?? []
	}));
}

/**
 * Records a Ballot: the device, the Contest, and one Vote per pick.
 *
 * Every check is here, in this order, so that a route cannot write past any of
 * them:
 *
 * - the Contest must be in Voting, which is what stops a guest who left the form
 *   open past the close from landing a late ballot;
 * - the device must not have voted already, because casting is final;
 * - the picks must be one to three Entries, de-duplicated, so a fourth is
 *   refused and an Entry cannot be counted twice on one ballot;
 * - every pick must be an Entry of this Contest that the operator left on the
 *   ballot and that this device did not register itself.
 *
 * The Votes are written second and the Ballot rolled back if they fail, so a
 * half-written ballot never counts as one cast.
 */
export async function castBallot(input: {
	contest: Contest;
	deviceId: string;
	picks: readonly string[];
}): Promise<{ ballot: Ballot; picks: string[] }> {
	const { contest } = input;

	if (!acceptsVotes(contest.phase)) throw new VotingClosed();
	if ((await findBallotByDevice(contest.id, input.deviceId)) !== undefined) {
		throw new AlreadyVoted();
	}

	const picks = parsePicks(input.picks);
	if (!pickCountAllowed(picks.length)) {
		if (picks.length < MIN_VOTES) throw new NoPicks();
		throw new TooManyPicks();
	}

	// Read through the one query the ballot is built from, so an Entry the operator
	// hid, an Entry belonging to another Contest, and a made-up identifier are all
	// the same mistake: it is not on this ballot.
	const votable = await listVisibleEntries(contest.id);
	const ownEntryId = votable.find((row) => row.deviceId === input.deviceId)?.id;
	const votableIds = new Set(votable.map((row) => row.id));

	for (const id of picks) {
		if (!votableIds.has(id)) throw new NotOnBallot();
		if (id === ownEntryId) throw new OwnEntry();
	}

	const db = getDb();
	const ballotId = crypto.randomUUID();

	// One batch, so the Ballot and its Votes either both land or neither does. Two
	// separate statements with a compensating delete would leave a Ballot with no
	// Votes behind if the Worker died between them, and a device with a cast Ballot
	// can never vote again — so that failure would cost somebody their vote
	// permanently, which is the worst thing this module can do.
	//
	// Drizzle types a batch as returning one result per statement, and only the
	// first statement here has a `returning()`; the second is typed as an execution
	// result and its rows are not wanted.
	let created: Ballot;
	try {
		const [rows] = await db.batch([
			db
				.insert(ballot)
				.values({ id: ballotId, contestId: contest.id, deviceId: input.deviceId })
				.returning(),
			db.insert(vote).values(picks.map((entryId) => ({ ballotId, entryId })))
		]);
		created = rows[0];
	} catch (cause) {
		// The unique index on (Contest, device) is what actually enforces one Ballot
		// per device, and it fires here: two posts from one device in the same instant
		// both pass the check above and the second loses the race. That is translated
		// into AlreadyVoted rather than a server error, because a guest who
		// double-clicks Send has voted — they have not made a mistake.
		const lostTheRace =
			(cause instanceof Error && cause.message.includes(UNIQUE_CONSTRAINT)) ||
			(await findBallotByDevice(contest.id, input.deviceId)) !== undefined;
		if (lostTheRace) throw new AlreadyVoted();
		throw cause;
	}

	return { ballot: created, picks };
}
