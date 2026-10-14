import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
	ballotOrder,
	createContest,
	enter,
	fillEntries,
	openVoting,
	postForm,
	replayRegistration,
	signIn,
	type Entrance
} from '../../../../test/contest.js';

/** The operator's own words on the ballot, which the audience must be shown. */
const VOTING_NOTICE = 'Choose one to three costumes.';

const ENTRANCES: Entrance[] = [
	{ names: 'Alan Turing', costume: 'Enigma' },
	{ names: 'Mary Jackson', costume: 'Astronaut' },
	{ names: 'Dorothy Vaughan', costume: 'Whiz Kid' },
	{ names: 'Ada Lovelace, Grace Hopper', costume: 'Time travellers' },
	{ names: 'Katherine Johnson', costume: 'Glitter' },
	{ names: 'Annie Easley', costume: 'Bard' }
];

/** The costumes, for the tests that care about the grid rather than the people. */
const COSTUMES = ENTRANCES.map((entrance) => entrance.costume);

/** Checks the named costumes on the ballot this device is looking at. */
async function pick(page: Page, costumes: readonly string[]) {
	for (const costume of costumes) await page.getByLabel(`Vote for ${costume}`).check();
}

/** Waits for the ballot and returns the page, which is where every vote is cast from. */
async function openBallot(context: BrowserContext, contestId: string): Promise<Page> {
	const page = await context.newPage();
	await page.goto(`/c/${contestId}`);
	await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();
	return page;
}

/**
 * The identifier of one costume's Entry, as this device's ballot listed it. Read
 * from the ballot rather than invented, because what the audience could pick is
 * exactly what the ballot offers.
 */
async function entryIdFor(page: Page, costume: string): Promise<string> {
	const card = page.locator('[data-ballot-entry]').filter({ hasText: costume });
	await expect(card).toHaveCount(1);
	const id = await card.getAttribute('data-ballot-entry');
	if (id === null) throw new Error(`The ballot has no card for ${costume}.`);
	return id;
}

/** A Contest with real Entries in it, still taking registrations. */
async function contestWithEntries(
	browser: Browser,
	entrances: readonly Entrance[],
	notices: { registration?: string; voting?: string } = {}
) {
	const operator = await browser.newContext();
	const operatorPage = await operator.newPage();
	await signIn(operatorPage);
	const contestId = await createContest(operatorPage, notices);
	await fillEntries(browser, contestId, entrances);
	return { operator, operatorPage, contestId };
}

/** The same Contest with voting open, which is the state a ballot is cast from. */
async function contestReadyToVote(browser: Browser, entrances: readonly Entrance[] = ENTRANCES) {
	const setup = await contestWithEntries(browser, entrances, { voting: VOTING_NOTICE });
	await openVoting(setup.operatorPage, setup.contestId);
	return setup;
}

