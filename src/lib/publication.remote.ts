// The waiting page's live connection: whether the operator has published yet.
//
// A live query rather than a reload, because the point of this page is that a guest
// is sitting on it when the result appears — they should not have to be refreshing in
// the hope of catching it, which is the difference between a reveal and a rumour.
//
// The generator polls the phase and only yields when it changes. It could not yield
// on a timer: this is the one page in the product that may sit open in front of half
// a room for an hour, and re-sending the same answer sixty times an hour would be
// work for nothing. A Durable Object broadcast hub is the documented upgrade if this
// ever needs to fan out (ADR 0001) and is deliberately not built now.

import { query } from '$app/server';
import { getContest } from '#lib/server/contest.js';
import { showsStandings } from '#lib/contest/phases.js';
import { POLL_MS } from '#lib/poll.js';

export type WaitState = { published: boolean };

// `unchecked` because the argument is a Contest identifier this page already holds;
// it is not trusted, since `getContest` is what actually resolves it.
export const watchPublication = query.live(
	'unchecked',
	async function* (contestId: string): AsyncGenerator<WaitState> {
		// Undefined rather than `false`, so the first answer always counts as a change.
		// Starting at `false` looks equivalent and is not: a Contest that is genuinely
		// unpublished would then never differ from it, the generator would yield
		// nothing at all, and the page's own render would wait on a stream that never
		// speaks — a waiting page that never loads.
		let published: boolean | undefined;

		for (;;) {
			const contest = await getContest(contestId);
			const next = contest !== undefined && showsStandings(contest.phase);

			// The first answer, then only the changes: the same answer again is not
			// news, and this page may sit open all evening.
			if (next !== published) {
				published = next;
				yield { published };
			}

			await new Promise((done) => setTimeout(done, POLL_MS));
		}
	}
);
