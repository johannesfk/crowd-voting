// Every relationship between the tables, in one place.
//
// Drizzle 1 keeps relations in a single `defineRelations` call rather than one
// `relations()` object per table, and hands the result to the client as
// `drizzle(env.DB, { relations })`. They are not database constraints — the
// foreign keys in `./schema.js` are — but they are what lets a read ask for a
// whole shape ("this Entry and the people in it") as one statement instead of
// two reads stitched together in JavaScript.
//
// The names below are the domain's, not the columns': a Contest has Entries and
// Ballots, an Entry has Participants, a Ballot has Votes. Every `one` is marked
// `optional: false`, because every foreign key it hangs off is `notNull()`: the
// row on the other side is guaranteed to be there, and saying so keeps `null`
// out of the types that come back.

import { defineRelations } from 'drizzle-orm';
import { ballot, contest, device, entry, participant, vote } from './schema.js';

export const relations = defineRelations(
	{ ballot, contest, device, entry, participant, vote },
	(r) => ({
		contest: {
			devices: r.many.device({ from: r.contest.id, to: r.device.contestId }),
			entries: r.many.entry({ from: r.contest.id, to: r.entry.contestId }),
			ballots: r.many.ballot({ from: r.contest.id, to: r.ballot.contestId })
		},
		device: {
			contest: r.one.contest({ from: r.device.contestId, to: r.contest.id, optional: false }),
			entries: r.many.entry({ from: r.device.id, to: r.entry.deviceId }),
			ballots: r.many.ballot({ from: r.device.id, to: r.ballot.deviceId })
		},
		entry: {
			contest: r.one.contest({ from: r.entry.contestId, to: r.contest.id, optional: false }),
			device: r.one.device({ from: r.entry.deviceId, to: r.device.id, optional: false }),
			participants: r.many.participant({ from: r.entry.id, to: r.participant.entryId }),
			votes: r.many.vote({ from: r.entry.id, to: r.vote.entryId })
		},
		participant: {
			entry: r.one.entry({ from: r.participant.entryId, to: r.entry.id, optional: false })
		},
		ballot: {
			contest: r.one.contest({ from: r.ballot.contestId, to: r.contest.id, optional: false }),
			device: r.one.device({ from: r.ballot.deviceId, to: r.device.id, optional: false }),
			votes: r.many.vote({ from: r.ballot.id, to: r.vote.ballotId })
		},
		vote: {
			ballot: r.one.ballot({ from: r.vote.ballotId, to: r.ballot.id, optional: false }),
			entry: r.one.entry({ from: r.vote.entryId, to: r.entry.id, optional: false })
		}
	})
);
