import { describe, expect, it } from 'vitest';
import { isCorrectionWorthMaking, parseCorrectedNames, planNameCorrection } from './correction';

describe('the names on an Entry, corrected', () => {
	it('fixes a misspelling without moving that person', () => {
		expect(
			planNameCorrection(['Ada Lovelace', 'Allan Turing'], ['Ada Lovelace', 'Alan Turing'])
		).toEqual({
			renames: [{ position: 1, name: 'Alan Turing' }],
			removed: [],
			added: []
		});
	});

	it('writes nothing when the names are what they already were', () => {
		const names = ['Ada Lovelace', 'Alan Turing'];

		expect(planNameCorrection(names, names)).toEqual({ renames: [], removed: [], added: [] });
	});

	it('adds a person at the end and leaves the others where they are', () => {
		expect(planNameCorrection(['Ada Lovelace'], ['Ada Lovelace', 'Grace Hopper'])).toEqual({
			renames: [],
			removed: [],
			added: [{ position: 1, name: 'Grace Hopper' }]
		});
	});

	it('takes people off the end and leaves the others where they are', () => {
		expect(
			planNameCorrection(
				['Ada Lovelace', 'Alan Turing', 'Grace Hopper'],
				['Ada Lovelace', 'Alan Turing']
			)
		).toEqual({
			renames: [],
			removed: [2],
			added: []
		});
	});

	it('counts positions from zero, so every name is on the position it was typed at', () => {
		expect(
			planNameCorrection(['Ada Lovelace', 'Alan Turing'], ['Grace Hopper', 'Ada Lovelace'])
		).toEqual({
			renames: [
				{ position: 0, name: 'Grace Hopper' },
				{ position: 1, name: 'Ada Lovelace' }
			],
			removed: [],
			added: []
		});
	});

	it('corrects a name and grows the Entry in one go', () => {
		expect(
			planNameCorrection(
				['Ada Lovelace', 'Allan Turing', 'Grace Hopper'],
				['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katherine Johnson']
			)
		).toEqual({
			renames: [{ position: 1, name: 'Alan Turing' }],
			removed: [],
			added: [{ position: 3, name: 'Katherine Johnson' }]
		});
	});
});

describe('whether a Correction is worth making', () => {
	it('is refused when it would leave nobody on the Entry', () => {
		expect(isCorrectionWorthMaking('', [])).toBe(false);
		expect(isCorrectionWorthMaking('Time travellers', [])).toBe(false);
		expect(isCorrectionWorthMaking('', ['Ada Lovelace'])).toBe(false);
	});

	it('is worth making when the Entry still has a costume and a person', () => {
		expect(isCorrectionWorthMaking('Time travellers', ['Ada Lovelace'])).toBe(true);
	});
});

describe('the boxes the operator is correcting', () => {
	it('reads one box as one Participant', () => {
		expect(parseCorrectedNames(['Ada Lovelace', 'Alan Turing'])).toEqual([
			'Ada Lovelace',
			'Alan Turing'
		]);
	});

	it('keeps a name as it is, commas and all', () => {
		expect(parseCorrectedNames(['Rock and Roll, The Band'])).toEqual(['Rock and Roll, The Band']);
	});

	it('trims the edges a keyboard leaves behind and leaves the name inside alone', () => {
		expect(parseCorrectedNames(['  Ada   Lovelace  '])).toEqual(['Ada   Lovelace']);
	});

	it('ends the list at a box left blank', () => {
		expect(parseCorrectedNames(['Ada Lovelace', '', 'Grace Hopper'])).toEqual(['Ada Lovelace']);
	});

	it('reads a blank box as nobody left rather than as an error', () => {
		expect(parseCorrectedNames(['', 'Ada Lovelace'])).toEqual([]);
		expect(parseCorrectedNames([])).toEqual([]);
	});
});
