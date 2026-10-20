// The Podium as an image: the same layout the room is watching, drawn into a canvas at a
// fixed size and handed back as a PNG.
//
// A second renderer rather than a screenshot of the page. `html-to-image` and
// `foreignObject` serialisation both depend on the browser rendering the page's markup
// into a bitmap, which fails on webfonts and taints on anything cross-origin — and this
// image's whole job is to composite over video in the same software the live view is fed
// to. Drawing it here means the exported file is exactly 1920×1080, with exactly the
// background the operator chose, every time.
//
// The geometry comes from `PODIUM_LAYOUT`, shared with the live view, so the two cannot
// drift apart. Text rendering will never be pixel-identical to the DOM's, and is not
// trying to be: what has to match is the composite — same proportions, same opaque
// backing behind the text and the cards, same transparency where the operator asked for
// it.

import {
	PODIUM_COLOURS,
	PODIUM_LAYOUT,
	placeLabel,
	podiumCardWidth,
	podiumPhotoHeight,
	votesLabel,
	type PodiumEntry
} from '#lib/contest/podium.js';

/** The exported image's size. Sixteen by nine, because that is what a projector is. */
export const PODIUM_IMAGE_SIZE = { width: 1920, height: 1080 } as const;

/** One frame of the reveal, and the Contest it belongs to. */
export type PodiumImage = {
	title: string;
	/** `First place, shared` — `null` on the frame before the reveal starts. */
	headline: string | null;
	/** Everything on the Podium in this frame, best place first. */
	entries: PodiumEntry[];
	/** Each Entry's photograph. Read from the operator's own session, same origin. */
	photos: Map<string, string>;
	/** An opaque colour, or `null` to leave every pixel outside the panels transparent. */
	background: string | null;
};

/** cqw (hundredths of the Podium's width) as pixels in the exported image. */
const at = (cqw: number): number => (cqw / 100) * PODIUM_IMAGE_SIZE.width;

const SANS = "'Inter Variable', system-ui, sans-serif";
const PANEL = PODIUM_COLOURS.panel;
const BADGE = PODIUM_COLOURS.badge;
const INK = PODIUM_COLOURS.text;
const MUTED = PODIUM_COLOURS.muted;

/** How long a photograph gets to load before the image is drawn without it. */
const PHOTO_TIMEOUT_MS = 8000;

/** The image, and the filename to offer it under. */
export type RenderedPodium = { blob: Blob; name: string };

/**
 * Draws one frame and resolves with the PNG.
 *
 * A photograph that never loads is left out rather than waited on: the operator is
 * holding a save key down while a room watches, and a broken object in storage must not
 * be the reason no image comes out at all.
 */
export async function renderPodiumImage(frame: PodiumImage): Promise<RenderedPodium> {
	const { width, height } = PODIUM_IMAGE_SIZE;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const context = canvas.getContext('2d');
	if (context === null) throw new Error('This browser cannot draw the Podium to an image.');

	// Nothing is filled unless a colour was asked for, so a transparent Podium exports a
	// genuinely transparent file rather than a black one.
	if (frame.background !== null) {
		context.fillStyle = frame.background;
		context.fillRect(0, 0, width, height);
	}

	await Promise.all([fontsReady(), loadPhotos(frame)]);

	if (frame.headline === null) drawTitle(context, frame.title);
	else drawReveal(context, frame);

	return {
		blob: await toBlob(canvas),
		// The name the file arrives under, which is also what the operator will type into
		// whatever they post it to.
		name: fileName(frame)
	};
}

/** `halloween-party-2026-podium.png`, whatever the Contest is actually called. */
function fileName(frame: PodiumImage): string {
	const slug =
		frame.title
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'podium';

	return `${slug}${frame.headline === null ? '' : '-podium'}.png`;
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			// A zero-byte blob means the canvas was tainted or too large, and handing the
			// operator a file that will not open is worse than saying so.
			if (blob === null || blob.size === 0) reject(new Error('The Podium could not be drawn.'));
			else resolve(blob);
		}, 'image/png');
	});
}

