import { existsSync } from 'node:fs';
import {
	expect,
	test,
	type APIRequestContext,
	type Browser,
	type BrowserContext,
	type Page
} from '@playwright/test';
import { png } from './png.js';

/**
 * Fixtures shared by the end-to-end suites: signing in, creating a Contest, and
 * putting real guests into it. They live here rather than in one suite because
 * every slice of the Contest needs the same few things, and a third copy of
 * "sign in, then create a Contest" is a third place to forget the password.
 */

/**
 * The operator password is a deployment secret: production takes it from
 * `wrangler secret put`, local runs from `.dev.vars`. The suites read the same
 * file the worker does rather than hardcoding a password.
 */
if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars');

export const password = requiredPassword();

function requiredPassword(): string {
	const configured = process.env.OPERATOR_PASSWORD;
	if (configured === undefined || configured === '') {
		throw new Error(
			'No operator password: set OPERATOR_PASSWORD or copy .dev.vars.example to .dev.vars.'
		);
	}
	return configured;
}

/** The origin the suite is talking to, which is where a browser is really posting from. */
function origin(): string {
	return test.info().project.use.baseURL ?? 'http://localhost:4173';
}

/**
 * Titles are unique per run, because the local database outlives the suite and
 * the suites run side by side. The random tail is what keeps two Contests made
 * in the same millisecond from sharing a title, which would make the locator
 * below ambiguous rather than wrong.
 */
