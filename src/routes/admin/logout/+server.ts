import { redirect } from '@sveltejs/kit';
import { signOut } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

// Ending a session is a POST rather than a link: nothing that can be prefetched or
// crawled should be able to sign an operator out.
export const POST: RequestHandler = async ({ cookies }) => {
	signOut(cookies);
	redirect(303, '/admin/login');
};
