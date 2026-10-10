import { listContests } from '#lib/server/contest.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const contests = await listContests();
	return { contests };
};
