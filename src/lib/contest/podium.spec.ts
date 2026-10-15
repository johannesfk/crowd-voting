import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PODIUM_BACKGROUND,
	PODIUM_COLOURS,
	buildPodium,
	placeHeadline,
	placeLabel,
	podiumBackground,
	votesLabel,
	type PodiumEntry
} from './podium';

/** One Entry as the standings hand it over: a place, and the costume behind it. */
const entry = (costume: string, votes: number, place: number): PodiumEntry => ({
	entryId: costume,
	costume,
	names: [`Someone in ${costume}`],
	votes,
	place
});

/** The frames as the room reads them: "3rd:Enigma", one line per frame. */
const reveal = (frames: { place: number | null; onPodium: PodiumEntry[] }[]) =>
	frames.map((frame) => `${frame.place}:${frame.onPodium.map((each) => each.costume).join('+')}`);

/** Only the Entries a frame adds, which is what one keypress puts on screen. */
const revealed = (frames: { revealed: PodiumEntry[] }[]) =>
	frames.map((frame) => frame.revealed.map((each) => each.costume).join('+'));

describe('the reveal', () => {
	it('shows the top of the standings as third place first, then second, then first', () => {
		const frames = buildPodium([
			entry('Enigma', 7, 1),
			entry('Astronaut', 4, 2),
			entry('Whiz Kid', 2, 3)
		]);

		expect(frames.map((frame) => frame.place)).toEqual([3, 2, 1]);
		expect(revealed(frames)).toEqual(['Whiz Kid', 'Astronaut', 'Enigma']);
	});

	it('keeps everything already revealed on screen, so the podium builds up', () => {
		const frames = buildPodium([
			entry('Enigma', 7, 1),
			entry('Astronaut', 4, 2),
			entry('Whiz Kid', 2, 3)
		]);

		// The first place is on the last frame only: nothing above the place being
		// revealed has been shown yet, or the reveal would give the winner away first.
		expect(reveal(frames)).toEqual([
			'3:Whiz Kid',
			'2:Astronaut+Whiz Kid',
			'1:Enigma+Astronaut+Whiz Kid'
		]);
	});

	it('never invents a winner when two Entries tie for first', () => {
		const frames = buildPodium([
			entry('Enigma', 5, 1),
			entry('Whiz Kid', 5, 1),
			entry('Astronaut', 1, 3)
		]);

		// Nobody finished second, so there is no second place to announce, and the two
		// tied Entries come out together in one frame rather than as a winner and a
		// runner-up. A small room makes ties the normal case, not the exception.
		expect(frames.map((frame) => frame.place)).toEqual([3, 1]);
		expect(revealed(frames)).toEqual(['Astronaut', 'Enigma+Whiz Kid']);
		expect(placeLabel(1)).toBe('1st');
	});

	it('shows every Entry sharing a place, however many there are', () => {
		const frames = buildPodium([
			entry('A', 3, 1),
			entry('B', 3, 1),
			entry('C', 3, 1),
			entry('D', 1, 4)
		]);

		expect(frames).toHaveLength(1);
		expect(frames[0].revealed.map((each) => each.costume)).toEqual(['A', 'B', 'C']);
	});

	it('leaves off the places below the podium', () => {
		const frames = buildPodium([
			entry('A', 9, 1),
			entry('B', 4, 2),
			entry('C', 2, 3),
			entry('D', 1, 4),
			entry('E', 1, 5)
		]);

		expect(frames.map((frame) => frame.place)).toEqual([3, 2, 1]);
		expect(reveal(frames).join(' ')).not.toContain('D');
		expect(reveal(frames).join(' ')).not.toContain('E');
	});

	it('shows the places that exist when there are fewer than three Entries', () => {
		expect(buildPodium([entry('A', 2, 1), entry('B', 1, 2)]).map((frame) => frame.place)).toEqual([
			2, 1
		]);
		expect(buildPodium([entry('A', 1, 1)]).map((frame) => frame.place)).toEqual([1]);
	});

	it('has nothing to reveal for a Contest with nothing on the ballot', () => {
		expect(buildPodium([])).toEqual([]);
	});
});

describe('what the room is told', () => {
	it('names the place being revealed', () => {
		expect(placeHeadline(3, 1)).toBe('Third place');
		expect(placeHeadline(2, 1)).toBe('Second place');
		expect(placeHeadline(1, 1)).toBe('First place');
	});

	it('says a place is shared rather than awarding it to one of them', () => {
		expect(placeHeadline(1, 2)).toBe('First place, shared');
		expect(placeLabel(1)).toBe('1st');
	});

	it('reads a place as an ordinal', () => {
		expect(placeLabel(1)).toBe('1st');
		expect(placeLabel(2)).toBe('2nd');
		expect(placeLabel(3)).toBe('3rd');
		expect(placeLabel(4)).toBe('4th');
		expect(placeLabel(11)).toBe('11th');
	});
});

describe('the Podium background', () => {
	it('is an opaque colour until the operator asks otherwise', () => {
		// A Contest created and never configured still has to present on a projector, so
		// no colour can leave the Podium transparent — transparency is only ever asked
		// for, never fallen into.
		expect(DEFAULT_PODIUM_BACKGROUND).toMatch(/^#[0-9a-f]{6}$/);
		for (const colour of ['', '#fff', 'not a colour', 'transparent']) {
			expect(podiumBackground(false, colour)).not.toBe(null);
		}
	});

	it('keeps the colour the operator picked', () => {
		expect(podiumBackground(false, '#8B1E3F')).toBe('#8b1e3f');
	});

	it('falls back to the default for anything that is not a colour', () => {
		// The colour goes into a style attribute, so a posted value that is not a colour
		// is not rendered as one — it is a CSS injection, and a colour picker never
		// produces one in the first place.
		expect(podiumBackground(false, 'red; background-image: url(https://elsewhere.test/x)')).toBe(
			DEFAULT_PODIUM_BACKGROUND
		);
		expect(podiumBackground(false, '#fff')).toBe(DEFAULT_PODIUM_BACKGROUND);
		expect(podiumBackground(false, '')).toBe(DEFAULT_PODIUM_BACKGROUND);
	});

	it('is transparent when the operator asks for it, whatever colour is showing', () => {
		expect(podiumBackground(true, '#8b1e3f')).toBe(null);
	});
});

const alphaOf = (colour: string) => Number(/,\s*([\d.]+)\s*\)$/.exec(colour)?.[1] ?? '0');

describe('the Podium panel', () => {
	it('is opaque enough to read white text over any video', () => {
		// Every backing the room looks at has to survive whatever OBS is playing behind
		// it, so the two renderers share one value rather than each choosing one.
		expect(alphaOf(PODIUM_COLOURS.panel)).toBeGreaterThan(0.8);
	});
});

describe('a vote count', () => {
	it('reads as one vote or as several', () => {
		expect(votesLabel(1)).toBe('1 vote');
		expect(votesLabel(0)).toBe('0 votes');
		expect(votesLabel(7)).toBe('7 votes');
	});
});
