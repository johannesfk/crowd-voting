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
 * Whether a Contest has been scored at all — voting open and counting, or results
 * frozen and final. Before Registration has been closed there is nothing to count.
 *
 * The Board stays worth showing after voting closes, because the operator is the one
 * who publishes and presents the result; what stops is the live connection, not the
 * numbers.
 */
export function hasBeenScored(phase: ContestPhase): boolean {
	return acceptsVotes(phase) || phase === 'results';
}

/**
 * Whether an audience member is waiting to be told the result.
 *
 * Results only, and that is a narrower question than "has been scored" on purpose.
 * During voting the same link is serving a ballot, and subscribing the waiting query
 * there would put a never-ending connection on every guest's screen at the exact
 * moment the room is busiest — the fan-out ADR 0001 says not to build, arrived at by
 * accident. A Contest in Results is the one phase where a guest has nothing else to
 * do but find out.
 */
export function isWaiting(phase: ContestPhase): boolean {
	return phase === 'results';
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
 * Whether the standings are public. Publication is the one thing in this machine
 * that exposes the result to the audience, and it is deliberate and separate from
 * closing voting: Results means final but private, so an audience member arriving
 * there waits rather than being shown a result nobody has chosen to reveal.
 *
 * Asked from two places that must not spell the phase themselves: the waiting page,
 * which shows the standings only once this is true, and the public standings read.
 */
export function showsStandings(phase: ContestPhase): boolean {
	return phase === 'published';
}

/**
 * Whether the operator may present the Podium for a Contest in this phase.
 *
 * Results and Published only. The gap between closing voting and publishing is exactly
 * where the result is presented, so Results has to allow it — and Published still does,
 * because a party that wants to replay the reveal an hour later should not have to fake
 * a phase to get there. Voting does not: the counts are still moving, and a reveal on a
 * projector in front of the room cannot be taken back.
 *
 * Asked from two places that must not spell the phase themselves: the admin page, which
 * offers the Presentation, and the Presentation route, which refuses to serve one.
 */
export function canPresent(phase: ContestPhase): boolean {
	return phase === 'results' || phase === 'published';
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
