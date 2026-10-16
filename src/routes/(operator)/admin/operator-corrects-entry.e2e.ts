import { expect, test, type Locator } from '@playwright/test';
import {
	createContest,
	enter,
	openVoting,
	photo,
	postForm,
	signIn
} from '../../../../test/contest.js';

/**
 * The control that opens the Correction form, which is the one act on this list that
 * is not a moderation act: it asks what the Entry should say, rather than whether it
 * is on the ballot at all.
 */
function correctToggle(entry: Locator): Locator {
	return entry.getByRole('link', { name: 'Correct this Entry' });
}

/**
 * The width the browser actually stored, which is the only honest way to see whether a
 * photo was replaced or left alone.
 */
async function storedWidth(entry: Locator): Promise<number> {
	const image = entry.locator('img');
	await expect(image).toBeVisible();
	await image.evaluate((node: HTMLImageElement) => node.decode());
	return image.evaluate((node: HTMLImageElement) => node.naturalWidth);
}

test.describe('the operator', () => {
	test('corrects a misspelled name and a mislabelled costume', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		// A group of three, entered by one device, with a photo small enough that the
		// browser leaves it alone — so what is stored afterwards is what was uploaded.
		const guest = await browser.newContext();
		await enter(
			guest,
			contestId,
			'Ada Lovelace, Allan Turing, Grace Hopper',
			'Time travellers',
			photo({ width: 240, height: 180, noise: false })
		);

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entry = operatorPage.locator('[data-entry-id]');
		await expect(entry.getByText('Ada Lovelace, Allan Turing, Grace Hopper')).toBeVisible();

		await correctToggle(entry).click();

		// Every Participant is a box of their own, in the order they were typed, and the
		// costume is corrected in the same place.
		await entry.getByLabel('Person 2').fill('Alan Turing');
		await entry.getByLabel('What this Entry is dressed up as').fill('Chrononauts');
		await entry.getByRole('button', { name: 'Save the correction' }).click();

		// The list shows the corrected set of names and not what it replaced: a
		// Correction is not an addition, and this is still the one Entry there was.
		await expect(entry.getByText('Ada Lovelace, Alan Turing, Grace Hopper')).toBeVisible();
		await expect(entry.getByText('Allan Turing')).toHaveCount(0);
		await expect(entry.getByText('Chrononauts')).toBeVisible();
		await expect(entry.getByText('Time travellers')).toHaveCount(0);
		await expect(operatorPage.getByText('1 of 1 will be on the ballot.')).toBeVisible();

		// The photograph is the guest's and was left alone: 240 pixels in, 240 out.
		expect(await storedWidth(entry)).toBe(240);

		// The registering device is still the registering device. Their link still reads
		// as an Entry already made — a Correction that moved the Entry onto another
		// device would offer them the form again — and no second Entry appeared anywhere.
		const guestPage = await guest.newPage();
		await guestPage.goto(`/c/${contestId}`);
		await expect(guestPage.getByRole('heading', { name: 'You are in' })).toBeVisible();

		// And the guest reads the corrected names, because their confirmation reads them
		// off the Entry rather than off a copy taken when they registered.
		await expect(guestPage.getByText('Ada Lovelace, Alan Turing, Grace Hopper')).toBeVisible();
		await expect(guestPage.getByText('Chrononauts')).toBeVisible();

		await operatorPage.reload();
		await expect(operatorPage.locator('[data-entry-id]')).toHaveCount(1);

		await guest.close();
		await operator.close();
	});

	test('corrects who is in a group without disturbing the others', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Ada Lovelace, Allan Turing', 'Time travellers');

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entry = operatorPage.locator('[data-entry-id]');
		await correctToggle(entry).click();

		await entry.getByRole('button', { name: 'Add a person' }).click();
		await entry.getByLabel('Person 3').fill('Katherine Johnson');
		await entry.getByRole('button', { name: 'Save the correction' }).click();

		// The new person joins at the end and the two already on the Entry stay on the
		// positions they were typed at: a Correction is not a reordering.
		await expect(entry.getByText('Ada Lovelace, Allan Turing, Katherine Johnson')).toBeVisible();

		// Clearing the last box takes that person off. No button of their own to find,
		// which is what lets removal work before the page has finished loading.
		await correctToggle(entry).click();
		await entry.getByLabel('Person 3').fill('');
		await entry.getByRole('button', { name: 'Save the correction' }).click();
		await expect(entry.getByText('Ada Lovelace, Allan Turing')).toBeVisible();
		await expect(entry.getByText('Katherine Johnson')).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('is told when a Correction would leave nobody on the Entry', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Ada Lovelace', 'Time travellers');

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entry = operatorPage.locator('[data-entry-id]');
		await correctToggle(entry).click();
		await entry.getByLabel('Person 1').fill('');
		await entry.getByRole('button', { name: 'Save the correction' }).click();

		// An Entry is contributed by one or more Participants, so a Correction that
		// empties the list is refused with what was typed still in the boxes.
		await expect(entry.getByRole('alert')).toContainText('at least one person');
		await expect(entry.getByLabel('Person 1')).toBeVisible();

		await guest.close();
		await operator.close();
	});

	test('cannot Correct an Entry without a session', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Ada Lovelace', 'Time travellers');

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entryId = await operatorPage.locator('[data-entry-id]').getAttribute('data-entry-id');
		if (entryId === null) throw new Error('The entry has no identifier.');

		// The action runs before the layout's guard, so posting straight at it is the only
		// way in that a browser cannot take.
		const stranger = await browser.newContext();
		expect(
			await postForm(stranger, `/admin/contests/${contestId}?/correct`, {
				entryId,
				costume: 'Not this one',
				name: ['Somebody Else']
			})
		).toMatchObject({ type: 'redirect', status: 303, location: '/admin/login' });

		// Nothing was corrected.
		await operatorPage.reload();
		const entry = operatorPage.locator('[data-entry-id]');
		await expect(entry.getByText('Time travellers')).toBeVisible();
		await expect(entry.getByText('Not this one')).toHaveCount(0);

		await stranger.close();
		await guest.close();
		await operator.close();
	});

	test('cannot Correct an Entry once the Contest has left Registration', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Ada Lovelace, Allan Turing', 'Time travellers');
		await openVoting(operatorPage, contestId);

		const entryId = await operatorPage.locator('[data-entry-id]').getAttribute('data-entry-id');
		if (entryId === null) throw new Error('The entry has no identifier.');

		// Straight at the action, with the ballot live: the same edge the Entry list
		// freezes at, because a costume that changed after a ballot had been cast would
		// leave that ballot pointing at something nobody voted for.
		expect(
			await postForm(operatorPage, `/admin/contests/${contestId}?/correct`, {
				entryId,
				costume: 'Chrononauts',
				name: ['Ada Lovelace', 'Alan Turing']
			})
		).toMatchObject({ type: 'failure', status: 409 });

		// Nothing moved, and the control to try again is not offered at all. Scoped to
		// the Entry, because the Board is showing the same costume beside it now that
		// voting is open.
		await operatorPage.reload();
		const entry = operatorPage.locator('[data-entry-id]');
		await expect(entry.getByText('Time travellers')).toBeVisible();
		await expect(entry.getByText('Chrononauts')).toHaveCount(0);
		await expect(correctToggle(entry)).toHaveCount(0);

		await guest.close();
		await operator.close();
	});

	test('is told a Correction is too late once voting opens under them', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Ada Lovelace, Allan Turing', 'Time travellers');

		// The operator opens the Correction, and while the form is open the Contest moves
		// on — which happens on this same page, one form further down, and so can happen
		// from a second tab the operator already has open.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entry = operatorPage.locator('[data-entry-id]');
		await correctToggle(entry).click();
		await entry.getByLabel('Person 2').fill('Alan Turing');

		const otherTab = await operator.newPage();
		await openVoting(otherTab, contestId);

		// They then save the Correction they were already looking at.
		await operatorPage.getByRole('button', { name: 'Save the correction' }).click();

		// Told in the Correction's own words. The generic "the list is frozen" message is
		// what the Hide control says, and an operator who pressed Save would go looking for
		// the button they had just pressed.
		await expect(operatorPage.locator('[data-correction-refused]')).toContainText(
			'Nothing has been changed'
		);

		// And the Entry is exactly as registered, names included.
		await operatorPage.goto(`/admin/contests/${contestId}`);
		const after = operatorPage.locator('[data-entry-id]');
		await expect(after.getByText('Ada Lovelace, Allan Turing')).toBeVisible();
		await expect(after.getByText('Alan Turing', { exact: true })).toHaveCount(0);
		await otherTab.close();

		await guest.close();
		await operator.close();
	});

	test('is given no way to take a Correction back', async ({ browser }) => {
		const operator = await browser.newContext();
		const operatorPage = await operator.newPage();
		await signIn(operatorPage);
		const contestId = await createContest(operatorPage);

		const guest = await browser.newContext();
		await enter(guest, contestId, 'Ada Lovelace, Allan Turing', 'Time travellers');

		await operatorPage.goto(`/admin/contests/${contestId}`);
		const entry = operatorPage.locator('[data-entry-id]');
		await correctToggle(entry).click();
		await entry.getByLabel('Person 2').fill('Alan Turing');
		await entry.getByLabel('What this Entry is dressed up as').fill('Chrononauts');
		await entry.getByRole('button', { name: 'Save the correction' }).click();
		await expect(entry.getByText('Ada Lovelace, Alan Turing')).toBeVisible();

		// A Correction is as final as the registration it replaces. There is no control
		// anywhere on the Entry to put it back, and opening the form again shows the
		// corrected names rather than anything to compare them with: the Entry keeps no
		// history, so the only way back is another Correction.
		await expect(entry.getByRole('button', { name: /undo|revert|restore/i })).toHaveCount(0);
		await correctToggle(entry).click();
		await expect(entry.getByLabel('Person 1')).toHaveValue('Ada Lovelace');
		await expect(entry.getByLabel('Person 2')).toHaveValue('Alan Turing');
		await expect(entry.getByLabel('What this Entry is dressed up as')).toHaveValue('Chrononauts');

		// Hiding is still reachable while a Correction is open, because they are two
		// decisions rather than one and an operator who has noticed both should not have to
		// abandon the typo to act on the second.
		await expect(entry.getByRole('button', { name: 'Hide from the ballot' })).toBeVisible();

		// The photograph is still the guest's own, at the size it was uploaded: the one
		// thing a Correction is never allowed to reach.
		expect(await storedWidth(entry)).toBe(120);

		await guest.close();
		await operator.close();
	});
});
