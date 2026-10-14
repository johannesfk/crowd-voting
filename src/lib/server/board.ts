// The Board's one read: vote counts, the standings ranked by them, and the advisory
// duplicate signals.
//
// A plain server module rather than a remote one, because the live query that wraps
// it has to live in a `.remote.ts` file and those may export nothing else. Keeping
// the read here also means the page's server load can render the first value itself,
// so a request with no JavaScript still gets a complete Board.

import { findDuplicateSignals, rankEntries, type DuplicateGroup } from '#lib/contest/standings.js';
import { countVotes, listVotingDevices } from './ballot.js';
import { listVisibleEntries } from './entry.js';

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
 * The Board as it stands.
 *
 * Entries are ranked through the same pure rule the Podium will use, so the number
 * the operator watches during the party and the one they present afterwards cannot
 * disagree. A Hidden Entry is absent, because it has no votes — it was hidden before
 * voting opened — and because the audience could not choose it.
 */
export async function readBoard(contestId: string): Promise<Board> {
	const entries = await listVisibleEntries(contestId);
	const { ballots, votes } = await countVotes(contestId);

	return {
		ballots,
		standings: rankEntries(entries, votes, (entry) => entry.id).map(({ entry, votes, place }) => ({
			entryId: entry.id,
			costume: entry.costume,
			names: entry.names,
			votes,
			place
		})),
		duplicates: findDuplicateSignals(await listVotingDevices(contestId))
	};
}
