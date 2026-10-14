// The Ballot as the audience fills it in: how many picks it may hold, which of
// them count, the order one device sees the Entries in, and what a set of Votes
// adds up to.
//
// Pure functions with no request, no database and no random identifiers, because
// both mistakes here are silent. A ballot that quietly accepted a fourth pick
// would show nobody an error, and an order that changed on reload would be a
// reload button for a position nobody could otherwise win.

/** A ballot may hold one pick, two, or three. Never none, never four. */
export const MIN_VOTES = 1;
export const MAX_VOTES = 3;

/**
 * The Entries one device may choose from, trimmed and de-duplicated, in the order
 * the browser submitted them.
 *
 * De-duplication is the point. A replayed or hand-edited post can name the same
 * Entry twice, and two rows for one Entry would count as two Votes — which is the
 * audience inflating a costume with a single ballot. Repeats are therefore
 * dropped here rather than refused, so a browser that resends a field it did not
 * mean to is not punished for it; the vote table's composite primary key is what
 * makes it impossible afterwards.
 */
export function parsePicks(values: readonly string[]): string[] {
	const picks: string[] = [];
	for (const value of values) {
		const id = value.trim();
		if (id !== '' && !picks.includes(id)) picks.push(id);
	}
	return picks;
}

/** Whether a ballot's own picks count is one the rules allow. */
export function pickCountAllowed(count: number): boolean {
	return count >= MIN_VOTES && count <= MAX_VOTES;
}

/**
 * A seed hashed to a number: FNV-1a, which is short, has no dependencies and is
 * the same on every run. The input is a device's own stored seed rather than
 * anything about the contest, so one phone's order says nothing about another's.
 */
function seedToNumber(seed: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < seed.length; index++) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Mulberry32: a few lines of generator seeded by the device's own seed. */
function numbersFrom(seed: string): () => number {
	let state = seedToNumber(seed);
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let scrambled = Math.imul(state ^ (state >>> 15), 1 | state);
		scrambled = (scrambled + Math.imul(scrambled ^ (scrambled >>> 7), 61 | scrambled)) ^ scrambled;
		return ((scrambled ^ (scrambled >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * The Entries in the order this device sees them: shuffled from a seed fixed on
 * its first visit, derived on the server and never in the browser.
 *
 * The same seed always yields the same order — that is what stops a guest
 * reloading until their favourite lands at the top — and different seeds yield
 * different orders, so position is nobody's advantage. Fisher-Yates, because a
 * naive swap shuffle leaves the last Entry biased towards the end and the bias
 * would be invisible from the ballot itself.
 */
export function orderBallot<T>(entries: readonly T[], seed: string): T[] {
	const shuffled = [...entries];
	const next = numbersFrom(seed);

	for (let index = shuffled.length - 1; index > 0; index--) {
		const target = Math.floor(next() * (index + 1));
		[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
	}

	return shuffled;
}

/**
 * How many Ballots each Entry is in. Every Vote weighs the same, so this is the
 * count of Ballots containing the Entry and nothing else: three unranked picks
 * is not 3/2/1, and the order a person picked them in means nothing.
 *
 * Where an Entry lands on the resulting standings — including Entries sharing a
 * place on a tie — is the ranking rule, which arrives with the standings.
 */
export function tallyVotes(votes: readonly { entryId: string }[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const vote of votes) {
		counts.set(vote.entryId, (counts.get(vote.entryId) ?? 0) + 1);
	}
	return counts;
}
