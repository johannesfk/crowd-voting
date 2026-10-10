import { fail, redirect } from '@sveltejs/kit';
import { isSignedIn } from '#lib/server/auth.js';
import { createContest } from '#lib/server/contest.js';
import { formNotice, formText } from '#lib/server/form.js';
import type { Actions } from './$types';

export const actions = {
	default: async ({ request, cookies }) => {
		// Actions run before the layout's guard, so every action that touches the
		// operator's data checks the session itself: a posted form must not be
		// able to act on the operator's behalf.
		if (!(await isSignedIn(cookies))) redirect(303, '/admin/login');

		const submitted = await request.formData();
		const title = formText(submitted.get('title'));
		const description = formText(submitted.get('description'));
		const registrationNotice = formNotice(submitted.get('registrationNotice'));
		const votingNotice = formNotice(submitted.get('votingNotice'));

		// The two notices are optional; the title and description are the Contest
		// itself, so a Contest cannot be created without them.
		if (title === '' || description === '') {
			return fail(400, {
				title,
				description,
				registrationNotice,
				votingNotice,
				invalidContest: true
			});
		}

		await createContest({ title, description, registrationNotice, votingNotice });
		redirect(303, '/admin');
	}
} satisfies Actions;
