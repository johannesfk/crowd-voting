import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * The operator password is a deployment secret: production takes it from
 * `wrangler secret put`, local runs from `.dev.vars`. The suite reads the same file
 * the worker does rather than hardcoding a password.
 */
if (existsSync('.dev.vars')) process.loadEnvFile('.dev.vars');

const password = process.env.OPERATOR_PASSWORD;
if (!password) {
	throw new Error(
		'No operator password: set OPERATOR_PASSWORD or copy .dev.vars.example to .dev.vars.'
	);
}

test.describe('the operator', () => {
	test('cannot reach the admin area without signing in', async ({ page }) => {
		await page.goto('/admin/contests/new');

		await expect(page).toHaveURL(/\/admin\/login$/);
		await expect(page.getByRole('heading', { name: 'Operator sign-in' })).toBeVisible();
		// The contest form and any Contest data must not be in the response.
		await expect(page.getByRole('heading', { name: 'New Contest' })).toHaveCount(0);
	});

	test('cannot create a Contest by posting the form without a session', async ({ page }) => {
		// The action runs before the layout's guard, so posting straight at the
		// action is the only way in that a browser cannot take. It must be refused.
		const stamp = Date.now().toString(36);
		const title = `Uninvited ${stamp}`;
		const baseURL = test.info().project.use.baseURL ?? 'http://localhost:4173';

		// A browser posts a plain form to the page's own URL, which is exactly what
		// an attacker's own client can do too. The origin header is the one part of
		// a real post that SvelteKit checks for us; the session is ours to check.
		const response = await page.request.post('/admin/contests/new', {
			form: { title, description: 'This must never be written.' },
			headers: { origin: baseURL }
		});

		// Redirected to the login screen rather than allowed to create anything.
		const result = await response.json();
		expect(result).toMatchObject({ type: 'redirect', status: 303, location: '/admin/login' });

		// And nothing was written, which the signed-in list confirms.
		await page.goto('/admin/login');
		await page.getByLabel('Shared password').fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('heading', { name: 'Contests' })).toBeVisible();
		await expect(page.locator('[data-contest-id]').filter({ hasText: title })).toHaveCount(0);
	});

	test('signs in with the shared password', async ({ page }) => {
		await page.goto('/admin');
		await expect(page.getByRole('heading', { name: 'Operator sign-in' })).toBeVisible();

		// A wrong password leaves them outside, with the form and its error kept.
		await page.getByLabel('Shared password').fill('not-the-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByText('That password did not unlock the operator area.')).toBeVisible();
		await expect(page).toHaveURL(/\/admin\/login$/);

		// The right one brings them to the Contest list.
		await page.getByLabel('Shared password').fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page.getByRole('heading', { name: 'Contests' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

		// An operator-only page is never stored by any cache on the way, so a
		// shared cache cannot serve one Contest list to the next guest.
		const reloaded = await page.reload();
		expect(reloaded?.headers()['cache-control']).toBe('no-store');
	});

	test('creates Contests, with the optional notices left empty', async ({ page }) => {
		// Titles are unique per run so the local database, which outlives the suite,
		// cannot make the assertions flaky.
		const stamp = Date.now().toString(36);
		const first = `Halloween party ${stamp}`;
		const second = `Freshers week ${stamp}`;

		await page.goto('/admin/login');
		await page.getByLabel('Shared password').fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.getByRole('heading', { name: 'Contests' })).toBeVisible();

		await page.getByRole('link', { name: 'New Contest' }).click();
		await expect(page.getByRole('heading', { name: 'New Contest' })).toBeVisible();

		// Both notices are deliberately left blank.
		await page.getByLabel('Title').fill(first);
		await page.getByLabel('Description').fill('One night, every costume on campus.');
		await page.getByRole('button', { name: 'Create Contest' }).click();

		await expect(page.getByRole('heading', { name: 'Contests' })).toBeVisible();
		const contest = page.locator('[data-contest-id]').filter({ hasText: first });
		await expect(contest).toBeVisible();
		await expect(contest.getByText('Registration')).toBeVisible();
		// The identifier is unguessable rather than derived from the title.
		const id = await contest.getAttribute('data-contest-id');
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(id).not.toContain('halloween');

		// A second Contest, with the notices set this time, so several live at once.
		await page.getByRole('link', { name: 'New Contest' }).click();
		await page.getByLabel('Title').fill(second);
		await page.getByLabel('Description').fill('A whole week of dressing up.');
		await page.getByLabel('Note for people signing up').fill('Enter alone or as a group.');
		await page.getByLabel('Note for people voting').fill('Choose one to three costumes.');
		await page.getByRole('button', { name: 'Create Contest' }).click();

		await expect(page.locator('[data-contest-id]').filter({ hasText: second })).toBeVisible();
		await expect(page.locator('[data-contest-id]').filter({ hasText: first })).toBeVisible();

		// The list survives a reload, so the Contests are in storage and not just
		// in server-rendered markup.
		await page.reload();
		await expect(page.locator('[data-contest-id]').filter({ hasText: second })).toBeVisible();

		// Newest first, so the operator finds tonight's party at the top: the
		// Contest created second sits above the one created first.
		const rows = page.locator('li[data-contest-id]');
		const order = await rows.allInnerTexts();
		expect(order.findIndex((row) => row.includes(second))).toBeLessThan(
			order.findIndex((row) => row.includes(first))
		);

		// Signing out ends the session, and the admin area is unreachable again.
		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/admin\/login$/);

		await page.goto('/admin');
		await expect(page).toHaveURL(/\/admin\/login$/);
		await expect(page.getByText(second)).toHaveCount(0);
	});
});
