import { redirect } from '@sveltejs/kit';
import { isSignedIn } from '#lib/server/auth.js';
import type { LayoutServerLoad } from './$types';

// Every route in this group is operator-only. A visitor without a signed session
// is sent to the login screen; the login route itself sits outside the group so it
// stays reachable without one.
export const load: LayoutServerLoad = async ({ cookies, setHeaders }) => {
	// These pages name every Contest — and from ticket 05 every Entry and vote
	// count — so no cache anywhere on the way may hold one of them.
	setHeaders({ 'cache-control': 'no-store' });

	if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');
};
