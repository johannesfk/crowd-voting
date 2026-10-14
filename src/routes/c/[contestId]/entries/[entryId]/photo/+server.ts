import { error } from '@sveltejs/kit';
import { getContest } from '#lib/server/contest.js';
import { findEntry } from '#lib/server/entry.js';
import { readPhoto } from '#lib/server/photos.js';
import { showsPhotos } from '#lib/contest/phases.js';
import type { RequestHandler } from './$types';

/**
 * An Entry's photograph for the audience, from the moment the ballot opens.
 *
 * Photographs of guests are a surprise until voting starts (story 86), so during
 * Registration this answers 404 rather than serving the file — the same objects
 * the operator sees from the admin area are not reachable from a link the room
 * has not been sent yet. A Hidden Entry is never on the ballot and never in the
 * standings, so it is not served here either.
 */
export const GET: RequestHandler = async ({ params }) => {
	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');
	if (!showsPhotos(contest.phase)) error(404, 'No such photo.');

	const entry = await findEntry(contest.id, params.entryId);
	if (entry === undefined || entry.hidden) error(404, 'No such photo.');

	const photo = await readPhoto(entry.photoKey);
	if (photo === null) error(404, 'No photo was stored for this entry.');

	return new Response(photo.body, {
		headers: {
			'content-type': photo.contentType,
			// The object never changes once registered, but only the browser that is
			// looking at this ballot may keep it, and only for a moment — a shared
			// proxy must not be holding photographs of guests.
			'cache-control': 'private, max-age=60'
		}
	});
};
