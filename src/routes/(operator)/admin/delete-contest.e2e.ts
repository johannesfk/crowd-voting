import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
	createContest,
	fillEntries,
	openVoting,
	postForm,
	signIn,
	vote,
	type Entrance
} from '../../../../test/contest.js';

const ENTRANCES: Entrance[] = [
	{ names: 'Alan Turing', costume: 'Enigma' },
	{ names: 'Mary Jackson', costume: 'Aeronaut' }
];

/**
 * A Contest in Registration with two Entries in it and their photographs in
 * storage: the state a contest abandoned halfway through signing up is in, and
 * the state deletion has to clear completely.
 *
 * Returns the title as the operator reads it off the page — typing it back is the
 * confirmation — and an id per Entry, so each photograph can be asked for by name
 * before and after.
 */
async function contestToDelete(browser: import('@playwright/test').Browser): Promise<{
	operator: BrowserContext;
	page: Page;
	contestId: string;
	title: string;
	entryIds: string[];
}> {
	const operator = await browser.newContext();
	const page = await operator.newPage();
	await signIn(page);

	const contestId = await createContest(page);
	await fillEntries(browser, contestId, ENTRANCES);

	await page.goto(`/admin/contests/${contestId}`);
	const title = (await page.locator('h1').innerText()).trim();
	const entryIds = await page
		.locator('[data-entry-id]')
		.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-entry-id') ?? ''));

	expect(entryIds).toHaveLength(2);

	return { operator, page, contestId, title, entryIds };
}

/** Deletes through the two steps the operator takes: ask, then re-type the title. */
async function deleteAsTheOperator(page: Page, contestId: string, title: string): Promise<void> {
	await page.goto(`/admin/contests/${contestId}`);
	await page.getByRole('button', { name: 'Delete this Contest' }).click();
	await expect(page.locator('[data-confirm-delete]')).toBeVisible();

	await page.getByLabel('Type the title to confirm').fill(title);
	await page.getByRole('button', { name: 'Yes, delete it' }).click();
}

/**
 * Every route that answers for a Contest, from both sides of it: the audience's
 * page, the operator's own, and each Entry's photograph served to either. All of
 * them have to be gone once the Contest is, which is what a hard delete means.
 */
function everyRouteFor(contestId: string, entryIds: readonly string[]): string[] {
	return [
		`/c/${contestId}`,
		`/admin/contests/${contestId}`,
		...entryIds.flatMap((entryId) => [
			`/c/${contestId}/entries/${entryId}/photo`,
			`/admin/contests/${contestId}/entries/${entryId}/photo`
		])
	];
}

/**
 * Asserts each of those routes has stopped answering.
 *
 * Asked for over the request API rather than in a page, because that is the only way
 * to see what the worker answers rather than what one browser happens to still hold:
 * a photograph already downloaded sits in that browser's cache and this cannot
 * retract it, which is a fact about the room rather than about the deletion.
 */
async function expectNothingAnswering(page: Page, paths: readonly string[]): Promise<void> {
	for (const path of paths) {
		const response = await page.request.get(path);
		expect(response.status(), `${path} is gone`).toBe(404);
	}
}

