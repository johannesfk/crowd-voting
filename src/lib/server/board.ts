// The standings as everything else reads them: the Board's live view, the published
// page, and the Podium.
//
// One module, one ranking, three shapes. That is the point: a read that reshaped the
// standings on its own — picking different fields, or ranking a second time — is how the
// number the operator watched arrive and the number they present quietly stop being the
// same number. So the ranking and the projection live here, and each caller takes the
// fields it is allowed to show.
//
// The shapes are kept apart as much as they are shared. `readBoard` carries the ballot
// count and the advisory Duplicate signal; `readPublicStandings` carries neither, so
// neither can reach the room by being one field away from something the audience does
// see; and `readPodium` carries frames rather than rows, because the reveal is driven by
// places rather than by a list.

import { findDuplicateSignals, rankEntries, type DuplicateGroup } from '#lib/contest/standings.js';
import { buildPodium, type PodiumFrame } from '#lib/contest/podium.js';
import { countVotes, listVotingDevices } from './ballot.js';
import { listVisibleEntries, type EntryWithNames } from './entry.js';

/** One Entry's result: enough to name it, place it and count it. Nothing more. */
export type BoardStanding = {
	entryId: string;
	costume: string;
	names: string[];
	votes: number;
	place: number;
};

export type Board = {
	/** Every Entry the operator left on the ballot, best first. */
	standings: BoardStanding[];
	/** How many Ballots have been cast. Not how many people: one device, one Ballot. */
	ballots: number;
	/** Advisory only. Never a reason to refuse anything. */
	duplicates: DuplicateGroup[];
};

/**
 * The ranked Entries, projected once.
 *
 * Every read ends here, so the Board's order, the published order and the reveal's order
 * cannot drift from one another.
 */
function project(entries: EntryWithNames[], votes: Map<string, number>): BoardStanding[] {
	return rankEntries(entries, votes, (entry) => entry.id).map(({ entry, votes, place }) => ({
		entryId: entry.id,
		costume: entry.costume,
		names: entry.names,
		votes,
		place
	}));
}

/**
 * The Board as it stands: the standings, how many Ballots there are, and the advisory
 * duplicate signals.
 *
 * A Hidden Entry is absent, because it has no votes — it was hidden before voting opened
 * — and because the audience could not choose it.
 */
export async function readBoard(contestId: string): Promise<Board> {
	// Counted once, not twice: the ballot total and the vote counts are read together, so
	// a Ballot arriving mid-read cannot make the Board claim a total it has no counts for.
	const [{ ballots, votes }, entries, devices] = await Promise.all([
		countVotes(contestId),
		listVisibleEntries(contestId),
		listVotingDevices(contestId)
	]);

	return {
		ballots,
		standings: project(entries, votes),
		duplicates: findDuplicateSignals(devices)
	};
}

/**
 * The standings as the audience sees them.
 *
 * No ballot count and no Duplicate signal, because both are the operator's alone, and
 * choosing fields out of the Board's shape is how a duplicate warning ends up in front
 * of the room a few releases later.
 *
 * The caller must check `showsStandings` first. This function does not, because a
 * Contest's phase is not its to trust — it is the caller's whole reason for calling.
 */
export async function readPublicStandings(contestId: string): Promise<BoardStanding[]> {
	const [{ votes }, entries] = await Promise.all([
		countVotes(contestId),
		listVisibleEntries(contestId)
	]);

	return project(entries, votes);
}

/**
 * The reveal: one frame per place, worst place first, each carrying everything on the
 * Podium so far.
 *
 * The same ranking, through the same projection as the Board's, so the reveal cannot
 * show a different order from the one the operator watched arrive. The frame order is
 * the pure rule's, not this function's.
 */
export async function readPodium(contestId: string): Promise<PodiumFrame[]> {
	return buildPodium(await readPublicStandings(contestId));
}
