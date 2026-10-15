import { describe, expect, it } from 'vitest';
import { confirmsDeletion } from './deletion';

describe('the operator confirming a deletion', () => {
	const TITLE = 'Halloween party 2026';

	it('is the title typed back exactly as the Contest carries it', () => {
		expect(confirmsDeletion(TITLE, TITLE)).toBe(true);
	});

	it('survives the whitespace a phone keyboard adds around a long title', () => {
		// Not leniency about what was typed — the same characters, with the stray space
		// a keyboard leaves behind, are still the title. Being refused for that would
		// teach an operator that the box is broken.
		expect(confirmsDeletion(` ${TITLE} `, TITLE)).toBe(true);
	});

	it("refuses a title that is not this Contest's", () => {
		// One character off, another contest, and the two titles differing only in case
		// — none of which is the operator confirming this deletion.
		expect(confirmsDeletion(`${TITLE}!`, TITLE)).toBe(false);
		expect(confirmsDeletion('Halloween party 2025', TITLE)).toBe(false);
		expect(confirmsDeletion(TITLE.toUpperCase(), TITLE)).toBe(false);
	});

	it('refuses an empty box, or whitespace in one', () => {
		// The button that asks for the title posts nothing; a submit with an empty
		// field must not be a confirmation by default.
		expect(confirmsDeletion('', TITLE)).toBe(false);
		expect(confirmsDeletion('   ', TITLE)).toBe(false);
	});
});
