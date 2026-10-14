import { describe, expect, it } from 'vitest';
import {
	INITIAL_PHASE,
	PHASES,
	acceptsEntries,
	acceptsVotes,
	nextPhase,
	isWaiting,
	showsPhotos,
	showsStandings
} from './phases';

describe('the phase machine', () => {
	it('creates a Contest in Registration', () => {
		expect(INITIAL_PHASE).toBe('registration');
	});

	it('moves each phase to exactly the next one, and Published moves nowhere', () => {
		expect(PHASES.map((phase) => nextPhase(phase))).toEqual([
			'voting',
			'results',
			'published',
			null
		]);
	});

	it('refuses every edge except the one to the immediate next phase', () => {
		for (const [index, from] of PHASES.entries()) {
			const successor = PHASES[index + 1] ?? null;
			for (const to of PHASES) {
				// The only legal move from `from` is its successor, so any other
				// target — backwards, sideways, or skipping ahead — must be refused.
				expect(nextPhase(from) === to).toBe(to === successor);
			}
		}
	});

	it('leaves a Contest in Published with nowhere to go', () => {
		expect(nextPhase('published')).toBe(null);
	});

	it('takes Entries, and lets the operator hide one, only during Registration', () => {
		expect(PHASES.filter(acceptsEntries)).toEqual(['registration']);
	});

	it('takes a Ballot only during Voting, so a late or early one cannot land', () => {
		expect(PHASES.filter(acceptsVotes)).toEqual(['voting']);
	});

	it('shows photographs to the audience from Voting onwards, never during Registration', () => {
		expect(PHASES.filter(showsPhotos)).toEqual(['voting', 'results', 'published']);
	});

	it('shows the standings publicly only once the operator has published them', () => {
		// Results is final but private, so an audience member waits there rather than
		// being shown a result nobody has chosen to reveal.
		expect(PHASES.filter(showsStandings)).toEqual(['published']);
	});

	it('makes a guest wait only once voting has closed, never during it', () => {
		// The ballot page must not subscribe to the waiting query, or every guest in the
		// room holds a never-ending connection while the room is busiest.
		expect(PHASES.filter(isWaiting)).toEqual(['results']);
	});
});
