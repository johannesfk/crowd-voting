// The Podium: which Entry is revealed on which frame, and what the room is told.
//
// A pure function, because this is where a wrong answer is shown to a whole room at
// once and cannot be walked back. Three unranked picks in a small space makes ties the
// normal case, so a reveal that assumes exactly one Entry per place quietly invents a
// winner the audience never picked — and does it on a projector, in front of the people
// it invents them for. The places, the sharing and the order all come from the
// standings' own `place`, so the Podium cannot disagree with the Board.
//
// The one thing this does not decide is the title frame the operator starts from: that
// is the Contest's title rather than a fact about places, so the page owns it.

/** How many places a Podium has. The Podium is the top of the standings, not all of it. */
export const PODIUM_DEPTH = 3;

/**
 * The background a Contest presents on until the operator picks another: a near-black,
 * because that is what a projector in a dark room can actually show, and because it is
 * the one value every Contest in every deployment already agrees on.
 */
export const DEFAULT_PODIUM_BACKGROUND = '#101014';

/**
 * The Podium's geometry, in cqw — hundredths of the Podium's own width.
 *
 * One set of numbers for two renderers. The live view lays out in these directly (as
 * `cqw`, which makes the Podium the same size on a projector as on a laptop), and the
 * exported image draws them into a fixed-width canvas by multiplying by a twentieth of
 * that width. Sharing the numbers is the whole reason an exported image composites the
 * same way the live page does rather than merely resembling it.
 */
export const PODIUM_LAYOUT = {
	/** Clear space around everything, so the reveal never touches the screen edge. */
	padding: 3.5,
	/** Between two cards, and between the title, the headline and the cards. */
	gap: 2,
	/** Corner rounding on the title, the headline and every card. */
	radius: 1.25,
	/** …and on the place badge, which is a smaller shape inside a card. */
	badgeRadius: 0.6,
	/** The Contest's own title, on the frame before the reveal. */
	titleSize: 3.4,
	/** `First place, shared` — the largest thing on screen while the room looks. */
	headlineSize: 6.5,
	/** The place badge in the corner of a card. */
	placeSize: 2.8,
	costumeSize: 2.6,
	namesSize: 1.9,
	votesSize: 2,
	/** The photograph's height as a share of a card's width, before the cap below. */
	photoShare: 0.72,
	/** …and never taller than this, so a lone card does not push the text off screen. */
	photoCap: 20
} as const;

/**
 * The width of one card when `count` of them share the Podium, in cqw.
 *
 * Variable on purpose: the number of cards follows the standings, so a two-way tie for
 * first puts two cards on the final frame and a clean win puts one. Cards are laid out
 * from this and nothing else, in both renderers.
 */
export function podiumCardWidth(count: number): number {
	const usable = 100 - PODIUM_LAYOUT.padding * 2 - PODIUM_LAYOUT.gap * Math.max(count - 1, 0);
	return usable / Math.max(count, 1);
}

/** The photograph's height inside a card of this width, in cqw. */
export function podiumPhotoHeight(cardWidth: number): number {
	return Math.min(cardWidth * PODIUM_LAYOUT.photoShare, PODIUM_LAYOUT.photoCap);
}

/**
 * The Podium's colours, shared by the live view and the exported image.
 *
 * The reason they live here rather than in a stylesheet is the one guarantee the export
 * makes: what the operator composites over video must be the same backing the projector
 * showed them. A panel at 85% black in the DOM and the same panel at 88% in the canvas is
 * the kind of drift nobody notices until a video is behind it.
 */
export const PODIUM_COLOURS = {
	/** Behind the title, the headline and every card: opaque enough for white text over any video. */
	panel: 'rgba(9, 9, 12, 0.85)',
	/** The place badge, which sits on a card and so needs to read as lighter than it. */
	badge: 'rgba(255, 255, 255, 0.15)',
	text: '#f8f8fa',
	muted: 'rgba(248, 248, 250, 0.7)'
} as const;

/** How a vote count is written on a card. One rule, so both renderers say it the same way. */
export function votesLabel(votes: number): string {
	return votes === 1 ? '1 vote' : `${votes} votes`;
}

