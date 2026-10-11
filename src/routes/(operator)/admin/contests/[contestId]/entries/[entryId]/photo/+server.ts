import { error } from '@sveltejs/kit';
import { isSignedIn } from '#lib/server/auth.js';
import { getContest } from '#lib/server/contest.js';
import { findEntry } from '#lib/server/entry.js';
import { readPhoto } from '#lib/server/photos.js';
import type { RequestHandler } from './$types';

/**
 * An Entry's photo, served to the operator only. Photographs of guests are a
 * surprise until the ballot opens, so no audience route hands one out — the
 * ballot will serve them itself, and only once voting is live.
 */
export const GET: RequestHandler = async ({ params, cookies }) => {
	if (!(await isSignedIn(cookies))) error(401, 'Sign in to see the entries.');

	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');

	const entry = await findEntry(contest.id, params.entryId);
	if (entry === undefined) error(404, 'No such entry.');

	const photo = await readPhoto(entry.photoKey);
	if (photo === null) error(404, 'No photo was stored for this entry.');

	return new Response(photo.body, {
		headers: {
			'content-type': photo.contentType,
			// Operator-only, and never a cache's business.
			'cache-control': 'private, no-store'
		}
	});
};
