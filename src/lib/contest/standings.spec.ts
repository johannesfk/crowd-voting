import { describe, expect, it } from 'vitest';
import { findDuplicateSignals, rankEntries, type DuplicateDevice } from './standings';

const id = (entry: string) => entry;
const order = (standings: { entry: string; votes: number; place: number }[]) =>
	standings.map((standing) => `${standing.entry}:${standing.votes}:${standing.place}`);

describe('the standings while voting runs', () => {
	it('orders Entries by the number of Ballots containing them', () => {
		const standings = rankEntries(
			['Enigma', 'Astronaut', 'Whiz Kid'],
			new Map([
				['Enigma', 2],
				['Astronaut', 5],
				['Whiz Kid', 3]
			]),
			id
		);

		expect(order(standings)).toEqual(['Astronaut:5:1', 'Whiz Kid:3:2', 'Enigma:2:3']);
	});

	it('counts every pick as one vote, so three picks is not three times a winner', () => {
		// A is in four Ballots, B in two, C in one — four, two and one, not 3/2/1.
		const standings = rankEntries(
			['A', 'B', 'C'],
			new Map([
				['A', 4],
				['B', 2],
				['C', 1]
			]),
			id
		);

		expect(standings.map((standing) => standing.votes)).toEqual([4, 2, 1]);
	});

	it('gives tied Entries one shared place', () => {
		const standings = rankEntries(
			['A', 'B', 'C'],
			new Map([
				['A', 5],
				['B', 5],
				['C', 1]
			]),
			id
		);

		expect(order(standings)).toEqual(['A:5:1', 'B:5:1', 'C:1:3']);
	});

	it('skips the places a tie consumed, so nobody finished second', () => {
		const standings = rankEntries(
			['A', 'B', 'C', 'D'],
			new Map([
				['A', 9],
				['B', 4],
				['C', 4],
				['D', 4]
			]),
			id
		);

		expect(order(standings)).toEqual(['A:9:1', 'B:4:2', 'C:4:2', 'D:4:2']);
	});

	it('leaves everyone on zero sharing one place', () => {
		const standings = rankEntries(['A', 'B'], new Map(), id);

		expect(order(standings)).toEqual(['A:0:1', 'B:0:1']);
	});

	it('shows an Entry nobody voted for, rather than hiding it', () => {
		const standings = rankEntries(['A', 'B'], new Map([['A', 1]]), id);

		// The operator's most useful sight is a costume with no votes at all.
		expect(order(standings)).toEqual(['A:1:1', 'B:0:2']);
	});

	it('keeps tied Entries in the order they came in, so the Board does not shuffle', () => {
		const entries = ['A', 'B', 'C'];
		const votes = new Map([
			['A', 2],
			['B', 2],
			['C', 2]
		]);

		// A Board that reorders equal counts on every read reads as a change when
		// nothing has happened, which is exactly what an operator is watching for.
		for (let read = 0; read < 5; read++) {
			expect(order(rankEntries(entries, votes, id))).toEqual(['A:2:1', 'B:2:1', 'C:2:1']);
		}
	});

	it('does not sort the Entries it was given', () => {
		const entries = ['C', 'B', 'A'];
		rankEntries(
			entries,
			new Map([
				['A', 1],
				['B', 2],
				['C', 3]
			]),
			id
		);

		expect(entries).toEqual(['C', 'B', 'A']);
	});

	it('copes with an empty Contest', () => {
		expect(rankEntries([], new Map(), id)).toEqual([]);
	});
});

const device = (
	id: string,
	networkHash: string | null,
	fingerprintHash: string | null,
	picks: string[]
): DuplicateDevice => ({ id, networkHash, fingerprintHash, picks });

describe('the advisory duplicate signal', () => {
	it('reports two devices on one network and one browser that agreed on two Entries', () => {
		const groups = findDuplicateSignals([
			device('one', 'net-a', 'fp-1', ['x', 'y', 'z']),
			device('two', 'net-a', 'fp-1', ['x', 'y']),
			device('three', 'net-b', 'fp-3', ['z'])
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0].devices.sort()).toEqual(['one', 'two']);
		expect(groups[0].sharedEntries.sort()).toEqual(['x', 'y']);
	});

	it('says nothing about a room that merely shares a network', () => {
		const groups = findDuplicateSignals([
			device('one', 'net-a', 'fp-1', ['x', 'y']),
			device('two', 'net-a', 'fp-2', ['x', 'y']),
			device('three', 'net-a', 'fp-3', ['x', 'y'])
		]);

		// Every guest at a party shares the access point, so a shared network on its
		// own is the expected shape of a venue and not worth a warning.
		expect(groups).toEqual([]);
	});

	it('says nothing about two people on the same kind of phone', () => {
		const groups = findDuplicateSignals([
			device('one', 'net-a', 'same-browser', ['x', 'y']),
			device('two', 'net-b', 'same-browser', ['x', 'y'])
		]);

		// The recorded fingerprint is a user agent and a language, which half a room
		// matches on. Warning about that teaches the operator to ignore the warning.
		expect(groups).toEqual([]);
	});

	it('says nothing about two devices that only share one Entry', () => {
		const groups = findDuplicateSignals([
			device('one', 'net-a', 'fp-1', ['x', 'y']),
			device('two', 'net-a', 'fp-1', ['x', 'z'])
		]);

		// Plenty of people vote for the same costume; agreeing once proves nothing.
		expect(groups).toEqual([]);
	});

	it('ignores a device that recorded no signal at all', () => {
		const groups = findDuplicateSignals([
			device('one', null, 'fp-1', ['x', 'y']),
			device('two', null, 'fp-1', ['x', 'y'])
		]);

		// Grouping "no header sent" together would match every such request in the
		// contest and mean nothing.
		expect(groups).toEqual([]);
	});

	it('finds the Entries a whole set of look-alikes agreed on, not just pairs', () => {
		const groups = findDuplicateSignals([
			device('one', 'net-a', 'fp-1', ['x', 'y', 'z']),
			device('two', 'net-a', 'fp-1', ['x', 'y']),
			device('three', 'net-a', 'fp-1', ['x', 'y', 'w'])
		]);

		expect(groups).toHaveLength(1);
		expect(groups[0].devices).toHaveLength(3);
		expect(groups[0].sharedEntries.sort()).toEqual(['x', 'y']);
	});

	it('says nothing when every device is its own', () => {
		const groups = findDuplicateSignals([
			device('one', 'net-a', 'fp-1', ['x', 'y']),
			device('two', 'net-b', 'fp-2', ['x', 'y'])
		]);

		expect(groups).toEqual([]);
	});
});
