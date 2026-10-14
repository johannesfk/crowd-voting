// The standings: which Entry is ahead, and by how much, once voting has been going
// for a while.
//
// A pure function, because this is the one place where a wrong answer is silent.
// Three unranked picks from a small room makes ties the normal case rather than the
// exception, and a podium that quietly numbers three tied Entries 3rd, 2nd and 1st
// invents a winner the audience did not pick. The rule that shared Entries share a
// place is therefore here, tested exhaustively, and nowhere else.

/** One Entry's result: its vote count, and the place it finished in. */
export type Standing<T> = {
	entry: T;
	/** How many Ballots contain this Entry. Every pick weighs the same. */
	votes: number;
	/**
	 * The place, counting from 1. Tied Entries share one place, and the next place
	 * after a tie skips the ones the tie consumed — two Entries on 5 votes are both
	 * 1st, so the next Entry down is 3rd, because nobody finished 2nd.
	 */
	place: number;
};

/**
 * Orders Entries by vote count and gives each its place, best first.
 *
 * The ordering is by count alone, so Entries on the same count keep the order they
 * came in with rather than being reshuffled between reads — an operator watching the
 * Board must not see two costumes swap places every time the page refreshes, because
 * that reads as a real change when nothing happened.
 *
 * An Entry nobody voted for still appears, on 0. The Board is the operator's view of
 * the contest, and an Entry with no votes is the thing they most need to see.
 */
export function rankEntries<T>(
	entries: readonly T[],
	votes: Map<string, number>,
	idOf: (entry: T) => string
): Standing<T>[] {
	const byCount = entries
		.map((entry, index) => ({ entry, index, votes: votes.get(idOf(entry)) ?? 0 }))
		.sort((left, right) => right.votes - left.votes || left.index - right.index);

	const standings: Standing<T>[] = [];

	for (const { entry, votes } of byCount) {
		// The place handed to the last Entry of a tie, so the next count starts counting
		// again from where the tie ended rather than from where the list happens to sit.
		const previous = standings[standings.length - 1];
		const place =
			previous !== undefined && previous.votes === votes ? previous.place : standings.length + 1;
		standings.push({ entry, votes, place });
	}

	return standings;
}

/**
 * Ballots that may have come from one device rather than several.
 *
 * Advisory and nothing else. A venue's guests share one access point, so a group of
 * twenty devices on one network address is the expected shape of a party, not
 * evidence of anything; this tells the operator where to look if a result seems odd,
 * and no code path may ever turn one of these into a refusal (ADR 0004).
 */
export type DuplicateGroup = {
	/** The devices seen. Never shown to anyone but the operator. */
	devices: string[];
	/** The Entries these devices all picked, which is what makes the group worth a look. */
	sharedEntries: string[];
};

/**
 * Groups devices that share *both* a network address and a browser fingerprint and
 * agreed on at least two Entries.
 *
 * Both signals are required, and the recorded fingerprint is only a user agent and a
 * language — coarse enough that half a room matches on it alone. A shared network is
 * the room; a shared user agent is everybody on the same phone. Requiring both is
 * what makes the group mean something: one person, two browsers or two tabs, in one
 * place, voting the same way. Either signal on its own is what an ordinary party
 * looks like, and a warning the operator cannot act on teaches them to ignore the
 * one warning that matters.
 *
 * Two shared Entries rather than one, because plenty of people vote for the same
 * costume and one coincidence is not a pattern.
 */
export function findDuplicateSignals(devices: readonly DuplicateDevice[]): DuplicateGroup[] {
	const byBothSignals = new Map<string, DuplicateDevice[]>();

	for (const device of devices) {
		// A device with no header sent matches nothing, and grouping "unknown" would
		// match every such request in the contest.
		if (device.networkHash === null || device.fingerprintHash === null) continue;

		const key = `${device.networkHash}|${device.fingerprintHash}`;
		byBothSignals.set(key, [...(byBothSignals.get(key) ?? []), device]);
	}

	const groups: DuplicateGroup[] = [];

	for (const sharing of byBothSignals.values()) {
		// Every device on a contest matches itself, so a group of one is not a group.
		if (sharing.length < 2) continue;

		const shared = sharing
			.map((device) => new Set(device.picks))
			.reduce((common, picks) => new Set([...common].filter((id) => picks.has(id))));
		if (shared.size < 2) continue;

		groups.push({
			devices: sharing.map((device) => device.id),
			sharedEntries: [...shared]
		});
	}

	return groups;
}

/** One device as the Duplicate signal reads it: its hashes, and what it voted for. */
export type DuplicateDevice = {
	id: string;
	networkHash: string | null;
	fingerprintHash: string | null;
	/** The Entries this device's Ballot contains. */
	picks: string[];
};
