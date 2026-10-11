import { error, fail, redirect } from '@sveltejs/kit';
import { isSignedIn } from '#lib/server/auth.js';
import { getContest } from '#lib/server/contest.js';
import {
	EntryListFrozen,
	listEntries,
	listVisibleEntries,
	setEntryHidden
} from '#lib/server/entry.js';
import { formText } from '#lib/server/form.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * What the operator watches while registrations arrive: every Entry with its photo
 * and its names, and the one control the operator has over it before voting opens.
 */
export const load: PageServerLoad = async ({ params }) => {
	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');

	const entries = await listEntries(contest.id);
	// What the audience will be able to choose, read through the same query the
	// ballot and the standings will use rather than a count invented here.
	const onBallot = await listVisibleEntries(contest.id);

	return {
		contest: { id: contest.id, title: contest.title, phase: contest.phase },
		entries,
		onBallot: onBallot.length
	};
};

export const actions = {
	hide: async ({ params, request, cookies }) => {
		// Actions run before the layout's guard, so a posted form must not be able to
		// act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		const submitted = await request.formData();
		const entryId = formText(submitted.get('entryId'));
		const hidden = formText(submitted.get('hidden')) === 'true';

		try {
			await setEntryHidden(contest, entryId, hidden);
		} catch (cause) {
			// The entry list freezes when voting opens. Hiding something then would
			// let a costume disappear from a ballot that has already been cast.
			if (cause instanceof EntryListFrozen) return fail(409, { frozen: true });
			throw cause;
		}

		return { hidden: entryId, nowHidden: hidden };
	}
} satisfies Actions;