/** The frame before the reveal: the Contest's own title, alone on screen. */
function drawTitle(context: CanvasRenderingContext2D, title: string): void {
	const size = at(PODIUM_LAYOUT.titleSize * 1.7);
	context.font = `700 ${size}px ${SANS}`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';

	const lines = wrap(context, title, PODIUM_IMAGE_SIZE.width * 0.82);
	const lineHeight = size * 1.15;
	const plateHeight = lines.length * lineHeight + at(PODIUM_LAYOUT.padding);
	const top = (PODIUM_IMAGE_SIZE.height - plateHeight) / 2;

	panel(
		context,
		at(PODIUM_LAYOUT.padding),
		top,
		PODIUM_IMAGE_SIZE.width - at(PODIUM_LAYOUT.padding * 2),
		plateHeight
	);

	context.fillStyle = INK;
	lines.forEach((line, index) => {
		context.fillText(
			line,
			PODIUM_IMAGE_SIZE.width / 2,
			top + plateHeight / 2 + (index - (lines.length - 1) / 2) * lineHeight
		);
	});
}

/** A place frame: the title bar, the headline, and every card on the Podium so far. */
function drawReveal(context: CanvasRenderingContext2D, frame: PodiumImage): void {
	const { width } = PODIUM_IMAGE_SIZE;
	let y = at(PODIUM_LAYOUT.padding);

	y += plate(
		context,
		width / 2,
		y,
		text(context, frame.title, PODIUM_LAYOUT.titleSize, 600),
		at(PODIUM_LAYOUT.titleSize * 1.5)
	);
	y += at(PODIUM_LAYOUT.gap);

	const headline = frame.headline ?? '';
	y += plate(
		context,
		width / 2,
		y,
		text(context, headline, PODIUM_LAYOUT.headlineSize, 700),
		at(PODIUM_LAYOUT.headlineSize * 1.4)
	);
	y += at(PODIUM_LAYOUT.gap);

	const count = frame.entries.length;
	if (count === 0) return;

	const cardWidth = at(podiumCardWidth(count));
	const photoHeight = at(podiumPhotoHeight(podiumCardWidth(count)));
	const textHeight = at(PODIUM_LAYOUT.costumeSize * 1.3 + PODIUM_LAYOUT.namesSize * 2.6);
	const cardHeight = photoHeight + textHeight;
	const rowWidth = count * cardWidth + (count - 1) * at(PODIUM_LAYOUT.gap);
	let x = (width - rowWidth) / 2;

	// Photos loaded up front in `loadPhotos`, keyed the same way the entries are.
	const photos = frame.photos;

	for (const entry of frame.entries) {
		panel(context, x, y, cardWidth, cardHeight);
		const url = photos.get(entry.entryId);
		if (url !== undefined) {
			drawPhoto(context, url, x, y, cardWidth, photoHeight);
		}

		let line = y + photoHeight + at(PODIUM_LAYOUT.namesSize * 0.9);
		const inset = at(PODIUM_LAYOUT.namesSize * 0.5);

		// The place is a badge on the card rather than a number beside it, so a tie is
		// legible as two cards both reading 1st without the frame having to explain it.
		const badge = placeLabel(entry.place);
		const badgeSize = at(PODIUM_LAYOUT.placeSize);
		const badgeInset = at(PODIUM_LAYOUT.badgeRadius);
		const badgeX = x + inset;

		context.font = `700 ${badgeSize}px ${SANS}`;
		const badgeWidth = context.measureText(badge).width + badgeInset * 2;

		context.fillStyle = BADGE;
		context.beginPath();
		context.roundRect(badgeX, line - badgeSize * 0.85, badgeWidth, badgeSize * 1.7, badgeInset);
		context.fill();

		context.fillStyle = INK;
		context.textAlign = 'left';
		context.textBaseline = 'middle';
		context.fillText(badge, badgeX + badgeInset, line);

		const votes = votesLabel(entry.votes);
		context.font = `600 ${at(PODIUM_LAYOUT.votesSize)}px ${SANS}`;
		context.fillStyle = MUTED;
		context.textAlign = 'right';
		context.fillText(votes, x + cardWidth - inset, line);

		context.textAlign = 'left';
		line += at(PODIUM_LAYOUT.costumeSize * 0.9);

		context.font = `700 ${at(PODIUM_LAYOUT.costumeSize)}px ${SANS}`;
		context.fillStyle = INK;
		context.fillText(ellipsis(context, entry.costume, cardWidth - inset * 2), x + inset, line);
		line += at(PODIUM_LAYOUT.costumeSize * 1.3);

		context.font = `400 ${at(PODIUM_LAYOUT.namesSize)}px ${SANS}`;
		context.fillStyle = MUTED;
		context.fillText(
			ellipsis(context, entry.names.join(', '), cardWidth - inset * 2),
			x + inset,
			line
		);

		x += cardWidth + at(PODIUM_LAYOUT.gap);
	}
}