test.describe('an audience member', () => {
	test('is offered the ballot instead of the form once voting opens', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await contestReadyToVote(browser, [
			ENTRANCES[0],
			ENTRANCES[1]
		]);

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);

		// The one link, still: no second URL for the operator to send, and the
		// operator's own voting notice on the form that took the registration one.
		await expect(page.getByText(VOTING_NOTICE)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toHaveCount(0);
		await expect(page.getByLabel('Everyone in this costume')).toHaveCount(0);

		// Every costume with its names, its description and its photograph, which
		// this guest is now the first to be allowed to see.
		await expect(page.getByText('Alan Turing')).toBeVisible();
		await expect(page.getByText('Enigma')).toBeVisible();
		const photo = page.locator('[data-ballot-entry]').first().locator('img');
		await photo.evaluate((node: HTMLImageElement) => node.decode());
		expect(await photo.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(120);

		// One pick is a ballot, and it is final.
		await pick(page, ['Astronaut']);
		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		// Registration is no longer taken from this link. Posting the form again
		// anyway adds nothing, and the operator's list is unchanged.
		expect(
			await replayRegistration(guest, contestId, 'Someone Else', 'A late arrival')
		).toMatchObject({ type: 'redirect', status: 303 });

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-entry-id]')).toHaveCount(2);
		await expect(operatorPage.getByText('A late arrival')).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('sees the same order every time, and a different one on another device', async ({
		browser
	}) => {
		const { operator, contestId } = await contestReadyToVote(browser);

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);
		const first = await ballotOrder(page);
		expect(first).toHaveLength(COSTUMES.length);

		// Reloading is the obvious way to try for a better position, so the order
		// has to be the same every time — the seed was fixed on the first visit.
		for (let visit = 0; visit < 2; visit++) {
			await page.reload();
			await expect(page.locator('[data-ballot-entry]')).toHaveCount(COSTUMES.length);
			expect(await ballotOrder(page)).toEqual(first);
		}

		// And the order is shuffled rather than the order the Entries arrived in.
		expect(first).not.toEqual(COSTUMES);

		// Another device in the same room sees a different order, so position is
		// nobody's advantage. Six Entries: two devices agree by chance about once in
		// 720, which is not a rate to build a test on.
		const other = await browser.newContext();
		const otherPage = await openBallot(other, contestId);
		expect(await ballotOrder(otherPage)).not.toEqual(first);

		await guest.close();
		await other.close();
		await operator.close();
	});

	test('holds one, two or three picks, and is stopped at three', async ({ browser }) => {
		const { operator, contestId } = await contestReadyToVote(browser, ENTRANCES.slice(0, 4));

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);

		// Nothing picked is not a ballot, so the button waits for a first pick.
		await expect(page.getByRole('button', { name: 'Send my ballot' })).toBeDisabled();

		await pick(page, ['Enigma']);
		await expect(page.locator('[data-pick-count]')).toHaveText('1 of 3 picked');
		await expect(page.getByRole('button', { name: 'Send my ballot' })).toBeEnabled();

		// Two is allowed.
		await pick(page, ['Astronaut']);
		await expect(page.locator('[data-pick-count]')).toHaveText('2 of 3 picked');

		// Three is allowed, and then the fourth costume cannot be picked at all.
		await pick(page, ['Whiz Kid']);
		await expect(page.locator('[data-pick-count]')).toHaveText('3 of 3 picked');
		await expect(page.getByLabel('Vote for Time travellers')).toBeDisabled();

		// A pick can be changed while the ballot is open: taking one off frees the
		// fourth, and the count says so. The freed slot goes to that fourth rather
		// than back to the pick just removed.
		await page.getByLabel('Vote for Astronaut').uncheck();
		await expect(page.locator('[data-pick-count]')).toHaveText('2 of 3 picked');
		await expect(page.getByLabel('Vote for Time travellers')).toBeEnabled();

		await pick(page, ['Time travellers']);
		await expect(page.locator('[data-pick-count]')).toHaveText('3 of 3 picked');
		await expect(page.getByLabel('Vote for Astronaut')).toBeDisabled();
		await expect(page.getByLabel('Vote for Enigma')).toBeChecked();
		await expect(page.getByLabel('Vote for Whiz Kid')).toBeChecked();

		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('is refused a fourth pick and a repeated one, whatever the browser sends', async ({
		browser
	}) => {
		const { operator, contestId } = await contestReadyToVote(browser, ENTRANCES.slice(0, 4));

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);

		const enigma = await entryIdFor(page, 'Enigma');
		const astronaut = await entryIdFor(page, 'Astronaut');

		await pick(page, ['Enigma', 'Astronaut', 'Whiz Kid']);

		// The browser will not let a fourth pick be checked, so it is enabled by hand
		// and the form sent, exactly as a tampered client would send it.
		await page
			.getByLabel('Vote for Time travellers')
			.evaluate((node: HTMLInputElement) => node.removeAttribute('disabled'));
		await page.getByLabel('Vote for Time travellers').check();
		await page.getByRole('button', { name: 'Send my ballot' }).click();

		// The worker refuses it and says so on the page, and the ballot is still open
		// rather than spent: nothing was cast.
		await expect(page.getByText('A ballot holds at most 3 picks.')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toHaveCount(0);
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();

		// The same Entry named twice on one ballot is one pick, so repeating a pick
		// cannot inflate a costume — it is two picks here, not four, and the ballot
		// is accepted.
		const repeated = await postForm(page, `/c/${contestId}?/ballot`, {
			picks: [enigma, enigma, enigma, enigma, astronaut, astronaut]
		});
		expect(repeated).toMatchObject({ type: 'redirect', status: 303 });

		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('sees their own entry marked, outside the grid, and cannot vote for it', async ({
		browser
	}) => {
		// A guest who entered on this phone, voting on that same phone. Their own
		// costume is one no other device registered, so every assertion below can name
		// it without being ambiguous.
		const mine = { names: 'Katherine Johnson', costume: 'Poisoner' };
		const { operator, operatorPage, contestId } = await contestWithEntries(
			browser,
			ENTRANCES.slice(0, 3),
			{ voting: VOTING_NOTICE }
		);
		const guest = await browser.newContext();
		await enter(guest, contestId, mine.names, mine.costume);
		await openVoting(operatorPage, contestId);

		const page = await openBallot(guest, contestId);

		// Marked as theirs, and outside the shuffled grid rather than taking a slot a
		// costume they could have chosen would have taken.
		const own = page.locator('[data-own-entry]');
		await expect(own).toBeVisible();
		await expect(own.getByText('Yours — you cannot vote for it')).toBeVisible();
		await expect(own.getByText(mine.names)).toBeVisible();
		await expect(own.getByText(mine.costume)).toBeVisible();

		// Three Entries from other devices plus this one's own is four costumes in
		// the contest, and three cards: the Own entry took no slot in the grid.
		const inContest = 4;
		const votable = inContest - 1;
		await expect(page.locator('[data-ballot-entry]')).toHaveCount(votable);
		await expect(page.locator('[data-ballot-grid] [data-own-entry]')).toHaveCount(0);
		await expect(own.getByText(ENTRANCES[1].costume)).toHaveCount(0);

		// There is nothing to select on it, and every card that is left has a pick.
		await expect(page.locator('[data-ballot-entry] input[name="picks"]')).toHaveCount(votable);
		await expect(page.getByLabel(`Vote for ${mine.costume}`)).toHaveCount(0);

		// Posting the own entry anyway is refused too, and says why on the page.
		const ownId = await own.getAttribute('data-own-entry');
		const astronaut = await entryIdFor(page, 'Astronaut');
		const refused = await postForm(page, `/c/${contestId}?/ballot`, {
			picks: [astronaut, ownId ?? '']
		});
		expect(refused).toMatchObject({ type: 'failure', status: 400 });

		// Nothing was cast, and the Own entry is shown but still not offered.
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toHaveCount(0);
		await expect(page.getByLabel(`Vote for ${mine.costume}`)).toHaveCount(0);

		// And the costumes they could choose are still votable: entering the contest
		// does not stop this device from voting in it.
		await pick(page, ['Astronaut', 'Whiz Kid']);
		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('is shown nothing of their own entry once the operator has hidden it', async ({
		browser
	}) => {
		// The hiding device is the registering device, which is the case that is easy
		// to get wrong: the Own entry is normally pinned on the ballot marked "Yours",
		// and a Hidden Entry must be absent from the ballot entirely rather than
		// pinned there unselectable (story 42).
		const { operator, operatorPage, contestId } = await contestWithEntries(
			browser,
			ENTRANCES.slice(0, 3),
			{ voting: VOTING_NOTICE }
		);
		const mine = { names: 'Katherine Johnson', costume: 'Poisoner' };
		const guest = await browser.newContext();
		await enter(guest, contestId, mine.names, mine.costume);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		await operatorPage
			.locator('[data-entry-id]')
			.filter({ hasText: mine.costume })
			.getByRole('button', { name: 'Hide from the ballot' })
			.click();
		// Three Entries from other devices plus this guest's own is four in all.
		await expect(operatorPage.getByText('3 of 4 will be on the ballot.')).toBeVisible();

		await openVoting(operatorPage, contestId);

		const page = await openBallot(guest, contestId);

		// Absent, not shown unselectable: no pinned card, no name, no costume, and the
		// grid holds every Entry the operator left.
		await expect(page.locator('[data-own-entry]')).toHaveCount(0);
		await expect(page.getByText(mine.costume)).toHaveCount(0);
		await expect(page.getByText(mine.names)).toHaveCount(0);
		// Every Entry the operator left is on the grid — the three from other devices,
		// and not the guest's own, which is absent rather than pinned.
		await expect(page.locator('[data-ballot-entry]')).toHaveCount(3);
		await expect(page.locator('[data-ballot-entry]').filter({ hasText: mine.costume })).toHaveCount(
			0
		);

		// And their photograph is gone with it, rather than left as a broken image.
		const entryId = await operatorEntryId(operatorPage, contestId, mine.costume);
		expect((await page.request.get(`/c/${contestId}/entries/${entryId}/photo`)).status()).toBe(404);

		// They are still offered the ballot, because hiding an Entry is a clean act
		// and not a judgement on the guest who registered it.
		await pick(page, ['Enigma', 'Astronaut']);
		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('is recognised after voting, and cannot vote a second time', async ({ browser }) => {
		const { operator, contestId } = await contestReadyToVote(browser, ENTRANCES.slice(0, 3));

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);
		const enigma = await entryIdFor(page, 'Enigma');
		await pick(page, ['Enigma']);
		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		// Coming back later, they are shown that their vote is in rather than being
		// refused with an error or offered the ballot again.
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toHaveCount(0);
		await expect(page.locator('[data-ballot-entry]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Send my ballot' })).toHaveCount(0);

		// And a replayed post lands back on that same page: a cast ballot is final,
		// so the second post is not a second ballot and not an amended one.
		const replay = await postForm(page, `/c/${contestId}?/ballot`, {
			picks: [enigma, enigma, enigma, enigma]
		});
		expect(replay).toMatchObject({ type: 'redirect', status: 303, location: `/c/${contestId}` });

		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('cannot be shown a server error by sending the same ballot twice at once', async ({
		browser
	}) => {
		// The submit button is never disabled while a ballot is in flight, so a guest
		// on a slow connection can quite reasonably press it twice. Both posts pass the
		// "have you voted" check and reach the unique index together; the loser of that
		// race has voted, and must be told so rather than shown a server error.
		const { operator, contestId } = await contestReadyToVote(browser, ENTRANCES.slice(0, 3));

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);
		const enigma = await entryIdFor(page, 'Enigma');
		await pick(page, ['Enigma']);

		const raced = await Promise.all([
			postForm(page, `/c/${contestId}?/ballot`, { picks: [enigma] }),
			postForm(page, `/c/${contestId}?/ballot`, { picks: [enigma] })
		]);
		// Whichever order the worker saw them in, neither is a server error: the winner
		// cast a Ballot and the loser was recognised as having already cast one.
		for (const outcome of raced) expect(outcome.type).not.toBe('error');

		// Either way they are told their vote is in rather than shown a failure.
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		// And another guest can still vote, so the race cost nobody their ballot.
		const other = await browser.newContext();
		const otherPage = await openBallot(other, contestId);
		await pick(otherPage, ['Astronaut']);
		await otherPage.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(otherPage.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await guest.close();
		await other.close();
		await operator.close();
	});

	test('cannot land a ballot before voting opens, and cannot see the photographs', async ({
		browser
	}) => {
		const { operator, operatorPage, contestId } = await contestWithEntries(
			browser,
			ENTRANCES.slice(0, 2),
			{ voting: VOTING_NOTICE }
		);

		const guest = await browser.newContext();
		const page = await guest.newPage();
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toBeVisible();

		// Photographs of guests are a surprise until the ballot opens, so this is not
		// reachable during Registration however the path is guessed.
		const entryId = await operatorEntryId(operatorPage, contestId, ENTRANCES[0].costume);
		expect((await page.request.get(`/c/${contestId}/entries/${entryId}/photo`)).status()).toBe(404);

		// A ballot posted before voting opens is refused, and the guest is sent to
		// the link, which serves the form that is currently open rather than an error
		// about a ballot they were never offered.
		const early = await postForm(page, `/c/${contestId}?/ballot`, { picks: [entryId] });
		expect(early).toMatchObject({ type: 'redirect', status: 303, location: `/c/${contestId}` });

		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toHaveCount(0);

		// Nothing was recorded: once voting does open, this same device is offered a
		// ballot rather than being told its vote is in.
		await openVoting(operatorPage, contestId);
		const ballot = await openBallot(guest, contestId);
		await expect(ballot.getByRole('heading', { name: 'Your vote is in' })).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('is never shown an Entry the operator hid before voting opened', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await contestWithEntries(
			browser,
			ENTRANCES.slice(0, 3),
			{ voting: VOTING_NOTICE }
		);

		// Moderation is a clean act: the Entry leaves the ballot without anybody's
		// vote being touched, and is not shown as an unselectable card.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		const hidden = operatorPage.locator('[data-entry-id]').filter({ hasText: 'Whiz Kid' });
		await hidden.getByRole('button', { name: 'Hide from the ballot' }).click();
		await expect(operatorPage.getByText('2 of 3 will be on the ballot.')).toBeVisible();

		await openVoting(operatorPage, contestId);

		const guest = await browser.newContext();
		const page = await openBallot(guest, contestId);
		await expect(page.locator('[data-ballot-entry]')).toHaveCount(2);
		await expect(page.getByText('Whiz Kid')).toHaveCount(0);
		await expect(page.getByLabel('Vote for Whiz Kid')).toHaveCount(0);

		// The two that remain are votable, and the hidden one is not votable by
		// posting its identifier either.
		await pick(page, ['Enigma']);
		const hiddenId = await operatorEntryId(operatorPage, contestId, 'Whiz Kid');
		const enigma = await entryIdFor(page, 'Enigma');
		expect(
			await postForm(page, `/c/${contestId}?/ballot`, { picks: [enigma, hiddenId] })
		).toMatchObject({ type: 'failure', status: 400 });

		await page.goto(`/c/${contestId}`);
		await pick(page, ['Enigma', 'Astronaut']);
		await page.getByRole('button', { name: 'Send my ballot' }).click();
		await expect(page.getByRole('heading', { name: 'Your vote is in' })).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('is served the same photographs the operator has been looking at', async ({ browser }) => {
		// The photograph a guest sees is the same stored object the operator has
		// been looking at, so what is voted on is what was registered.
		const { operator, operatorPage, contestId } = await contestReadyToVote(
			browser,
			ENTRANCES.slice(0, 2)
		);

		const entryId = await operatorEntryId(operatorPage, contestId, ENTRANCES[0].costume);
		const guest = await browser.newContext();
		const page = await guest.newPage();

		const response = await page.request.get(`/c/${contestId}/entries/${entryId}/photo`);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('image/png');
		expect((await response.body()).length).toBeGreaterThan(0);

		// And an Entry that does not exist is not served, whatever the identifier.
		expect((await page.request.get(`/c/${contestId}/entries/not-an-entry/photo`)).status()).toBe(
			404
		);

		await guest.close();
		await operator.close();
	});
});

test.describe('the operator', () => {
	test('opens voting in one action, and the contest link follows', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await contestWithEntries(
			browser,
			ENTRANCES.slice(0, 2),
			{ registration: 'Enter alone or as a group.', voting: VOTING_NOTICE }
		);

		const guest = await browser.newContext();
		const page = await guest.newPage();
		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toBeVisible();
		await expect(page.getByText('Enter alone or as a group.')).toBeVisible();

		// One action closes registration and opens voting.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.getByRole('button', { name: /open voting/ })).toBeVisible();
		await operatorPage.getByRole('button', { name: /open voting/ }).click();
		await expect(operatorPage.locator('[data-voting-open]')).toBeVisible();

		// The entry list is frozen the moment voting opens, which is what stops a
		// costume vanishing from a ballot that has already been cast. Frozen means the
		// control is gone, not merely inert: a disabled button is one a tired operator
		// clicks anyway.
		await expect(operatorPage.getByRole('button', { name: 'Hide from the ballot' })).toHaveCount(0);
		await expect(operatorPage.getByText('The list is frozen while voting is open.')).toBeVisible();

		// Same link, different form: nobody has to be told a second URL.
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Pick your favourites' })).toBeVisible();
		await expect(page.getByText(VOTING_NOTICE)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toHaveCount(0);

		// The action is not offered a second time, because voting is already open.
		await operatorPage.reload();
		await expect(operatorPage.getByRole('button', { name: /open voting/ })).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('cannot open voting without a session', async ({ browser }) => {
		const { operator, operatorPage, contestId } = await contestWithEntries(
			browser,
			ENTRANCES.slice(0, 1)
		);

		// The action runs before the layout's guard, so posting straight at it is
		// the only way in that a browser cannot take.
		const guest = await browser.newContext();
		const page = await guest.newPage();
		expect(await postForm(page, `/admin/contests/${contestId}?/openVoting`, {})).toMatchObject({
			type: 'redirect',
			status: 303,
			location: '/admin/login'
		});

		// Still taking registrations: nothing moved.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		await expect(operatorPage.locator('[data-voting-open]')).toHaveCount(0);
		await expect(operatorPage.getByRole('button', { name: /open voting/ })).toBeVisible();

		await page.goto(`/c/${contestId}`);
		await expect(page.getByRole('heading', { name: 'Enter the contest' })).toBeVisible();

		await guest.close();
		await operator.close();
	});
});

/** One Entry's identifier, read from the operator's list rather than invented. */
async function operatorEntryId(page: Page, contestId: string, costume: string): Promise<string> {
	await page.goto(`/admin/contests/${contestId}`);
	const entry = page.locator('[data-entry-id]').filter({ hasText: costume });
	await expect(entry).toHaveCount(1);
	const id = await entry.getAttribute('data-entry-id');
	if (id === null) throw new Error(`The operator's list has no entry for ${costume}.`);
	return id;
}
