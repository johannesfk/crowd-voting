import { error, fail, redirect } from '@sveltejs/kit';
import { parseParticipants } from '#lib/contest/registration.js';
import { getContest } from '#lib/server/contest.js';
import { resolveDevice } from '#lib/server/device.js';
import { findEntryByDevice, registerEntry, RegistrationClosed } from '#lib/server/entry.js';
import { formText } from '#lib/server/form.js';
import { MAX_UPLOAD_BYTES } from '#lib/server/photos.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * The one audience link for a Contest. While the Contest is in Registration this
 * serves the registration form; the same URL serves the ballot later, and the
 * waiting page after that.
 */
export const load: PageServerLoad = async ({ params, cookies, request }) => {
	const contest = await getContest(params.contestId);
	if (contest === undefined) error(404, 'That Contest does not exist.');

	// The device is resolved on first visit as well as on every later one, so a
	// guest who opens the link and puts it down still has a device row when they
	// come back.
	const device = await resolveDevice(contest.id, cookies, request);
	const ownEntry = await findEntryByDevice(contest.id, device.id);

	return {
		contest: {
			id: contest.id,
			title: contest.title,
			description: contest.description,
			registrationNotice: contest.registrationNotice,
			phase: contest.phase
		},
		ownEntry
	};
};

export const actions = {
	default: async ({ params, request, cookies }) => {
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
	}
} satisfies Actions;
