// The Board's live connection: the same read as `#lib/server/board.js`, re-read on
// an interval for as long as anything is watching it.
//
// This file lives beside the component rather than in `src/lib/server/` on purpose.
// A `.remote` module is the one place server code may be reached from a component,
// and SvelteKit enforces that boundary by treating everything under `src/lib/server/`
// as server-only — including a remote module put there, which would then be
// unreachable from the very component it exists to serve.
//
// A live query rather than a reload, because the operator running a room is watching
// this page while doing something else, and a number that only changes when they
// remember to press refresh is not a live count. SvelteKit keeps one connection per
// query, reconnects it, and drops values the consumer has not caught up with — a
// burst of Ballots collapses to the latest standings rather than queueing up behind
// it.
//
// The generator polls rather than being pushed to. A Durable Object broadcast hub is
// the documented upgrade if this ever has to fan out to a large audience (ADR 0001),
// and it is deliberately not built now: the audience for this data is one operator
// looking at one screen.

import { query } from '$app/server';
import { readBoard, type Board } from '#lib/server/board.js';

/** How often the Board re-reads while it is on screen. */
const POLL_MS = 2000;

// `unchecked` because the only argument is a Contest identifier this page already
// holds. It is not trusted: `readBoard` reads through the same queries as the ballot
// and the standings, so an identifier naming no Contest simply yields an empty Board.
export const getBoard = query.live(
	'unchecked',
	async function* (contestId: string): AsyncGenerator<Board> {
		for (;;) {
			yield await readBoard(contestId);
			await new Promise((done) => setTimeout(done, POLL_MS));
		}
	}
);

/**
 * The same Board, read once. What the page uses after voting has closed: the
 * operator still has to see the result to publish it and present it, but nothing
 * about it can change, so there is nothing to stay connected for.
 */
export const getFrozenBoard = query('unchecked', (contestId: string) => readBoard(contestId));
