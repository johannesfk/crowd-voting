import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
	createContest,
	enter,
	fillEntries,
	LIBRARY_PHOTO,
	photo,
	postForm,
	replayRegistration,
	signIn
} from '../../../../test/contest.js';

/** The sign-up notice the operator writes, shown on the audience's form. */
const SIGN_UP_NOTICE = 'Enter alone or as a group.';

/**
 * The width the browser actually stored, which is the only honest way to see
 * whether a photo was shrunk or left alone.
 */
async function storedWidth(entry: ReturnType<Page['locator']>): Promise<number> {
	const image = entry.locator('img');
	await expect(image).toBeVisible();
	await image.evaluate((node: HTMLImageElement) => node.decode());
	return image.evaluate((node: HTMLImageElement) => node.naturalWidth);
}

/**
 * What the worker actually stored, by its own content type. A guest's PNG that
 * comes back as a JPEG was re-encoded; one that comes back as a PNG was left alone.
 */
async function storedType(entry: ReturnType<Page['locator']>): Promise<string | null> {
	const response = await entry
		.locator('img')
		.evaluate(async (node: HTMLImageElement) =>
			(await fetch(node.currentSrc, { cache: 'no-store' })).headers.get('content-type')
		);
	return response;
}

test.describe('an audience member', () => {
	test('does not lose what they typed while the page was still loading', async ({ browser }) => {
		// SvelteKit replaces the server-rendered DOM when the page hydrates. A field
		// whose value came from a server-rendered text child is rewritten at that
		// moment, so anything a guest typed into it first is wiped — and they find
		// out only by being told their name is missing. This is the case a guest on
		// venue wifi hits: the page appears, they start typing, and the bundle
		// finishes loading underneath them.
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		const guest = await browser.newContext();
		const page = await guest.newPage();
		await page.goto(`/c/${contestId}`);
		await page.getByLabel('Everyone in this costume').fill('Ada Lovelace, Alan Turing');
		await page.getByLabel('What are you dressed up as?').fill('Time travellers');
		await page.locator(LIBRARY_PHOTO).setInputFiles(photo());

		// Long enough for hydration to have run and rewritten whatever it rewrites.
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: 'Enter the contest' }).click();
		await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();

		// Every name they typed is still there, so the entry is the whole group.
		await expect(page.getByText('Ada Lovelace, Alan Turing')).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('enters a group, and the operator sees it with its photo and names', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		// The sign-up notice is the operator's own words, on the audience's form.
		const guest = await browser.newContext();
		const page = await guest.newPage();
		await page.goto(`/c/${contestId}`);
		await expect(page.getByText(SIGN_UP_NOTICE)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toBeVisible();

		// Both photo routes are offered explicitly: a plain image picker on modern
		// Android no longer offers a camera tile of its own.
		await expect(page.getByRole('button', { name: 'Take a photo' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Choose from library' })).toBeVisible();

		// A group of three is one Entry, with everybody named, and the chosen photo
		// is previewed before it is sent.
		await page
			.getByLabel('Everyone in this costume')
			.fill('Ada Lovelace, Alan Turing\nGrace Hopper');
		await page.getByLabel('What are you dressed up as?').fill('Time travellers');
		await page
			.locator(LIBRARY_PHOTO)
			.setInputFiles(photo({ width: 200, height: 150, noise: false }));
		await expect(page.locator('[data-photo-preview]')).toBeVisible();
		await page.getByRole('button', { name: 'Enter the contest' }).click();
		await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();

		// The guest sees themselves named back, and no way to change any of it.
		await expect(page.getByText('Ada Lovelace, Alan Turing, Grace Hopper')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Enter the contest' })).toHaveCount(0);
		await expect(page.getByLabel('Everyone in this costume')).toHaveCount(0);

		// And the operator sees the whole thing arrive.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entry = operatorPage.locator('[data-entry-id]');
		await expect(entry).toHaveCount(1);
		await expect(entry.getByText('Time travellers')).toBeVisible();
		await expect(entry.getByText('Ada Lovelace, Alan Turing, Grace Hopper')).toBeVisible();

		// A photo already small enough is uploaded as it is: 200 pixels in, 200
		// pixels out, and still a PNG — proof it was never re-encoded and degraded
		// for nothing.
		expect(await storedWidth(entry)).toBe(200);
		expect(await storedType(entry)).toBe('image/png');

		await guest.close();
		await operator.close();
	});

	test('is told they have already entered rather than shown the form again', async ({
		browser
	}) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Katherine Johnson', 'Astronaut');

		// The same device, coming back later.
		const page = await guest.newPage();
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toHaveCount(0);

		// A different device is a different guest, and is still offered the form.
		const other = await browser.newContext();
		const otherPage = await other.newPage();
		await otherPage.goto(`/c/${contestId}`);
		await expect(otherPage.getByRole('heading', { name: 'Enter the contest' })).toBeVisible();

		await guest.close();
		await other.close();
		await operator.close();
	});

	test('shrinks a big photo in the browser, and still enters when the photo cannot be read', async ({
		browser
	}) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		// 1800px on the long edge, and far too many bytes to upload as they are:
		// exactly the phone camera case the browser pipeline exists for.
		const guest = await browser.newContext();
		await enter(
			guest,
			contestId,
			'Mary Jackson',
			'Aeronaut',
			photo({ width: 1800, height: 1200, noise: true })
		);

		// A file big enough to be worth processing and unreadable once the browser
		// tries: the decode fails, and the entry is made anyway.
		const broken = await browser.newContext();
		await enter(broken, contestId, 'Annie Easley', 'The computer that wore trousers', {
			name: 'photo.png',
			mimeType: 'image/png',
			buffer: randomBytes(400 * 1024)
		});

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entries = operatorPage.locator('[data-entry-id]');
		await expect(entries).toHaveCount(2);
		await expect(operatorPage.getByText('The computer that wore trousers')).toBeVisible();

		// The stored photograph is the shrunk one: 1800px in, 1600px out, and a JPEG
		// because that is what the re-encode produces.
		const shrunk = entries.filter({ hasText: 'Aeronaut' });
		expect(await storedWidth(shrunk)).toBe(1600);
		expect(await storedType(shrunk)).toBe('image/jpeg');

		await guest.close();
		await broken.close();
		await operator.close();
	});

	test('cannot enter twice from one device, even by posting the form again', async ({
		browser
	}) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		const guest = await browser.newContext();
		const page = await enter(guest, contestId, 'Dorothy Vaughan', 'Whiz Kid');
		// Registration is final, so a replayed post from the same device lands back
		// on the confirmation rather than adding a second Entry. SvelteKit answers a
		// form action with the outcome as a body, redirects and all, rather than as a
		// 303 of its own.
		expect(await replayRegistration(page, contestId)).toMatchObject({
			type: 'redirect',
			status: 303,
			location: `/c/${contestId}`
		});

		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();
		await expect(page.getByText('A second costume')).toHaveCount(0);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-entry-id]')).toHaveCount(1);

		await guest.close();
		await operator.close();
	});
});