test.describe('the operator', () => {
	test('deletes a Contest, its Entries and its photographs', async ({ browser }) => {
		const { operator, page, contestId, title, entryIds } = await contestToDelete(browser);

		// The photographs are in storage before anything is deleted, so a 404 afterwards
		// is the deletion and not a Contest that never had them.
		for (const entryId of entryIds) {
			const stored = await page.request.get(
				`/admin/contests/${contestId}/entries/${entryId}/photo`
			);
			expect(stored.status(), 'the photograph is stored to begin with').toBe(200);
		}

		// And nothing on the page offers to put any of it back.
		await expect(page.getByRole('button', { name: /undo|restore|bring back/i })).toHaveCount(0);

		await deleteAsTheOperator(page, contestId, title);

		// Straight back to the list, which has no row for it any more.
		await expect(page).toHaveURL(/\/admin$/);
		await expect(page.getByRole('heading', { name: 'Contests' })).toBeVisible();
		await expect(page.locator(`[data-contest-id="${contestId}"]`)).toHaveCount(0);

		// The link is dead in every direction somebody could still be holding it: the
		// audience's page, the operator's own page, and the photographs themselves —
		// which is what makes this a hard delete rather than a hidden one (ADR 0002).
		await expectNothingAnswering(page, everyRouteFor(contestId, entryIds));

		await operator.close();
	});

	test('is asked to re-type the title, and a wrong title deletes nothing', async ({ browser }) => {
		const { operator, page, contestId, title } = await contestToDelete(browser);

		// A post with no title in it is not a deletion. It is the operator being shown
		// what they are about to lose, and nothing is lost until they say so.
		expect(await postForm(page, `/admin/contests/${contestId}?/delete`, {})).toMatchObject({
			type: 'failure',
			status: 409
		});

		// Nor is a title that is not this one, which the operator is told on the page
		// rather than left to work out from a Contest that did not disappear.
		expect(
			await postForm(page, `/admin/contests/${contestId}?/delete`, { title: 'Some other party' })
		).toMatchObject({ type: 'failure', status: 409 });

		await page.goto(`/admin/contests/${contestId}`);
		await page.getByRole('button', { name: 'Delete this Contest' }).click();
		await page.getByLabel('Type the title to confirm').fill(`${title}!`);
		await page.getByRole('button', { name: 'Yes, delete it' }).click();
		await expect(page.locator('[data-title-mismatch]')).toBeVisible();

		// Everything survives a mistyped confirmation: the Contest, its entries, and
		// the link the room has been given. The box still holds what was typed, so one
		// character can be fixed rather than the whole title re-entered.
		await expect(page.locator('[data-entry-id]')).toHaveCount(2);
		await expect(page.getByLabel('Type the title to confirm')).toHaveValue(`${title}!`);
		expect((await page.request.get(`/c/${contestId}`)).status()).toBe(200);

		// And saying no at the confirmation step deletes nothing either.
		await page.getByRole('link', { name: 'Keep this Contest' }).click();
		await expect(page.locator('[data-confirm-delete]')).toHaveCount(0);
		expect((await page.request.get(`/c/${contestId}`)).status()).toBe(200);

		await operator.close();
	});

	test('cannot delete without a session', async ({ browser }) => {
		const { operator, page, contestId, title } = await contestToDelete(browser);

		const guest = await browser.newContext();
		const stranger = await guest.newPage();

		expect(
			await postForm(stranger, `/admin/contests/${contestId}?/delete`, { title })
		).toMatchObject({ type: 'redirect', status: 303, location: '/admin/login' });

		// Photographs of guests are not destroyed by a link somebody found.
		await page.reload();
		await expect(page.locator('[data-entry-id]')).toHaveCount(2);
		expect((await page.request.get(`/c/${contestId}`)).status()).toBe(200);

		await guest.close();
		await operator.close();
	});

	test('deletes a Contest while the room is still voting, leaving nobody on a stale page', async ({
		browser
	}) => {
		const { operator, page, contestId, title } = await contestToDelete(browser);

		// Deletion is allowed at any phase, and a Contest abandoned mid-party is the
		// case that needs it most: there is no way to un-vote a room.
		await openVoting(page, contestId);

		// A guest who has already voted is sitting on the confirmation the link gave
		// them, and is still sitting on it when the Contest goes. The context is kept
		// open, because it is the guest's own device that has to be turned away.
		const voter = await browser.newContext();
		const ballot = await vote(voter, contestId, ['Enigma']);

		await deleteAsTheOperator(page, contestId, title);

		// Their page stops claiming anything about a Contest that is not there: not the
		// ballot, not the confirmation, not the waiting page.
		await ballot.reload();
		await expect(ballot.getByRole('heading', { name: 'Your vote is in' })).toHaveCount(0);
		await expect(ballot.getByRole('heading', { name: 'Pick your favourites' })).toHaveCount(0);
		expect((await ballot.request.get(`/c/${contestId}`)).status()).toBe(404);

		// And a guest arriving now gets the same answer.
		const latecomer = await browser.newContext();
		const late = await latecomer.newPage();
		await late.goto(`/c/${contestId}`);
		await expect(late.getByRole('button', { name: 'Enter the contest' })).toHaveCount(0);
		await latecomer.close();

		await voter.close();
		await operator.close();
	});

	test('deletes a published Contest, and running it again leaves nothing behind', async ({
		browser
	}) => {
		// The longest fixture in this file — a Contest walked all the way to Published,
		// with a Ballot and a Vote in it for the deletion to remove. Built here rather
		// than through `finishContest` because it needs the Entries this file already
		// puts in, and one ballot is enough to prove a Ballot was there.
		test.slow();

		const { operator, page, contestId, title, entryIds } = await contestToDelete(browser);

		await openVoting(page, contestId);

		const voter = await browser.newContext();
		await vote(voter, contestId, ['Enigma', 'Aeronaut']);
		await voter.close();

		await page.getByRole('button', { name: 'Close voting' }).click();
		await page.getByRole('button', { name: 'Yes, close voting' }).click();
		await expect(page.locator('[data-contest-phase]')).toContainText('Results');

		await page.getByRole('button', { name: 'Publish the result' }).click();
		await page.getByRole('button', { name: 'Yes, publish it' }).click();
		await expect(page.locator('[data-contest-phase]')).toContainText('Published');

		await deleteAsTheOperator(page, contestId, title);
		await expect(page).toHaveURL(/\/admin$/);

		// Nothing answers about this Contest any more: not the published standings the
		// room could share, not the operator's page, not the photographs. The ballots and
		// votes go with it — there is no surface anywhere that counts a Ballot for a
		// Contest that does not exist, so a dead link is the whole of what there is to see.
		await expectNothingAnswering(page, everyRouteFor(contestId, entryIds));

		// Running the deletion again, because nobody is sure the first one went through,
		// finds nothing to do and says so in the plainest terms available. It is not an
		// error the operator has to do anything about, and it cannot leave anything
		// behind either: there is nothing left that names what to clean up. (A deletion
		// interrupted halfway leaves the Contest standing, so the same run finishes it —
		// photographs are removed first, which is what makes a retry findable.)
		const again = await page.request.post(`/admin/contests/${contestId}?/delete`, {
			// Form encoding by hand, as the browser sends it and as the action's own
			// origin check expects.
			headers: {
				origin: new URL(page.url()).origin,
				'content-type': 'application/x-www-form-urlencoded'
			},
			data: `title=${encodeURIComponent(title)}`
		});
		expect(again.status()).toBe(404);

		await page.goto('/admin');
		await expect(page.locator(`[data-contest-id="${contestId}"]`)).toHaveCount(0);

		await operator.close();
	});
});