export const stamp = (): string =>
	`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The library input, as opposed to the camera one, which asks for a capture. */
export const LIBRARY_PHOTO = 'input[type="file"][accept="image/*"]:not([capture])';

/** A plain picture, small enough that the browser has no reason to touch it. */
export function photo(size = { width: 120, height: 90, noise: false }) {
	return {
		name: 'costume.png',
		mimeType: 'image/png',
		buffer: png(size.width, size.height, size.noise)
	};
}

export async function signIn(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel('Shared password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Contests' })).toBeVisible();
}

/** Creates a Contest and returns its unguessable identifier. */
export async function createContest(
	page: Page,
	notices: { registration?: string; voting?: string } = {}
): Promise<string> {
	const title = `Halloween party ${stamp()}`;

	await page.goto('/admin/contests/new');
	await page.getByLabel('Title').fill(title);
	await page.getByLabel('Description').fill('One night, every costume on campus.');
	if (notices.registration !== undefined) {
		await page.getByLabel('Note for people signing up').fill(notices.registration);
	}
	if (notices.voting !== undefined) {
		await page.getByLabel('Note for people voting').fill(notices.voting);
	}

	await page.getByRole('button', { name: 'Create Contest' }).click();

	const row = page.locator('[data-contest-id]').filter({ hasText: title });
	await expect(row).toBeVisible();
	const id = await row.getAttribute('data-contest-id');
	if (id === null) throw new Error('The new Contest has no identifier.');
	return id;
}

/** One guest, on their own device, entering the Contest. */
export async function enter(
	context: BrowserContext,
	contestId: string,
	names: string,
	costume: string,
	picture = photo()
) {
	const page = await context.newPage();
	await page.goto(`/c/${contestId}`);
	await page.getByLabel('Everyone in this costume').fill(names);
	await page.getByLabel('What are you dressed up as?').fill(costume);
	await page.locator(LIBRARY_PHOTO).setInputFiles(picture);

	// Waiting for the preview rather than clicking straight away, and waiting
	// generously for it. The preview is drawn by the photo handler, which only exists
	// once the page has hydrated; the submit button stays disabled until that handler
	// has run, so a click landing before hydration hits a disabled button and does
	// nothing at all.
	//
	// Generous because this is the suite's one load-sensitive wait: hydration is quick
	// on an idle machine and genuinely slow with the whole suite in parallel, where
	// the browser is one of many competing for it.
	await expect(page.locator('[data-photo-preview]')).toBeVisible({ timeout: 30_000 });

	await page.getByRole('button', { name: 'Enter the contest' }).click();
	await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();
	return page;
}

/** One Entry, as guests register it. */
export type Entrance = { names: string; costume: string };

/** Fills a Contest with one Entry per entrance, each from its own device. */
export async function fillEntries(
	browser: Browser,
	contestId: string,
	entrances: readonly Entrance[]
) {
	for (const { names, costume } of entrances) {
		const guest = await browser.newContext();
		await enter(guest, contestId, names, costume);
		await guest.close();
	}
}

/**
 * Closes Registration and opens Voting in the operator's one action. From here
 * the contest link serves the ballot instead of the registration form.
 */
export async function openVoting(page: Page, contestId: string) {
	await page.goto(`/admin/contests/${contestId}`);
	await page.getByRole('button', { name: 'Close registration and open voting' }).click();
	await expect(page.locator('[data-voting-open]')).toBeVisible();
}

/** One guest, on their own device, casting a ballot for the named costumes. */
export async function vote(
	context: BrowserContext,
	contestId: string,
	costumes: readonly string[]
): Promise<Page> {
	const page = await context.newPage();
	await page.goto(`/c/${contestId}`);
	await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();

	for (const costume of costumes) await page.getByLabel(`Vote for ${costume}`).check();
	await page.getByRole('button', { name: 'Send my ballot' }).click();
	await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

	return page;
}

/**
/**
 * Opens the audience link.
 *
 * An ordinary `goto`, deliberately. A waiting page holds a live subscription, and
 * waiting on `load` or `domcontentloaded` here looked like a reasonable accommodation
 * for that; it was not. It hid a generator that never yielded at all, so the page's
 * own render hung and every navigation to it timed out. The fix belongs in the
 * generator, and this helper staying ordinary is what keeps it visible next time.
 */
export async function openAudience(page: Page, contestId: string): Promise<void> {
	await page.goto(`/c/${contestId}`);
}

/** Casts one Ballot per device, each from a browser of its own. */
export async function fillBallots(
	browser: Browser,
	contestId: string,
	ballots: readonly (readonly string[])[]
) {
	const pages: Page[] = [];

	for (const picks of ballots) {
		const guest = await browser.newContext();
		pages.push(await vote(guest, contestId, picks));
		await guest.close();
	}

	return pages;
}

/**
 * A Contest that is finished: Entries in, Ballots cast, voting closed. The state the
 * operator presents or publishes from, and the state every suite about that needs.
 *
 * Returns the operator's own context and page, because a suite that closes voting is
 * usually about to do something else as the operator.
 */
export async function finishContest(
	browser: Browser,
	entrances: readonly Entrance[],
	ballots: readonly (readonly string[])[]
): Promise<{ context: BrowserContext; page: Page; contestId: string }> {
	const context = await browser.newContext();
	const page = await context.newPage();

	await signIn(page);
	const contestId = await createContest(page);
	await fillEntries(browser, contestId, entrances);
	await openVoting(page, contestId);
	await fillBallots(browser, contestId, ballots);

	await page.goto(`/admin/contests/${contestId}`);
	await page.getByRole('button', { name: 'Close voting' }).click();
	await page.getByRole('button', { name: 'Yes, close voting' }).click();
	await expect(page.locator('[data-contest-phase]')).toContainText('Results');

	return { context, page, contestId };
}

/**
 * The Presentation, on its own screen.
 *
 * Pressing F is deliberately *not* in here: fullscreen is one of the things the suite
 * about the reveal asserts, and a fixture that always went fullscreen would make every
 * other assertion run against a screen the operator never has.
 */
export async function openPresentation(page: Page, contestId: string): Promise<void> {
	await page.goto(`/admin/presentation/${contestId}`);
	await expect(page.locator('[data-presentation]')).toBeVisible();
}

/**
 * Sets the Podium's background from the admin page, the way the operator does.
 *
 * `transparent` is left alone when undefined, so a suite can change only the colour
 * without having to say what the transparency was.
 */
export async function setPodiumBackground(
	page: Page,
	contestId: string,
	background: { transparent?: boolean; colour?: string } = {}
): Promise<void> {
	await page.goto(`/admin/contests/${contestId}`);

	if (background.transparent !== undefined) {
		await page
			.getByLabel('Transparent, to composite over video')
			.setChecked(background.transparent);
	}
	if (background.colour !== undefined) {
		await page.getByLabel('Background', { exact: true }).fill(background.colour);
	}

	await page.getByRole('button', { name: 'Save background' }).click();

	// Read back off a fresh load rather than off the page that submitted: the form shows
	// what was last typed, so only a reload shows what was actually stored. This is what
	// catches a save that silently did nothing.
	await page.reload();
	const transparent = page.getByLabel('Transparent, to composite over video');
	await expect(transparent).toBeChecked({ checked: background.transparent === true });

	if (background.colour !== undefined) {
		await expect(page.getByLabel('Background', { exact: true })).toHaveValue(
			background.colour.toLowerCase()
		);
	}
}

/** The order the costume names appear on the ballot this device was served. */
export async function ballotOrder(page: Page): Promise<string[]> {
	return page
		.locator('[data-ballot-entry]')
		.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-costume') ?? ''));
}

/** Anything that can post: a page, or a browser context with no page at all. */
type Poster = { request: APIRequestContext };

/**
 * Posts a form the way a browser's own client would, and hands back what
 * SvelteKit answered. SvelteKit answers a form action with the outcome as a body
 * — a failure, or a redirect — rather than as a status of its own, so this
 * returns the parsed body rather than the response.
 */
export async function postForm(
	poster: Poster,
	path: string,
	form: Record<string, string | string[]>
): Promise<Record<string, unknown>> {
	// Built by hand rather than through `form`, because a repeated field is how a
	// browser sends several picks and what the worker's own guard reads.
	const body = new URLSearchParams();
	for (const [name, value] of Object.entries(form)) {
		for (const one of Array.isArray(value) ? value : [value]) body.append(name, one);
	}

	const response = await poster.request.post(path, {
		headers: { origin: origin(), 'content-type': 'application/x-www-form-urlencoded' },
		data: body.toString()
	});
	return (await response.json()) as Record<string, unknown>;
}

/**
 * A replayed registration, posted straight at the page the way an attacker's own
 * client can. Used to show that a second Entry does not appear from one device.
 */
export async function replayRegistration(
	poster: Poster,
	contestId: string,
	names = 'Someone Else',
	costume = 'A second costume'
): Promise<Record<string, unknown>> {
	const response = await poster.request.post(`/c/${contestId}?/register`, {
		multipart: { participants: names, costume, photo: photo() },
		headers: { origin: origin() }
	});
	return (await response.json()) as Record<string, unknown>;
}
