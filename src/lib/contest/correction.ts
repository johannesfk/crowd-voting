// The Correction rule: what fixing an Entry's costume and names means, as pure
// functions with no database behind them.
//
// A Participant carries a name and a position, and a Correction is a rename in place
// rather than a rewrite of the whole list: the people already named stay on the
// positions they were typed at, somebody new goes on the end, and somebody dropped
// goes from the end. That is why this is its own rule instead of "delete the rows and
// insert them again" — the operator is fixing a typo, and the fix is not allowed to
// reshuffle everybody behind it.

/**
 * Whether a Correction is worth making at all.
 *
 * An Entry is dressed up as something and contributed by at least one Participant, so
 * a Correction that leaves either of those empty is not one — it would be an Entry the
 * audience can no longer be told what it is, or one entered by nobody.
 *
 * Asked here rather than only in the route, so the rule holds for anything that writes
 * to an Entry and not merely for the one form on the operator's page.
 */
export function isCorrectionWorthMaking(costume: string, names: readonly string[]): boolean {
	return costume !== '' && names.length > 0;
}

/** One name, and the position it belongs on. */
export type NameChange = { position: number; name: string };

/** What a Correction does to the Participants of one Entry. */
export type NameCorrection = {
	/** People already on the Entry whose name has changed, at the position they held. */
	renames: NameChange[];
	/** Positions that go away, highest first. */
	removed: number[];
	/** People the Correction adds, at the end, in the order they were typed. */
	added: NameChange[];
};

/**
 * Works out the writes a corrected list of names needs.
 *
 * Both lists are one name per Participant, in the order the Entry shows them, and
 * neither is expected to hold a blank: a Correction that loses every name is refused
 * before it gets here, by the rule above.
 *
 * Positions are counted from zero and are the reason this is not a rewrite. A name
 * typed at position 2 is written to position 2, whether it is a spelling being fixed,
 * the third of five people, or the fourth person added tonight — so a Correction
 * touches only the names that actually changed.
 */
export function planNameCorrection(
	existing: readonly string[],
	corrected: readonly string[]
): NameCorrection {
	const renames: NameChange[] = [];
	const removed: number[] = [];
	const added: NameChange[] = [];

	existing.forEach((name, position) => {
		if (position < corrected.length) {
			if (corrected[position] !== name) renames.push({ position, name: corrected[position] });
		} else {
			removed.push(position);
		}
	});

	// Highest first, so a position is never renumbered by something above it going.
	removed.reverse();

	for (let position = existing.length; position < corrected.length; position++) {
		added.push({ position, name: corrected[position] });
	}

	return { renames, removed, added };
}

/**
 * The names the operator's boxes mean, in the order they were on screen.
 *
 * One box is one Participant, and unlike the registration form a name is never split:
 * the operator is fixing what is already written, not typing a group into a phone
 * keyboard, so "Rock and Roll, The Band" is one person and splitting it would invent
 * one.
 *
 * A blank box ends the list. People are only ever dropped from the end — that is what
 * keeping the positions stable means — so clearing the last box takes one person off
 * and clearing a box in the middle takes that person and everyone behind them. It also
 * means removal needs no button of its own: a form that submits whatever is typed
 * works with JavaScript not yet loaded, which is the state an operator's browser is in
 * whenever the venue wifi is busy.
 *
 * Nothing inside a name is rewritten: only the ends are trimmed, because a name that
 * already went through registration may legitimately hold an internal space, and a
 * Correction that quietly reflowed it would be changing more than it was asked to.
 *
 * An empty result is a Correction that left nobody on the Entry, which is the rule
 * above refuses rather than this one: what the boxes mean is this function's question,
 * and whether the answer is worth acting on is not.
 */
export function parseCorrectedNames(fields: readonly string[]): string[] {
	const names: string[] = [];

	for (const raw of fields) {
		const name = raw.trim();
		if (name === '') break;
		names.push(name);
	}

	return names;
}