test.describe('the operator', () => {
	test('hides an Entry, and puts it back', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		await fillEntries(browser, contestId, [
			{ names: 'Ada Lovelace', costume: 'Time travellers' },
			{ names: 'Alan Turing', costume: 'Enigma' }
		]);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.getByText('2 of 2 will be on the ballot.')).toBeVisible();

		const hidden = operatorPage.locator('[data-entry-id]').filter({ hasText: 'Enigma' });
		await hidden.getByRole('button', { name: 'Hide from the ballot' }).click();

		// A Hidden Entry leaves the ballot and the standings, and stays in front of
		// the operator so the decision can be seen and undone. The label is matched
		// exactly: the prose around it is allowed to mention hiding an Entry.
		await expect(hidden.getByText('Hidden', { exact: true })).toBeVisible();
		await expect(operatorPage.getByText('1 of 2 will be on the ballot.')).toBeVisible();

		await hidden.getByRole('button', { name: 'Put back on the ballot' }).click();
		await expect(operatorPage.getByText('Hidden', { exact: true })).toHaveCount(0);
		await expect(operatorPage.getByText('2 of 2 will be on the ballot.')).toBeVisible();

		await operator.close();
	});

	test('cannot hide an Entry without a session', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { registration: SIGN_UP_NOTICE });

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Mary Jackson', 'Aeronaut');

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entryId = await operatorPage.locator('[data-entry-id]').getAttribute('data-entry-id');
		if (entryId === null) throw new Error('The entry has no identifier.');

		// The action runs before the layout's guard, so posting straight at it is
		// the only way in that a browser cannot take.
		expect(
			await postForm(guest, `/admin/contests/${contestId}?/hide`, { entryId, hidden: 'true' })
		).toMatchObject({
			type: 'redirect',
			status: 303,
			location: '/admin/login'
		});

		// Nothing was hidden.
		await operatorPage.reload();
		await expect(operatorPage.getByText('1 of 1 will be on the ballot.')).toBeVisible();
		await expect(operatorPage.getByText('Hidden', { exact: true })).toHaveCount(0);

		await guest.close();
		await operator.close();
	});
});
