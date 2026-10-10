import { fail, redirect } from '@sveltejs/kit';
import { isPasswordConfigured, passwordMatches, signIn } from '#lib/server/auth.js';
import { formText } from '#lib/server/form.js';
import type { Actions } from './$types';

export const actions = {
	default: async (event) => {
		const submitted = await event.request.formData();

		// Said plainly, because the alternative — "that password did not work" —
		// sends the operator hunting for a typo that is not theirs.
		if (!isPasswordConfigured()) {
			return fail(400, { notConfigured: true });
		}

		if (!(await passwordMatches(formText(submitted.get('password'))))) {
			return fail(400, { invalidPassword: true });
		}

		await signIn(event.cookies);
		redirect(303, '/admin');
	}
} satisfies Actions;
