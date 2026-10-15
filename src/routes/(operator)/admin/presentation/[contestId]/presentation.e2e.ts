import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
	createContest,
	finishContest,
	openPresentation,
	setPodiumBackground,
	type Entrance
} from '../../../../../../test/contest.js';

const ENTRANCES: Entrance[] = [
	{ names: 'Alan Turing', costume: 'Enigma' },
	{ names: 'Mary Jackson', costume: 'Aeronaut' },
	{ names: 'Dorothy Vaughan', costume: 'Whiz Kid' }
];

/** Enigma three, Aeronaut two, Whiz Kid one: a Podium with all three places in it. */
const CLEAN_BALLOTS: (readonly string[])[] = [
	['Enigma', 'Whiz Kid', 'Aeronaut'],
	['Enigma', 'Aeronaut'],
	['Enigma']
];

/** Enigma twice, Whiz Kid twice, Aeronaut once: a tie at the top, and nobody second. */
const TIED_BALLOTS: (readonly string[])[] = [
	['Enigma', 'Whiz Kid'],
	['Enigma', 'Whiz Kid'],
	['Aeronaut']
];

/** The frame on screen, read off the root rather than off what happens to be visible. */
const frame = (page: Page) => page.locator('[data-presentation]');

/**
 * What one downloaded Podium image actually is.
 *
 * Decoded in the page that made it, because the question is about the pixels a
 * compositor will see — a PNG's own bytes say nothing about the alpha channel once it
 * has been written to disk. Takes a pixel to look at in the exported image's own
 * coordinates, so a caller can ask about the same spot on both the page and the file.
 */
async function probe(page: Page, file: string, at: { x: number; y: number }) {
	const base64 = (await readFile(file)).toString('base64');

	return page.evaluate(
		async (payload: { encoded: string; x: number; y: number }) => {
			const bytes = Uint8Array.from(atob(payload.encoded), (character) => character.charCodeAt(0));
			const picture = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));

			const canvas = new OffscreenCanvas(picture.width, picture.height);
			const context = canvas.getContext('2d');
			if (context === null) throw new Error('No 2d context.');
			context.drawImage(picture, 0, 0);

			const alphaAt = (x: number, y: number) => {
				const inside = Math.floor(picture.width * Math.min(Math.max(x / picture.width, 0), 1));
				const down = Math.floor(picture.height * Math.min(Math.max(y / picture.height, 0), 1));
				return context.getImageData(inside, down, 1, 1).data[3] / 255;
			};

			return {
				width: picture.width,
				height: picture.height,
				corner: [...context.getImageData(1, 1, 1, 1).data],
				plate: alphaAt(payload.x, payload.y),
				middle: alphaAt(picture.width / 2, picture.height / 2)
			};
		},
		{ encoded: base64, x: at.x, y: at.y }
	);
}

/**
 * Where the headline's own backing sits in the exported image, and how opaque it is on
 * the live page.
 *
 * The Podium sizes itself in hundredths of its own width, so one scale covers both axes
 * and the same point means the same thing on the projector and in the file. Sampled near
 * the top of the plate, where there is no glyph.
 */
function headlinePlate(page: Page) {
	return page.evaluate(() => {
		const root = document.querySelector('[data-presentation]');
		const headline = document.querySelector('[data-headline]');
		if (root === null || headline === null) throw new Error('The Podium is not on screen.');

		const box = root.getBoundingClientRect();
		const plate = headline.getBoundingClientRect();
		const scale = 1920 / box.width;

		return {
			x: (plate.left - box.left) * scale + 4,
			y: (plate.top - box.top) * scale + plate.height * scale * 0.15,
			alpha: Number(
				/,\s*([\d.]+)\s*\)$/.exec(getComputedStyle(headline).backgroundColor)?.[1] ?? '0'
			)
		};
	});
}

/** Saves the Podium with the save key and waits for the file it produced. */
async function savePodium(page: Page): Promise<string> {
	const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('s')]);
	const file = await download.path();
	if (file === null) throw new Error('The Podium image never landed on disk.');
	return file;
}

