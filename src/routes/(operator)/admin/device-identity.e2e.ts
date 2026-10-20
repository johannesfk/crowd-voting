import { expect, test } from '@playwright/test';
import { ballotOrder, createContest, enter, openVoting, signIn } from '../../../../test/contest.js';

/**
 * One browser, several Contests.
 *
 * A device is one row per browser *per Contest* (spec, Data model), and the cookie that
 * names it has to be scoped the same way. Scoped to `/c`, one browser held one token for
 * every Contest it had ever opened, so opening a second Contest overwrote the first —
 * and coming back to the first minted a new device: the guest's own Entry stopped being
 * theirs, their ballot order was reshuffled, and a Ballot they had already cast was
 * forgotten. Story 5 (several Contests at once) makes a guest touching two of them
 * ordinary, so all three of those followed from opening a second link.
 */
test.describe('a guest with two Contests to hand', () => {
	test('keeps its own device, Entry, shuffle and cast ballot per Contest', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);

		const first = await createContest(operatorPage);
		const second = await createContest(operatorPage);

		// One browser registers in both Contests. Under a single shared cookie the second
		// registration is what overwrote the first Contest's token.
		const guest = await browser.newContext();
		await enter(guest, first, 'Ada Lovelace', 'Time travellers');
		await enter(guest, second, 'Alan Turing', 'Enigma');

		// Somebody else's Entry on the first Contest, so there is something to vote for
		// besides the guest's own (which the ballot pins and makes unselectable).
		const other = await browser.newContext();
		await enter(other, first, 'Grace Hopper', 'Aeronaut');

		// Both tokens are held at once, each scoped to its own Contest.
		const deviceCookies = (await guest.cookies()).filter((cookie) => cookie.name === 'cv_device');
		expect(deviceCookies.map((cookie) => cookie.path).sort()).toEqual(
			[`/c/${first}`, `/c/${second}`].sort()
		);

		await openVoting(operatorPage, first);

		const page = await guest.newPage();
		await page.goto(`/c/${first}`);
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();

		// The own Entry is still theirs, and the order they were given is the order they
		// keep — the shuffles are derived from a seed fixed on the device, so a new device
		// would show a new order.
		await expect(page.locator('[data-own-entry]')).toBeVisible();
		const before = await ballotOrder(page);

		// Opening the other Contest in between is the whole point of the test.
		await page.goto(`/c/${second}`);
		await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();

		await page.goto(`/c/${first}`);
		await expect(page.locator('[data-own-entry]')).toBeVisible();
		expect(await ballotOrder(page)).toEqual(before);

		// Cast the ballot on the first Contest, then spend time in the second one again.
		await page.getByLabel('Vote for Aeronaut').check();
		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await page.goto(`/c/${second}`);
		await expect(page.getByRole('heading', { name: 'You are in' })).toBeVisible();

		// Back on the first: the Ballot is still cast. A forgotten device would be offered
		// the ballot again, which is a guest voting twice with one phone.
		await page.goto(`/c/${first}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toHaveCount(0);

		await other.close();

		await guest.close();
		await operator.close();
	});
});
