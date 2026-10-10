// The phase machine, the backbone of the domain: a Contest moves
// Registration → Voting → Results → Published, in that order and never backwards.
// One function owns every transition; a route or remote function never assigns a
// phase directly. The ballot, the waiting page and the standings all key off
// whichever of these is current.

export const PHASES = ['registration', 'voting', 'results', 'published'] as const;

export type ContestPhase = (typeof PHASES)[number];

/** A Contest is created in Registration. */
export const INITIAL_PHASE: ContestPhase = 'registration';

/**
 * The phase a Contest moves to from `current`, or `null` when it can move no
 * further. Every transition goes through here, so an edge that does not exist —
 * a backwards move, a jump over Voting, a second Publication — is refused
 * rather than written.
 */
export function nextPhase(current: ContestPhase): ContestPhase | null {
	const index = PHASES.indexOf(current);
	if (index < 0 || index === PHASES.length - 1) return null;
	return PHASES[index + 1];
}

/**
 * The phase names as the glossary writes them. Shared so the audience, the
 * operator and the code never spell a phase three different ways.
 */
export const PHASE_LABELS: Record<ContestPhase, string> = {
	registration: 'Registration',
	voting: 'Voting',
	results: 'Results',
	published: 'Published'
};
