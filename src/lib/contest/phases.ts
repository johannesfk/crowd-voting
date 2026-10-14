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
 * Whether a Contest in this phase still takes Entries — and whether the operator
 * may still hide one. Both answers are the same edge of the phase machine, and
 * both are asked from places that must not spell the phase themselves: the
 * registration action, the entry module's two guards, and the entry list's
 * disabled button.
 */
export function acceptsEntries(phase: ContestPhase): boolean {
	return phase === INITIAL_PHASE;
}

/**
 * Whether a Contest in this phase takes a Ballot. Voting is the one edge of the
 * machine that answers it, and the question is asked from two places that must
 * not spell the phase themselves: the page that serves the ballot, and the
 * module that records one.
 */
export function acceptsVotes(phase: ContestPhase): boolean {
	return phase === 'voting';
}

/**
 * Whether an Entry's photograph may be shown to the audience. Photographs of
 * guests are a surprise until the ballot opens (story 86), so they are served
 * from Voting onwards and never during Registration — which is the same edge the
 * entries themselves are frozen at.
 */
export function showsPhotos(phase: ContestPhase): boolean {
	return !acceptsEntries(phase);
}

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