/** An opaque rounded panel, which is what keeps the text legible over any background. */
function panel(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	radius = at(PODIUM_LAYOUT.radius)
) {
	context.fillStyle = PANEL;
	context.beginPath();
	context.roundRect(x, y, w, h, radius);
	context.fill();
}

/** A panel sized to its text, centred on `centreX`. */
function plate(
	context: CanvasRenderingContext2D,
	centreX: number,
	y: number,
	measured: number,
	height: number
): number {
	const width = Math.min(measured, PODIUM_IMAGE_SIZE.width - at(PODIUM_LAYOUT.padding * 2));
	panel(context, centreX - width / 2, y, width, height);
	return height;
}

/** How wide this text is at this size, in pixels. */
function text(context: CanvasRenderingContext2D, value: string, size: number, weight: number) {
	context.font = `${weight} ${at(size)}px ${SANS}`;
	return context.measureText(value).width + at(PODIUM_LAYOUT.gap);
}

/** Cut to a single line with an ellipsis, so a long name never runs off the card. */
function ellipsis(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
	if (context.measureText(value).width <= maxWidth) return value;

	let cut = value;
	while (cut.length > 0 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
	return `${cut}…`;
}

/** Split into as many lines as it takes to fit `maxWidth`, a word at a time. */
function wrap(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
	if (context.measureText(value).width <= maxWidth) return [value];

	const lines: string[] = [];
	let line = '';
	for (const word of value.split(/\s+/)) {
		const next = line === '' ? word : `${line} ${word}`;
		if (context.measureText(next).width <= maxWidth) {
			line = next;
		} else {
			lines.push(line);
			line = word;
		}
	}
	if (line !== '') lines.push(line);

	return lines;
}

/**
 * The photographs for one frame, keyed by URL, once they have loaded.
 *
 * Never evicted on purpose. This runs on the operator's Presentation screen, which
 * shows one Contest and is closed when the reveal is over, so what accumulates is that
 * Contest's own photos — a few hundred at the very most — for as long as the tab lives.
 * Evicting would mean re-loading a photograph mid-reveal, which is the one moment the
 * room is looking.
 */
const photoCache = new Map<string, HTMLImageElement | null>();

async function loadPhotos(frame: PodiumImage) {
	await Promise.all(
		frame.entries.map(async (entry) => {
			const url = frame.photos.get(entry.entryId);
			if (url === undefined || photoCache.has(url)) return;
			photoCache.set(url, await loadImage(url));
		})
	);
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
	const image = new Image();
	// Same origin, with the operator's session: the photographs are not public, and a
	// cross-origin load would taint the canvas and cost us the export entirely.
	image.src = url;

	const imageLoaded = new Promise<HTMLImageElement>((resolve, reject) => {
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('That photograph could not be loaded.'));
	});

	const gaveUp = new Promise<null>((done) => setTimeout(() => done(null), PHOTO_TIMEOUT_MS));

	try {
		return await Promise.race([imageLoaded, gaveUp]);
	} catch {
		return null;
	}
}

function drawPhoto(
	context: CanvasRenderingContext2D,
	url: string,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const image = photoCache.get(url);
	if (image === undefined || image === null) return;

	// Cover, not contain: a card with a letterboxed photo in it looks like a mistake,
	// and cropping is what the live view does with the same image.
	const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
	const drawn = { w: image.naturalWidth * scale, h: image.naturalHeight * scale };

	context.save();
	context.beginPath();
	context.roundRect(x, y, w, h, at(PODIUM_LAYOUT.radius));
	context.clip();
	context.drawImage(image, x + (w - drawn.w) / 2, y + (h - drawn.h) / 2, drawn.w, drawn.h);
	context.restore();
}

/** Webfonts before any text is measured, or the first frame is laid out in the fallback. */
async function fontsReady(): Promise<void> {
	await document.fonts?.ready;
}
