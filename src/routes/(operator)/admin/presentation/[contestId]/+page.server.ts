import { error } from '@sveltejs/kit';
import { canPresent } from '#lib/contest/phases.js';
import { readPodium } from '#lib/server/board.js';
import { getContest } from '#lib/server/contest.js';
import type { PageServerLoad } from './$types';

/**
 * The Presentation: the reveal, on its own route and its own screen.
 *
 * Inside the operator group, so it is guarded by the same shared-password session as
 * every other operator page and nobody else's browser can reach it. The group layout
 * knows to leave the admin chrome off for this route (see `+layout.svelte`), which is
 * what makes it full screen.
 *
 * The phase is checked here as well as by the admin page that links to this one. A
 * Contest still in Voting has a result that is still moving, and a reveal that shows a
 * result which then changes is the one thing worse than no reveal at all.
 */
export const load: PageServerLoad = async ({ params }) => {
	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');
	if (!canPresent(contest.phase)) {
		error(409, 'That Contest has no final result to present yet.');
	}

	return {
		contest: {
			id: contest.id,
			title: contest.title,
			// `null` is a real value here, not a missing one: it is the transparent
			// background that composites over video, and the Presentation is the only
			// thing in the product that reads it.
			background: contest.presentationBackground
		},
		frames: await readPodium(contest.id)
	};
};