/**
 * The background as the Podium will render it: an opaque colour, or `null` for fully
 * transparent so the reveal composites over video.
 *
 * The colour is checked against the one shape a colour picker produces rather than
 * handed straight to a style attribute. Nothing legitimate is lost by that — `<input
 * type="color">` cannot return anything else — and it keeps a posted value from being
 * read as more CSS than a background.
 */
export function podiumBackground(transparent: boolean, colour: string): string | null {
	if (transparent) return null;
	return /^#[0-9a-f]{6}$/i.test(colour) ? colour.toLowerCase() : DEFAULT_PODIUM_BACKGROUND;
}

/** What the Podium needs to know about an Entry: enough to name it and place it. */
export type PodiumEntry = {
	entryId: string;
	costume: string;
	names: string[];
	votes: number;
	/** From the standings. Tied Entries share one, and a tie may skip the places below. */
	place: number;
};

/** One keypress of the reveal: what it puts on screen, and what is already there. */
export type PodiumFrame = {
	/** Position in the reveal, counting from 1. The page's own start frame is 0. */
	index: number;
	/** The place this frame reveals. */
	place: number;
	/** What the operator says over it. */
	headline: string;
	/** The Entries this frame adds — one, or several when they share the place. */
	revealed: PodiumEntry[];
	/** Everything on the Podium so far, best place first, so the podium builds up. */
	onPodium: PodiumEntry[];
};

/**
 * The reveal, in the order the operator will walk it: the worst place on the Podium
 * first, then the one above it, and first place last.
 *
 * Read straight off the standings' `place`, which is why a tie needs no special case
 * here at all: two Entries on place 1 arrive as two Entries on place 1, so they are
 * revealed together and neither is put ahead of the other. A place nobody finished —
 * what a tie at the top leaves behind — is simply absent, because no Entry claims it.
 *
 * Entries below the Podium are left off rather than ranked: the room is being shown the
 * top of the standings, and a fourth place announced on a projector would be a claim
 * about a contest nobody asked to see that far.
 */
export function buildPodium(standings: readonly PodiumEntry[]): PodiumFrame[] {
	// Best place first, and within a place the order the standings handed over, which
	// is stable — two Entries on the same count must not swap between frames.
	const byPlace = new Map<number, PodiumEntry[]>();
	for (const each of standings) {
		if (each.place < 1 || each.place > PODIUM_DEPTH) continue;
		byPlace.set(each.place, [...(byPlace.get(each.place) ?? []), each]);
	}

	const places = [...byPlace.keys()].sort((left, right) => left - right);

	return places
		.slice()
		.reverse()
		.map((place, position) => {
			const revealed = byPlace.get(place) ?? [];
			// Everything revealed up to and including this frame: the places from this
			// one down to third, since nothing above it has been shown yet. Flattened
			// in ascending place order, so the Podium reads best first.
			const onPlace = places
				.filter((shown) => shown >= place)
				.flatMap((shown) => byPlace.get(shown) ?? []);

			return {
				index: position + 1,
				place,
				headline: placeHeadline(place, revealed.length),
				revealed,
				onPodium: onPlace
			};
		});
}

/** The place as the room reads it: `1`, `1st`, `11th`. */
export function placeLabel(place: number): string {
	// The teens are the one place the last two digits decide the ending. A Podium never
	// gets that far, but the Podium is not the only thing that will ever ask.
	const lastTwo = place % 100;
	if (lastTwo >= 11 && lastTwo <= 13) return `${place}th`;

	return `${place}${place % 10 === 1 ? 'st' : place % 10 === 2 ? 'nd' : place % 10 === 3 ? 'rd' : 'th'}`;
}

const PLACE_WORDS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];

/**
 * What the operator says over a frame: `Third place`, and `First place, shared` when
 * more than one Entry is on it.
 *
 * "Shared" rather than naming a runner-up, because the whole point of ranking with
 * shared placement is that nobody finished second — and a reveal that announced one
 * anyway would undo it in the one moment the room is actually listening.
 */
export function placeHeadline(place: number, entries: number): string {
	const word = PLACE_WORDS[place] ?? `Place ${place}`;
	return `${word} place${entries > 1 ? ', shared' : ''}`;
}
