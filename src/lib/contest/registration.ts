// What an audience member types on the registration form, turned into the domain
// names it means. A group of any size is one Entry of many Participants, so this
// is the one place that decides how many people a costume has — and a group of ten
// is treated exactly as carefully as a group of two.

/**
 * Splits typed names into Participants.
 *
 * People type a group in whatever way their phone keyboard encourages: one per
 * line or comma-separated. Both mean the same list, so both are accepted. Names
 * are never split further — "Rock and Roll" is one name, not two — because a
 * missing separator only loses a Participant while a wrong one invents one.
 * Internal whitespace is collapsed and blanks are dropped, so an empty field is
 * nobody rather than one blank Participant.
 *
 * A repeated name is kept rather than merged. Two people in a group may both be
 * called Alex, and quietly dropping one of them would be worse than showing the
 * operator a name twice.
 */
export function parseParticipants(typed: string): string[] {
	const names: string[] = [];

	for (const raw of typed.split(/[\n,]/)) {
		const name = raw.replace(/\s+/g, ' ').trim();
		if (name !== '') names.push(name);
	}

	return names;
}
