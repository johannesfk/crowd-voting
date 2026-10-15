import { error, fail, redirect } from '@sveltejs/kit';
import { confirmsDeletion } from '#lib/contest/deletion.js';
import { hasBeenScored } from '#lib/contest/phases.js';
import { podiumBackground } from '#lib/contest/podium.js';
import { isSignedIn } from '#lib/server/auth.js';
import { readBoard } from '#lib/server/board.js';
import {
	closeVoting,
	deleteContest,
	getContest,
	NothingToPublish,
	openVoting,
	publishResults,
	setPresentationBackground,
	VotingAlreadyOpen,
	VotingNotOpen
} from '#lib/server/contest.js';
import {
	EntryListFrozen,
	listEntries,
	listVisibleEntries,
	setEntryHidden
} from '#lib/server/entry.js';
import { formText } from '#lib/server/form.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * What the operator watches: every Entry as it arrives, then — once voting is open —
 * the Board, live. The two share a page because they are the same list seen at two
 * moments, and an operator running a party does not want to move between them.
 */
export const load: PageServerLoad = async ({ params }) => {
	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');

	const entries = await listEntries(contest.id);
	// What the audience will be able to choose, read through the same query the
	// ballot and the standings will use rather than a count invented here.
	const onBallot = await listVisibleEntries(contest.id);

	return {
		contest: {
			id: contest.id,
			title: contest.title,
			phase: contest.phase,
			// `null` means transparent rather than unset, so the Podium's form shows the
			// operator what the reveal will actually do rather than what it defaults to.
			background: contest.presentationBackground
		},
		entries,
		onBallot: onBallot.length,
		// The Board is the operator's view of the contest from the moment voting opens
		// until it is published, live while it can still move and frozen after.
		board: hasBeenScored(contest.phase) ? await readBoard(contest.id) : null
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
	},

	/**
	 * Closes Registration and opens Voting in one action — the single handover
	 * moment. Whether that move is legal is the contest module's question, not this
	 * route's, so a Contest that is already past Registration is refused there.
	 */
	openVoting: async ({ params, cookies }) => {
		// Actions run before the layout's guard, so a posted form must not be able to
		// act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		// Warned rather than stopped: running a contest with nothing on it is a
		// mistake worth one more click, not one worth an error page.
		const votable = (await listVisibleEntries(contest.id)).length;
		if (votable === 0) return fail(409, { nothingToVoteOn: true });

		try {
			const opened = await openVoting(contest);
			return { phase: opened.phase };
		} catch (cause) {
			if (cause instanceof VotingAlreadyOpen) return fail(409, { alreadyOpen: true });
			throw cause;
		}
	},

	/**
	 * Ends voting. Deliberate and one-way: the standings stop here, privately, and
	 * the machine does not run backwards.
	 */
	closeVoting: async ({ params, request, cookies }) => {
		// Actions run before the layout's guard, so a posted form must not be able to
		// act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		// Closing is irreversible, so it is confirmed by a deliberate second step
		// rather than by a button that can be hit by accident during a busy evening.
		const submitted = await request.formData();
		if (formText(submitted.get('confirm')) !== 'close') {
			return fail(409, { confirmClose: true });
		}

		try {
			const closed = await closeVoting(contest);
			return { phase: closed.phase };
		} catch (cause) {
			if (cause instanceof VotingNotOpen) return fail(409, { votingNotOpen: true });
			throw cause;
		}
	},

	/**
	 * Makes the standings public. Deliberately its own action, with its own
	 * confirmation, because the gap between closing voting and publishing is where the
	 * result is presented — and because it is the one edge on this page that cannot be
	 * walked back.
	 */
	publish: async ({ params, request, cookies }) => {
		// Actions run before the layout's guard, so a posted form must not be able to
		// act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		const submitted = await request.formData();
		if (formText(submitted.get('confirm')) !== 'publish') {
			return fail(409, { confirmPublish: true });
		}

		try {
			const published = await publishResults(contest);
			return { phase: published.phase };
		} catch (cause) {
			if (cause instanceof NothingToPublish) return fail(409, { nothingToPublish: true });
			throw cause;
		}
	},

	/**
	 * Sets the background the Podium presents on. Allowed at any phase, including
	 * Registration: an operator picks the colour before the party, not at the moment
	 * they are standing in front of the room. Nothing here touches the phase or the
	 * standings, so there is no result here to be irreversible about.
	 */
	background: async ({ params, request, cookies }) => {
		// Actions run before the layout's guard, so a posted form must not be able to
		// act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		const submitted = await request.formData();
		const background = podiumBackground(
			formText(submitted.get('transparent')) === 'on',
			formText(submitted.get('background'))
		);

		const updated = await setPresentationBackground(contest, background);
		return { background: updated.presentationBackground };
	},

	/**
	 * Destroys the Contest: its entries, its ballots, its standings and every
	 * photograph taken for it, with nothing left to undo any of it.
	 *
	 * Confirmed by re-typing the Contest's title rather than by clicking a button, for
	 * the same reason closing and publishing are: this one destroys photographs of
	 * real people, and a stray click at the wrong moment on the busiest evening of the
	 * year is the mistake being guarded against. A post with no title in it is the
	 * operator asking what they are about to lose, not confirming it.
	 *
	 * Available at any phase, and followed by a redirect to the list rather than by a
	 * page of their own, because there is nothing left to show one.
	 */
	delete: async ({ params, request, cookies }) => {
		// Actions run before the layout's guard, so a posted form must not be able to
		// act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		const submitted = await request.formData();
		const typed = formText(submitted.get('title'));

		if (!confirmsDeletion(typed, contest.title)) {
			// `submitted.has` rather than `typed === ''`: an empty box the operator
			// submitted is a mistyped title they need told about, while no field at all
			// is the button that only asks.
			return fail(409, { confirmDelete: true, titleMismatch: submitted.has('title'), typed });
		}

		await deleteContest(contest);

		redirect(303, '/admin');
	}
} satisfies Actions;
