import { expect, test } from '@playwright/test';
import {
	createContest,
	fillBallots,
	fillEntries,
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

/** A Contest with three Entries, voting open, and no ballots cast yet. */
async function votingContest(browser: import('@playwright/test').Browser) {
	const operator = await browser.newContext();
	const operatorPage = await operator.newPage();
	await signIn(operatorPage);
	const contestId = await createContest(operatorPage, { voting: 'Choose one to three.' });
	await fillEntries(browser, contestId, ENTRANCES);
	await openVoting(operatorPage, contestId);
	return { operator, operatorPage, contestId };
}

/** One standing's place, votes and costume, as the operator can read them. */
async function standing(
	page: import('@playwright/test').Page,
	costume: string
): Promise<{ place: string; votes: string }> {
	const row = page.locator('[data-standing]').filter({ hasText: costume });
	await expect(row).toHaveCount(1);
	return {
		place: (await row.getAttribute('data-place')) ?? '',
		votes: (await row.locator('[data-votes]').innerText()).trim()
	};
}

test.describe('the operator', () => {
	test('watches the Board fill up as ballots arrive, without reloading', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-board]')).toBeVisible();
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('0 ballots cast.');

		// One device, one pick. The Board is open on screen the whole time and is
		// never reloaded, so the count can only have arrived through the live query.
		const first = await browser.newContext();
		await first.close();
		const guest = await browser.newContext();
		const voter = await (async () => {
			const page = await guest.newPage();
			await page.goto(`/c/${contestId}`);
			await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();
			await page.getByLabel('Vote for Enigma').check();
			await page.getByRole('button', { name: 'Send my ballot' }).click();
			await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
			return page;
		})();

		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('1 ballot cast.');
		expect(await standing(operatorPage, 'Enigma')).toEqual({ place: '1', votes: '1' });

		// A second and third device, each voting as they go.
		const second = await browser.newContext();
		const secondPage = await second.newPage();
		await secondPage.goto(`/c/${contestId}`);
		await secondPage.getByLabel('Vote for Enigma').check();
		await secondPage.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(secondPage.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('2 ballots cast.');
		expect(await standing(operatorPage, 'Enigma')).toEqual({ place: '1', votes: '2' });

		await second.close();
		await guest.close();
		await operator.close();
		expect(voter.url()).toContain(`/c/${contestId}`);
	});

	test('sees the standings ordered by count, and a tie sharing one place', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);

		// Enigma twice, Whiz Kid twice, Aeronaut once — a tie at the top, which is the
		// normal shape of a small room and the case that must not invent a winner.
		await fillBallots(browser, contestId, [
			['Enigma', 'Whiz Kid'],
			['Enigma', 'Whiz Kid'],
			['Aeronaut']
		]);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('3 ballots cast.');

		// Best first. Enigma and Whiz Kid share first place, and the next Entry down is
		// third, because nobody finished second.
		const order = await operatorPage
			.locator('[data-standing]')
			.evaluateAll((rows) =>
				rows.map(
					(row) => `${row.getAttribute('data-place')}:${row.textContent?.trim().slice(0, 8)}`
				)
			);
		expect(order[0]).toMatch(/^1:/);
		expect(order[1]).toMatch(/^1:/);
		expect(order[2]).toMatch(/^3:/);

		expect(await standing(operatorPage, 'Enigma')).toEqual({ place: '1', votes: '2' });
		expect(await standing(operatorPage, 'Whiz Kid')).toEqual({ place: '1', votes: '2' });
		expect(await standing(operatorPage, 'Aeronaut')).toEqual({ place: '3', votes: '1' });

		await operator.close();
	});

	test('shows an Entry nobody voted for, rather than leaving a hole', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);
		await fillBallots(browser, contestId, [['Enigma']]);

		await operatorPage.goto(`/admin/contests/${contestId}`);

		// The operator's most useful sight during a party is a costume nobody picked.
		await expect(operatorPage.locator('[data-standing]')).toHaveCount(3);
		expect(await standing(operatorPage, 'Aeronaut')).toEqual({ place: '2', votes: '0' });

		await operator.close();
	});

	test('is warned when two ballots look like one device, and refuses nothing', async ({
		browser
	}) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);

		// Two Ballots from different devices that arrived with the same headers and
		// picked the same two Entries — the shape a duplicate produces.
		//
		// `cf-connecting-ip` is the header the worker reads first, so that is the one
		// set; `x-forwarded-for` alone would be ignored behind a real proxy.
		const shared = { 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'SharedBrowser/1.0' };
		const one = await browser.newContext({ extraHTTPHeaders: shared });
		const two = await browser.newContext({ extraHTTPHeaders: shared });
		await fillBallotsFrom(one, contestId, ['Enigma', 'Whiz Kid']);
		await fillBallotsFrom(two, contestId, ['Enigma', 'Whiz Kid']);

		await operatorPage.goto(`/admin/contests/${contestId}`);

		// Warned about, and told plainly that nothing was refused.
		const warning = operatorPage.locator('[data-duplicates]');
		await expect(warning).toBeVisible();
		await expect(warning).toContainText('2 devices');
		await expect(warning).toContainText('Nothing has been refused');

		// And both ballots counted, which is the other half of "advisory only": a
		// warning the operator cannot act on would not be worth showing.
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('2 ballots cast.');

		await one.close();
		await two.close();
		await operator.close();
	});

	test('cannot see the Board without a session', async ({ browser }) => {
		const { operator, contestId } = await votingContest(browser);
		await fillBallots(browser, contestId, [['Enigma']]);

		const guest = await browser.newContext();
		const page = await guest.newPage();

		// The layout guard sends an unauthenticated visitor to the login screen, and
		// the standings must not be anywhere in what they got.
		await page.goto(`/admin/contests/${contestId}`);
		await expect(page).toHaveURL(/\/admin\/login$/);
		const body = await page.content();
		expect(body).not.toContain('data-board');
		expect(body).not.toContain('data-standing');
		expect(body).not.toContain('ballots cast');

		await guest.close();
		await operator.close();
	});

	test('closes voting only on a deliberate second step, and never again', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);
		await fillBallots(browser, contestId, [['Enigma'], ['Enigma']]);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-voting-open]')).toBeVisible();

		// The first click asks rather than acts, because this cannot be undone.
		await operatorPage.getByRole('button', { name: 'Close voting' }).click();
		await expect(operatorPage.locator('[data-confirm-close]')).toBeVisible();
		await expect(operatorPage.locator('[data-voting-open]')).toBeVisible();

		// And saying no puts it back.
		await operatorPage.getByRole('link', { name: 'Keep voting open' }).click();
		await expect(operatorPage.locator('[data-confirm-close]')).toHaveCount(0);
		await expect(operatorPage.locator('[data-voting-open]')).toBeVisible();

		// Saying yes closes it.
		await operatorPage.getByRole('button', { name: 'Close voting' }).click();
		await operatorPage.getByRole('button', { name: 'Yes, close voting' }).click();

		await expect(operatorPage.locator('[data-voting-open]')).toHaveCount(0);
		await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Results');

		// Final: there is no way back, and no button offering one.
		await operatorPage.reload();
		await expect(operatorPage.getByRole('button', { name: 'Close voting' })).toHaveCount(0);
		await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Results');

		// The Board is still there, because the operator is the one who publishes and
		// presents this result — but frozen, and saying so rather than claiming to be
		// live while nothing can move.
		await expect(operatorPage.locator('[data-board]')).toBeVisible();
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('2 ballots cast.');
		await expect(operatorPage.getByText('Voting is closed, so these are final.')).toBeVisible();
		expect(await standing(operatorPage, 'Enigma')).toEqual({ place: '1', votes: '2' });

		await operator.close();
	});

	test('has the last word: no ballot lands once voting is closed', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);
		await fillBallots(browser, contestId, [['Enigma']]);

		// A guest who had the ballot open all evening, and only pressed send after it
		// closed. Their Entry identifier is the only thing they could have picked.
		const latecomer = await browser.newContext();
		const page = await latecomer.newPage();
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await operatorPage.getByRole('button', { name: 'Close voting' }).click();
		await operatorPage.getByRole('button', { name: 'Yes, close voting' }).click();
		await expect(operatorPage.locator('[data-contest-phase]')).toContainText('Results');

		// Straight at the action, as a stale page would post it.
		const refused = await postForm(page, `/c/${contestId}?/ballot`, { picks: ['anything'] });
		expect(refused).toMatchObject({
			type: 'redirect',
			status: 303,
			location: `/c/${contestId}`
		});

		// Sent onwards rather than shown an error, and the link serves the phase it is
		// in now — not a ballot that would silently swallow it.
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Voting has closed' })).toBeVisible();

		// And the total the operator saw is the total that stands.
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('1 ballot cast.');

		await latecomer.close();
		await operator.close();
	});

	test('is warned before opening voting with nothing to vote on', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { voting: 'Choose one to three.' });
		await fillEntries(browser, contestId, ENTRANCES.slice(0, 1));

		// Hide the only Entry there is.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		await operatorPage
			.locator('[data-entry-id]')
			.getByRole('button', { name: 'Hide from the ballot' })
			.click();
		await expect(operatorPage.getByText('0 of 1 will be on the ballot.')).toBeVisible();

		await operatorPage.getByRole('button', { name: 'Close registration and open voting' }).click();

		// Warned, and voting is still closed: the operator is asked, not stopped by an
		// error page, and nothing has moved.
		await expect(operatorPage.locator('[data-nothing-to-vote]')).toBeVisible();
		await expect(operatorPage.locator('[data-voting-open]')).toHaveCount(0);
		await expect(
			operatorPage.getByRole('button', { name: 'Close registration and open voting' })
		).toBeVisible();

		await operator.close();
	});

	test('is not warned about a room sharing a network but using different phones', async ({
		browser
	}) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);

		// One access point, two different browsers, both voting the same way. This is
		// what an ordinary party looks like, so saying nothing is the whole point of
		// requiring both signals before warning.
		await fillBallotsFrom(
			await browser.newContext({
				extraHTTPHeaders: { 'cf-connecting-ip': '198.51.100.4', 'user-agent': 'PhoneA/1.0' }
			}),
			contestId,
			['Enigma', 'Whiz Kid']
		);
		await fillBallotsFrom(
			await browser.newContext({
				extraHTTPHeaders: { 'cf-connecting-ip': '198.51.100.4', 'user-agent': 'PhoneB/1.0' }
			}),
			contestId,
			['Enigma', 'Whiz Kid']
		);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-board]')).toBeVisible();
		await expect(operatorPage.locator('[data-duplicates]')).toHaveCount(0);
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('2 ballots cast.');

		await operator.close();
	});

	test('is not warned about two phones of the same kind in different places', async ({
		browser
	}) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);

		// Same browser, different networks. Two people on the same model of phone, which
		// matches on the recorded fingerprint and means nothing at all.
		for (const address of ['198.51.100.7', '203.0.113.11']) {
			await fillBallotsFrom(
				await browser.newContext({
					extraHTTPHeaders: { 'cf-connecting-ip': address, 'user-agent': 'SamePhone/1.0' }
				}),
				contestId,
				['Enigma', 'Whiz Kid']
			);
		}

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-duplicates]')).toHaveCount(0);
		await expect(operatorPage.locator('[data-ballot-total]')).toHaveText('2 ballots cast.');

		await operator.close();
	});

	test('is warned before opening voting on a contest nobody entered', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage, { voting: 'Choose one to three.' });

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await operatorPage.getByRole('button', { name: 'Close registration and open voting' }).click();

		await expect(operatorPage.locator('[data-nothing-to-vote]')).toBeVisible();
		await expect(operatorPage.locator('[data-voting-open]')).toHaveCount(0);

		await operator.close();
	});

	test('cannot close voting, or open it, without a session', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await votingContest(browser);

		const guest = await browser.newContext();
		const page = await guest.newPage();

		for (const action of ['openVoting', 'closeVoting']) {
			expect(
				await postForm(page, `/admin/contests/${contestId}?/${action}`, { confirm: 'close' })
			).toMatchObject({ type: 'redirect', status: 303, location: '/admin/login' });
		}

		// Nothing moved.
		await operatorPage.reload();
		await expect(operatorPage.locator('[data-voting-open]')).toBeVisible();

		await guest.close();
		await operator.close();
	});
});

/** Casts one Ballot from an existing context, for the shared-signal cases above. */
async function fillBallotsFrom(
	context: import('@playwright/test').BrowserContext,
	contestId: string,
	costumes: readonly string[]
) {
	const page = await context.newPage();
	await page.goto(`/c/${contestId}`);
	await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();
	for (const costume of costumes) await page.getByLabel(`Vote for ${costume}`).check();
	await page.getByRole('button', { name: 'Send my ballot' }).click();
	await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
	return page;
}
