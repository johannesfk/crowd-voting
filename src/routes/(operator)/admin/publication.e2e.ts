import { expect, test } from '@playwright/test';
import {
	createContest,
	fillBallots,
	fillEntries,
	openAudience,
	vote,
	openVoting,
	postForm,
	signIn,
	type Entrance
} from '../../../../test/contest.js';

const ENTRANCES: Entrance[] = [
	{ names: 'Alan Turing', costume: 'Enigma' },
	{ names: 'Mary Jackson', costume: 'Aeronaut' },
	{ names: 'Dorothy Vaughan', costume: 'Whiz Kid' }
];

/**
 * A finished Contest with votes cast and voting closed — the state a guest waits
 * in. Enigma twice, Whiz Kid twice, Aeronaut once, so the tie at the top is the
 * normal shape of a small room rather than something contrived.
 */
async function finishedContest(
	browser: import('@playwright/test').Browser,
	/** Left open, and already holding a ballot, for the tests about a voter returning. */
	keepVoting?: import('@playwright/test').BrowserContext
) {
	const operator = await browser.newContext();
	const operatorPage = await operator.newPage();
	await signIn(operatorPage);
	const contestId = await createContest(operatorPage, { voting: 'Choose one to three.' });

	await fillEntries(browser, contestId, ENTRANCES);
	await openVoting(operatorPage, contestId);

	if (keepVoting !== undefined) await vote(keepVoting, contestId, ['Enigma']);

	await fillBallots(browser, contestId, [
		['Enigma', 'Whiz Kid'],
		['Enigma', 'Whiz Kid'],
		['Aeronaut']
	]);

	await operatorPage.goto(`/admin/contests/${contestId}`);
	await operatorPage.getByRole('button', { name: 'Close voting' }).click();
	await operatorPage.getByRole('button', { name: 'Yes, close voting' }).click();
	await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Results');

	return { operator, operatorPage, contestId };
}

/** Publishes from the operator's page, through its two deliberate steps. */
async function publish(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'Publish the result' }).click();
	await page.getByRole('button', { name: 'Yes, publish it' }).click();
	await expect(page.locator('[data-contest-phase]')).toContainText('Published');
}

