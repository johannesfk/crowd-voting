import { describe, expect, it } from 'vitest';
import { INITIAL_PHASE, PHASES, nextPhase } from './phases';

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
});