test.describe('the Presentation', () => {
	test('shows the top of the standings as third place first, then second, then first', async ({
		browser
	}) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);
		await openPresentation(page, contestId);

		// Before the reveal: the Contest's own title and nothing else claimed.
		await expect(page.locator('[data-headline]')).toHaveCount(0);
		await expect(page.locator('[data-podium-card]')).toHaveCount(0);

		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('Third place');
		await expect(page.locator('[data-costume]')).toHaveText(['Whiz Kid']);

		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('Second place');
		await expect(page.locator('[data-costume]')).toHaveText(['Aeronaut', 'Whiz Kid']);

		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('First place');
		await expect(page.locator('[data-costume]')).toHaveText(['Enigma', 'Aeronaut', 'Whiz Kid']);

		// And running past the end leaves the winner on screen rather than starting over.
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('First place');
		await expect(frame(page)).toHaveAttribute('data-frame', '3');

		await context.close();
	});

	test('never advances on its own', async ({ browser }) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);
		await openPresentation(page, contestId);

		// Long enough for the Board to have updated twice over on any other page in this
		// product, and for anything on a timer to have fired several times.
		await page.waitForTimeout(3000);

		await expect(frame(page)).toHaveAttribute('data-frame', '0');
		await expect(page.locator('[data-headline]')).toHaveCount(0);

		// One keypress is all it takes, which is what makes the wait above a real test
		// rather than a slow one.
		await page.keyboard.press('ArrowRight');
		await expect(frame(page)).toHaveAttribute('data-frame', '1');

		await context.close();
	});

	test('steps back, and replays the whole reveal from the start', async ({ browser }) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);
		await openPresentation(page, contestId);

		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('Second place');

		await page.keyboard.press('ArrowLeft');
		await expect(page.locator('[data-headline]')).toHaveText('Third place');

		// Back past the first frame is the title again, not an error.
		await page.keyboard.press('ArrowLeft');
		await expect(frame(page)).toHaveAttribute('data-frame', '0');
		await expect(page.locator('[data-keys]')).toBeVisible();

		// A second crowd, or a second run at the same one.
		await page.keyboard.press('r');
		await expect(frame(page)).toHaveAttribute('data-frame', '0');
		await expect(page.locator('[data-headline]')).toHaveCount(0);

		await context.close();
	});

	test('shows the keys until the reveal starts, and can hold a frame to announce it', async ({
		browser
	}) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);
		await openPresentation(page, contestId);

		// Discoverable without a manual, and gone the moment the operator starts — the
		// screen is for the result now.
		await expect(page.locator('[data-keys]')).toContainText('full screen');
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-keys]')).toHaveCount(0);

		// Held: still the same frame, and still no chrome over it.
		await page.keyboard.press('h');
		await expect(frame(page)).toHaveAttribute('data-held', 'true');
		await expect(frame(page)).toHaveAttribute('data-frame', '1');
		await page.waitForTimeout(1000);
		await expect(frame(page)).toHaveAttribute('data-frame', '1');

		// And starting again from a held frame brings the keys back with it, rather than
		// leaving the operator on a title screen with nothing to tell them what to press.
		await page.keyboard.press('r');
		await expect(frame(page)).toHaveAttribute('data-held', 'false');
		await expect(page.locator('[data-keys]')).toBeVisible();

		await context.close();
	});

	test('goes full screen and leaves it from the keyboard, and leaves with Escape', async ({
		browser
	}) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);
		await openPresentation(page, contestId);

		// Fullscreen puts the Presentation itself on the screen, not the admin page it
		// was opened from.
		await page.keyboard.press('f');
		await expect(frame(page)).toHaveAttribute('data-fullscreen', 'true');
		expect(
			await page.evaluate(() => document.fullscreenElement?.hasAttribute('data-presentation'))
		).toBe(true);

		await page.keyboard.press('f');
		await expect(frame(page)).toHaveAttribute('data-fullscreen', 'false');

		// Escape is left to leave the Presentation. Not asserted while fullscreen, because
		// escaping fullscreen is the browser's own shortcut rather than ours, and a
		// headless browser is not obliged to implement it.

		// Out of fullscreen, Escape leaves the Presentation for the admin page it came from.
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(new RegExp(`/admin/contests/${contestId}$`));
		await expect(page.locator('[data-podium]')).toBeVisible();

		await context.close();
	});

	test('shows a tie as a shared place, with a card for every Entry on it', async ({ browser }) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, TIED_BALLOTS);
		await openPresentation(page, contestId);

		// Nobody finished second, so there is no second place to announce.
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('Third place');

		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('First place, shared');

		// Two cards, both first, and nothing on screen claiming a runner-up.
		await expect(page.locator('[data-podium-card]')).toHaveCount(3);
		await expect(page.locator('[data-podium-card][data-place="1"]')).toHaveCount(2);
		expect(await page.locator('[data-place-badge]').allTextContents()).toEqual([
			'1st',
			'1st',
			'3rd'
		]);

		const screen = (await page.textContent('[data-presentation]')) ?? '';
		expect(screen).not.toContain('2nd');
		expect(screen).not.toContain('Second place');

		await context.close();
	});

	test('presents on an opaque colour, or transparent for compositing over video', async ({
		browser
	}) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);

		await setPodiumBackground(page, contestId, { colour: '#8b1e3f' });
		await openPresentation(page, contestId);
		await expect(frame(page)).toHaveAttribute('data-background', 'colour');
		expect(await frame(page).evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
			'rgb(139, 30, 63)'
		);

		await setPodiumBackground(page, contestId, { transparent: true });
		await openPresentation(page, contestId);
		await expect(frame(page)).toHaveAttribute('data-background', 'transparent');
		expect(await frame(page).evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
			'rgba(0, 0, 0, 0)'
		);

		// Transparent behind the reveal, but the title and the cards keep their own
		// backing, or the result is unreadable over whatever is playing.
		await page.keyboard.press('ArrowRight');
		for (const selector of ['[data-title]', '[data-headline]', '[data-podium-card]']) {
			const backing = await page
				.locator(selector)
				.first()
				.evaluate((node: Element) => {
					const { backgroundColor } = getComputedStyle(node);
					const alpha = Number(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/.exec(backgroundColor)?.[1] ?? '1');
					return alpha;
				});
			expect(backing, `${selector} keeps a backing over a transparent background`).toBeGreaterThan(
				0.5
			);
		}

		await context.close();
	});

	test('saves the Podium as an image that composites like the page it came from', async ({
		browser
	}) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);

		await setPodiumBackground(page, contestId, { transparent: true });
		await openPresentation(page, contestId);
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('[data-headline]')).toHaveText('First place');

		// The same point on the live page and in the exported file, so "composites
		// identically" is something the test can actually fail on.
		const plate = await headlinePlate(page);
		const transparent = await probe(page, await savePodium(page), plate);

		expect(transparent.width).toBe(1920);
		expect(transparent.height).toBe(1080);
		// Nothing behind the panels, which is what "composites identically" means here.
		expect(transparent.corner[3]).toBe(0);
		// The headline's own backing, at the opacity the projector showed it at.
		expect(Math.abs(transparent.plate - plate.alpha)).toBeLessThan(0.06);
		expect(transparent.plate).toBeGreaterThan(0.5);
		// And the cards are painted, or it is an empty file.
		expect(transparent.middle).toBeGreaterThan(0.5);

		await setPodiumBackground(page, contestId, { transparent: false, colour: '#8b1e3f' });
		await openPresentation(page, contestId);
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');

		// The colour the operator picked is the colour of the exported file, in the very
		// pixels that were transparent a moment ago.
		const opaque = await probe(page, await savePodium(page), await headlinePlate(page));
		expect(opaque.corner).toEqual([139, 30, 63, 255]);
		// And every pixel is covered: with a solid background behind them the panels are
		// no longer letting anything through, which is the other half of compositing.
		expect(opaque.plate).toBe(1);

		await context.close();
	});
});

