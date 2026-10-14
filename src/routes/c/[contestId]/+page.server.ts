import { error, fail, redirect } from '@sveltejs/kit';
import { orderBallot } from '#lib/contest/ballot.js';
import { acceptsVotes } from '#lib/contest/phases.js';
import { parseParticipants } from '#lib/contest/registration.js';
import {
	AlreadyVoted,
	castBallot,
	findBallotByDevice,
	NoPicks,
	NotOnBallot,
	OwnEntry,
	TooManyPicks,
	VotingClosed
} from '#lib/server/ballot.js';
import { getContest } from '#lib/server/contest.js';
import { resolveDevice } from '#lib/server/device.js';
import {
	findEntryByDevice,
	listVisibleEntries,
	registerEntry,
	RegistrationClosed
} from '#lib/server/entry.js';
import { formText } from '#lib/server/form.js';
import { MAX_UPLOAD_BYTES } from '#lib/server/photos.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * The one audience link for a Contest. While the Contest is in Registration this
 * serves the registration form; once Voting opens the same URL serves the ballot,
 * and after that the waiting page.
 *
 * Everything about which of the three it is comes from the phase, so nobody has to
 * be told which link to use.
 */
export const load: PageServerLoad = async ({ params, cookies, request }) => {
	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');

	// The device is resolved on first visit as well as on every later one, so a
	// guest who opens the link and puts it down still has a device row when they
	// come back.
	const device = await resolveDevice(contest.id, cookies, request);

	// While the Contest is taking Entries, the Own entry is whatever this device
	// registered — hidden or not, because they did enter and the confirmation says so.
	const ownEntry = await findEntryByDevice(contest.id, device.id);

	// A device that has already voted is recognised and not offered the ballot
	// again, which is the same fact as "one Ballot per device, ever" seen from the
	// audience's side. Deliberately not gated on the phase: a Ballot was cast once
	// and stays cast, so the confirmation outlives voting closing rather than
	// evaporating and telling a guest they are still waiting to vote.
	const hasVoted = (await findBallotByDevice(contest.id, device.id)) !== undefined;

	// Once voting is live, the Own entry is taken out of the grid rather than shown
	// in it: it cannot be selected, so letting it take a slot would spend one of a
	// guest's picks on something the rules forbid. A Hidden Own entry is absent
	// altogether, because a Hidden Entry is absent from the ballot (story 42).
	const votable = acceptsVotes(contest.phase)
		? orderBallot(await listVisibleEntries(contest.id), device.shuffleSeed)
		: [];
	const ballotOwnEntry = ownEntry?.hidden === true ? undefined : ownEntry;
	const entries = votable.filter((candidate) => candidate.id !== ballotOwnEntry?.id);

	return {
		contest: {
			id: contest.id,
			title: contest.title,
			description: contest.description,
			registrationNotice: contest.registrationNotice,
			votingNotice: contest.votingNotice,
			phase: contest.phase
		},
		ownEntry,
		ballotOwnEntry,
		entries,
		hasVoted
	};
};

export const actions = {
	/**
	 * Registers an Entry, while the Contest is still taking them.
	 *
	 * Named rather than the default action because this page has two forms on it
	 * for two different phases of the same contest, and SvelteKit refuses a
	 * `default` action on a page that has any named ones. Both forms name their
	 * own action, which works with no JavaScript as well as with `enhance`.
	 */
	register: async ({ params, request, cookies }) => {
		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		const device = await resolveDevice(contest.id, cookies, request);
		const link = `/c/${contest.id}`;

		// A guest whose form was left open past the close lands here on submit.
		// The contest link then serves whatever the phase now calls for, so they
		// are sent onwards rather than told they are late with an error.
		if (contest.phase !== 'registration') redirect(303, link);

		// Registration is final, so a second submission from the same device is
		// not a second Entry: they are sent to the confirmation they already have.
		if ((await findEntryByDevice(contest.id, device.id)) !== undefined) redirect(303, link);

		const submitted = await request.formData();
		const names = parseParticipants(formText(submitted.get('participants')));
		const costume = formText(submitted.get('costume'));

		// Both photo inputs carry the same name, and an input with nothing chosen
		// still submits an empty entry, so the photo is the first one that actually
		// has bytes in it.
		const [photo] = submitted
			.getAll('photo')
			.filter((value): value is File => typeof value !== 'string' && value.size > 0);

		if (names.length === 0 || costume === '') {
			return fail(400, { names, costume, missingDetails: true });
		}
		if (photo === undefined) {
			return fail(400, { names, costume, missingPhoto: true });
		}
		if (photo.size > MAX_UPLOAD_BYTES) {
			return fail(400, { names, costume, photoTooLarge: true });
		}

		try {
			await registerEntry({ contest, deviceId: device.id, costume, names, photo });
		} catch (cause) {
			// Registration closing between the check above and the write is not a
			// failure the guest can fix; the link will show them the current phase.
			if (cause instanceof RegistrationClosed) redirect(303, link);
			throw cause;
		}

		// Post/redirect/get, so a refresh shows the confirmation rather than
		// offering to enter a second time.
		redirect(303, link);
	},

	/**
	 * Casts a Ballot. One to three picks, and then it is final: the reply is a
	 * redirect to the same link, which now says the vote is in.
	 */
	ballot: async ({ params, request, cookies }) => {
		const contest = await getContest(params.contestId);
		if (contest === undefined) error(404, 'That Contest does not exist.');

		const device = await resolveDevice(contest.id, cookies, request);
		const link = `/c/${contest.id}`;
		const submitted = await request.formData();
		const picks = submitted.getAll('picks').map(formText);

		try {
			await castBallot({ contest, deviceId: device.id, picks });
		} catch (cause) {
			// A guest who left the ballot open past the close lands here, and so does
			// one who posts before voting opened. Neither is a mistake they can fix:
			// the link serves whatever the phase now calls for, which is a ballot,
			// a confirmation, or the waiting page.
			if (cause instanceof VotingClosed) redirect(303, link);
			// Casting is final, so a replayed post from a device that has voted is
			// not a second Ballot: they are shown the vote they already have.
			if (cause instanceof AlreadyVoted) redirect(303, link);
			// These three are the guest's own doing and the ballot stays open, so
			// they are told what is wrong and can fix it.
			if (cause instanceof TooManyPicks) return fail(400, { rejected: 'tooManyPicks' });
			if (cause instanceof NoPicks) return fail(400, { rejected: 'noPicks' });
			if (cause instanceof OwnEntry) return fail(400, { rejected: 'ownEntry' });
			if (cause instanceof NotOnBallot) return fail(400, { rejected: 'notOnBallot' });
			throw cause;
		}

		redirect(303, link);
	}
} satisfies Actions;