test.describe('an audience member', () => {
	test('waits on a finished contest rather than getting an error or a ballot', async ({
		browser
	}) => {
		const { operator, contestId } = await finishedContest(browser);

		// A device that never entered and never voted — the shape of a guest who
		// wandered over mid-evening.
		const guest = await browser.newContext();
		const page = await guest.newPage();
		await openAudience(page, contestId);

		await expect(page.getByRole('heading', { name: 'Voting has closed' })).toBeVisible();
		await expect(page.getByText('Leave this page open')).toBeVisible();

		// Nothing that belongs to a later phase, and nothing that went wrong.
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'The result' })).toHaveCount(0);
		await expect(page.getByText(/error/i)).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('is still told their own vote is in, and waits with everyone else', async ({ browser }) => {
		// A device that voted while voting was open, kept open across the close. The
		// ballot is cast during the fixture, because afterwards there is no ballot left
		// to cast — and the point is that a Ballot cast once stays cast.
		const voter = await browser.newContext();
		const { operator, operatorPage, contestId } = await finishedContest(browser, voter);

		const page = await voter.newPage();
		await openAudience(page, contestId);

		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
		// And they wait for the result rather than being handed one nobody published.
		await expect(page.getByText('Leave this page open')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'The result' })).toHaveCount(0);

		// And the reveal reaches them like everyone else, once it is published.
		await publish(operatorPage);
		await expect(page.getByRole('heading', { name: 'The result' })).toBeVisible();

		await voter.close();
		await operator.close();
	});

	test('sees the standings appear on their own, without reloading', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await finishedContest(browser);

		const guest = await browser.newContext();
		const page = await guest.newPage();
		await openAudience(page, contestId);
		await expect(page.getByText('Leave this page open')).toBeVisible();

		// Not one reload on this page for the whole test: the standings can only arrive
		// through the connection the waiting page holds open.
		const navigations: string[] = [];
		page.on('framenavigated', (frame) => {
			if (frame === page.mainFrame()) navigations.push(frame.url());
		});

		await publish(operatorPage);

		await expect(page.getByRole('heading', { name: 'The result' })).toBeVisible();
		await expect(page.locator('[data-standing]')).toHaveCount(3);
		expect(navigations).toEqual([]);

		await guest.close();
		await operator.close();
	});

	test('recovers on its own when the connection is interrupted', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await finishedContest(browser);

		const guest = await browser.newContext();
		const page = await guest.newPage();
		await openAudience(page, contestId);
		await expect(page.getByText('Leave this page open')).toBeVisible();

		// The wifi under a party drops, the tab sleeps, the phone locks. The guest comes
		// back and the page has to still be watching.
		await guest.setOffline(true);
		await page.waitForTimeout(1500);
		await guest.setOffline(false);

		await publish(operatorPage);

		// Still reveals, without the guest touching anything.
		await expect(page.getByRole('heading', { name: 'The result' })).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('sees the standings ordered by count, with a tie sharing one place', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await finishedContest(browser);
		await publish(operatorPage);

		const page = await (await browser.newContext()).newPage();
		await openAudience(page, contestId);

		const places = await page
			.locator('[data-standing]')
			.evaluateAll((rows) =>
				rows.map((row) => `${row.getAttribute('data-place')}:${row.getAttribute('data-costume')}`)
			);

		// Best first; the two tied at the top share one place, and the next is third
		// because nobody finished second.
		expect(places.filter((row) => row.startsWith('1:'))).toHaveLength(2);
		expect(places.map((row) => row.split(':')[0])).toEqual(['1', '1', '3']);
		expect(places.join(' ')).toContain('Enigma');
		expect(places.join(' ')).toContain('Whiz Kid');

		// The places are on screen, not only in the markup.
		await expect(page.locator('[data-place-label]').first()).toHaveText('1');

		await operator.close();
	});

	test('sees nothing that belongs to the operator', async ({ browser }) => {
		// Two devices that look like one, so the operator's Board has a duplicate
		// warning on it. None of that may reach the room.
		const shared = { 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'SharedBrowser/1.0' };
		const one = await browser.newContext({ extraHTTPHeaders: shared });
		const two = await browser.newContext({ extraHTTPHeaders: shared });

		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { voting: 'Choose one to three.' });
		await fillEntries(browser, contestId, ENTRANCES);
		await openVoting(operatorPage, contestId);

		for (const context of [one, two]) {
			const voter = await context.newPage();
			await voter.goto(`/c/${contestId}`);
			await voter.getByLabel('Vote for Enigma').check();
			await voter.getByLabel('Vote for Whiz Kid').check();
			await voter.getByRole('button', { name: 'Send my ballot' }).click();
			await expect(voter.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
		}

		// The operator can see the warning, which is the point of collecting it.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-duplicates]')).toBeVisible();

		await operatorPage.getByRole('button', { name: 'Close voting' }).click();
		await operatorPage.getByRole('button', { name: 'Yes, close voting' }).click();
		await publish(operatorPage);

		// The audience sees the result and none of the machinery behind it.
		const page = await (await browser.newContext()).newPage();
		await openAudience(page, contestId);
		await expect(page.getByRole('heading', { name: 'The result' })).toBeVisible();

		const body = (await page.content()).replace(/\s+/g, ' ');
		expect(body).not.toContain('duplicate');
		expect(body).not.toContain('ballots cast');
		expect(body).not.toContain('data-duplicates');
		expect(body).not.toContain('advisory');
		expect(body).not.toContain('network');

		// And the operator area is not on the page at all.
		expect(body).not.toContain('Hide from the ballot');
		expect(body).not.toContain('Publish the result');

		await one.close();
		await two.close();
		await operator.close();
	});

	test('cannot see the standings before they are published', async ({ browser }) => {
		const { operator, contestId } = await finishedContest(browser);

		// Asked for directly, with no waiting page involved, the result is not there.
		const guest = await browser.newContext();
		const response = await guest.request.get(`/c/${contestId}`);
		expect(response.status()).toBe(200);

		const before = (await response.text()).replace(/\s+/g, ' ');
		expect(before).not.toContain('data-standings');
		expect(before).not.toContain('data-place=');

		// Nor does a device that voted get a shortcut to it.
		const voter = await browser.newContext();
		const voterPage = await voter.newPage();
		await voterPage.goto(`/c/${contestId}`);
		await voterPage.reload();
		await expect(voterPage.getByRole('heading', { name: 'The result' })).toHaveCount(0);

		await guest.close();
		await voter.close();
		await operator.close();
	});
});