test.describe('who can present', () => {
	test('is offered from the Contest once there is a result to present', async ({ browser }) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);

		// Reachable from the page the operator is already on, not only by typing the URL.
		await page.goto(`/admin/contests/${contestId}`);
		await page.getByRole('link', { name: 'Open the Presentation' }).click();
		await expect(page.locator('[data-presentation]')).toBeVisible();

		await context.close();
	});

	test('is nobody without a session', async ({ browser }) => {
		const { context, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);

		const guest = await browser.newContext();
		// Redirects are not followed: what matters is that the Presentation sends a
		// visitor without a session to the login screen rather than serving one.
		const response = await guest.request.get(`/admin/presentation/${contestId}`, {
			maxRedirects: 0
		});
		expect(response.status()).toBe(303);
		expect(response.headers().location).toBe('/admin/login');

		await guest.close();
		await context.close();
	});

	test('is not offered while the result can still move', async ({ browser }) => {
		const { context, page, contestId } = await finishContest(browser, ENTRANCES, CLEAN_BALLOTS);

		// Finished and presentable, which is the whole reason that test above exists.
		await openPresentation(page, contestId);
		await expect(page.locator('[data-presentation]')).toBeVisible();

		// A Contest still taking Entries has no result at all, so the admin page says
		// when the reveal opens rather than offering a Podium with nothing on it.
		const starting = await createContest(page);
		await page.goto(`/admin/contests/${starting}`);
		await expect(page.getByRole('link', { name: 'Open the Presentation' })).toHaveCount(0);
		await expect(page.locator('[data-podium]')).toContainText('opens once voting has closed');

		// Asked for directly rather than through the page, it is refused rather than
		// shown: a reveal of a result that is still moving would be a lie on a projector.
		expect(
			(await page.request.get(`/admin/presentation/${starting}`, { maxRedirects: 0 })).status()
		).toBe(409);

		await context.close();
	});
});
