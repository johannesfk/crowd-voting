import { describe, expect, it } from 'vitest';
import {
	MAX_VOTES,
	MIN_VOTES,
	orderBallot,
	parsePicks,
	pickCountAllowed,
	tallyVotes
} from './ballot';

const COSTUMES = [
	'Enigma',
	'Aeronaut',
	'Whiz Kid',
	'Time travellers',
	'The computer that wore trousers',
	'Glitter',
	'Bard',
	'Mad Hatter',
	'Poisoner',
	'Astronaut'
];

/** Device seeds. The prefix matters: `other-` seeds are all different devices. */
const seeds = (prefix: string, count: number) =>
	Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

/** The seeds of `count` devices other than the one that owns `thisDevice`. */
const others = (count: number) => seeds('other-seed', count);

describe('the picks on a ballot', () => {
	it('reads the submitted fields as the Entries chosen', () => {
		expect(parsePicks(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
	});

	it('counts one, two or three picks, and refuses none and four', () => {
		expect(MIN_VOTES).toBe(1);
		expect(MAX_VOTES).toBe(3);

		expect([0, 1, 2, 3, 4].map(pickCountAllowed)).toEqual([false, true, true, true, false]);
	});

	it('counts an Entry chosen twice as one pick, so one ballot cannot inflate it', () => {
		expect(parsePicks(['a', 'a', 'b'])).toEqual(['a', 'b']);
		expect(parsePicks(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);

		// The mistake this prevents: four submitted fields, one Entry named twice,
		// would otherwise be read as four picks and refused, or as two votes for it.
		expect(parsePicks(['a', 'a', 'a', 'a'])).toEqual(['a']);
	});

	it('treats an untouched field as nobody rather than as one blank pick', () => {
		expect(parsePicks([])).toEqual([]);
		expect(parsePicks(['  ', 'a', ''])).toEqual(['a']);
	});
});

describe('the order one device sees the Entries in', () => {
	it('shows every Entry exactly once', () => {
		for (const seed of others(20)) {
			const ordered = orderBallot(COSTUMES, seed);

			expect(ordered).toHaveLength(COSTUMES.length);
			expect([...ordered].sort()).toEqual([...COSTUMES].sort());
		}
	});

	it('is the same order every time one device looks, so reloading buys nothing', () => {
		for (const seed of others(20)) {
			const first = orderBallot(COSTUMES, seed);
			expect(orderBallot(COSTUMES, seed)).toEqual(first);
			expect(orderBallot(COSTUMES, seed)).toEqual(first);
		}
	});

	it('is a different order on another device', () => {
		const mine = orderBallot(COSTUMES, 'my-seed');

		// Ten Entries: two devices agree on one order by chance about once in
		// 3,600,000, so this asserts a real difference rather than a probable one.
		for (const seed of others(25)) {
			expect(orderBallot(COSTUMES, seed)).not.toEqual(mine);
		}
	});

	it('moves Entries, rather than shuffling one and calling it random', () => {
		// Ten Entries in ten possible first positions. A shuffle that left the first
		// one where it started every time — the bias a naive swap loop has — would
		// show exactly one distinct first Entry here.
		const firstEntries = new Set(others(50).map((seed) => orderBallot(COSTUMES, seed)[0]));
		expect(firstEntries.size).toBeGreaterThan(1);

		// And at least one of those devices sees a different order from the order
		// the Entries happened to be registered in.
		const moved = others(25).some((seed) => orderBallot(COSTUMES, seed).join() !== COSTUMES.join());
		expect(moved).toBe(true);
	});

	it('copes with an empty ballot and with one Entry', () => {
		expect(orderBallot([], 'my-seed')).toEqual([]);
		expect(orderBallot(['Enigma'], 'my-seed')).toEqual(['Enigma']);
	});
});

describe('what the Votes on cast ballots add up to', () => {
	it('counts every pick once, whichever position it was picked in', () => {
		const counts = tallyVotes([
			{ entryId: 'a' },
			{ entryId: 'b' },
			{ entryId: 'c' },
			{ entryId: 'a' },
			{ entryId: 'c' },
			{ entryId: 'a' }
		]);

		// Three picks first, two second, one third: 3/2/1 would have read 6 and 5.
		expect(counts.get('a')).toBe(3);
		expect(counts.get('b')).toBe(1);
		expect(counts.get('c')).toBe(2);
	});

	it('leaves an Entry nobody picked out rather than counting it as zero', () => {
		expect(tallyVotes([{ entryId: 'a' }]).has('b')).toBe(false);
		expect(tallyVotes([])).toEqual(new Map());
	});
});