test.describe('the operator', () => {
	test('publishes only on a deliberate second step, and never again', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await finishedContest(browser);

		// Publication is its own action, separate from closing voting.
		await expect(operatorPage.getByRole('button', { name: 'Publish the result' })).toBeVisible();

		await operatorPage.getByRole('button', { name: 'Publish the result' }).click();
		await expect(operatorPage.locator('[data-confirm-publish]')).toBeVisible();

		// And saying no puts it back, still private.
		await operatorPage.getByRole('link', { name: 'Not yet' }).click();
		await expect(operatorPage.locator('[data-confirm-publish]')).toHaveCount(0);
		await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Results');

		await publish(operatorPage);

		// Final: no way back, and no button offering one.
		await operatorPage.reload();
		await expect(operatorPage.getByRole('button', { name: 'Publish the result' })).toHaveCount(0);
		await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Published');

		// And a second publication is refused rather than re-stamping the first, which
		// is the only honest answer: there is nothing left to publish.
		expect(
			await postForm(operatorPage, `/admin/contests/${contestId}?/publish`, { confirm: 'publish' })
		).toMatchObject({ type: 'failure', status: 409 });

		await operator.close();
	});

	test('cannot publish before voting is closed', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { voting: 'Choose one to three.' });
		await fillEntries(browser, contestId, ENTRANCES.slice(0, 2));
		await openVoting(operatorPage, contestId);

		// Straight at the action, with the result still moving. The reason is asserted
		// on the page rather than in the response body: SvelteKit encodes a failure
		// payload, so reading it back as a plain object asserts the encoding.
		const refused = await postForm(operatorPage, `/admin/contests/${contestId}?/publish`, {
			confirm: 'publish'
		});
		expect(refused).toMatchObject({ type: 'failure', status: 409 });

		// Still voting, and the audience still gets a ballot rather than a result.
		// The message itself is asserted on the page only if it survives a fresh load,
		// which it does not: `form` is action-scoped, so a reload clears it. What is
		// durable — and what the operator would actually see — is that nothing moved.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-voting-open]')).toBeVisible();
		await expect(operatorPage.getByRole('button', { name: 'Close voting' })).toBeVisible();

		const page = await (await browser.newContext()).newPage();
		await openAudience(page, contestId);
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();

		await operator.close();
	});

	test('is asked to confirm rather than publishing on one click', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await finishedContest(browser);

		// A post with no confirmation is not a publication, so nothing moves.
		const bare = await postForm(operatorPage, `/admin/contests/${contestId}?/publish`, {});
		expect(bare).toMatchObject({ type: 'failure', status: 409 });

		const page = await (await browser.newContext()).newPage();
		await openAudience(page, contestId);
		await expect(page.getByRole('heading', { name: 'The result' })).toHaveCount(0);

		await operator.close();
	});

	test('cannot publish without a session', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await finishedContest(browser);

		const guest = await browser.newContext();
		const page = await guest.newPage();

		expect(
			await postForm(page, `/admin/contests/${contestId}?/publish`, { confirm: 'publish' })
		).toMatchObject({ type: 'redirect', status: 303, location: '/admin/login' });

		// Still private.
		await operatorPage.reload();
		await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Results');

		await guest.close();
		await operator.close();
	});
});
