// The guard every operator route asks for: a signed operator session, and the Contest
// the route named.
//
// Actions run before the layout's guard (see ticket 02), so no action may trust the
// page it was posted from: each one asks here itself. Collected into one module
// because the same two questions, answered the same way, were repeated at every action
// and every load in the operator area — and because an action that forgot one of them
// was a hole rather than a style problem.

import { error, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { isSignedIn } from './auth.js';
import { getContest, type Contest } from './contest.js';

/** The signed-in operator, or a redirect to the login screen. */
export async function requireOperator(cookies: Cookies): Promise<void> {
	if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');
}

/**
 * The signed-in operator, and the Contest `contestId` names — or a redirect, or a 404
 * when the identifier names no Contest at all.
 */
export async function requireOperatorContest(
	contestId: string,
	cookies: Cookies
): Promise<Contest> {
	await requireOperator(cookies);

	const contest = await getContest(contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');

	return contest;
}
