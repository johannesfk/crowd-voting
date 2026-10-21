import { describe, expect, test } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { relations } from './relations.js';

/**
 * Drizzle builds a relational query as one statement that nests the related
 * rows with SQLite's JSON functions. On a driver whose SQLite is new enough it
 * prefers the `jsonb_*` variants, which are faster — and which D1 does not
 * ship. D1's driver is the one that asks drizzle for `json` instead, and this
 * test is what says so out loud: the failure mode otherwise is a query that
 * works against the local database and errors in production.
 *
 * The client here is a stub. Nothing is executed — `toSQL()` only builds the
 * statement — so the test needs no database at all.
 */
const db = drizzle({} as never, { relations });

const sqlOf = (query: { toSQL: () => { sql: string } }) => query.toSQL().sql;

describe('relational queries', () => {
	test('stay on the json functions D1 has', () => {
		const sql = sqlOf(
			db.query.entry.findMany({
				where: { contestId: 'c' },
				with: { participants: true, contest: true }
			})
		);

		expect(sql).not.toContain('jsonb');
		expect(sql).toContain('json_group_array');
		expect(sql).toContain('json_object');
	});

	test('ask the database for one statement, not one per relation', () => {
		const sql = sqlOf(
			db.query.entry.findMany({
				where: { contestId: 'c' },
				with: { participants: true }
			})
		);

		// One statement, with the nested read hanging off it as a subquery rather
		// than as a statement of its own. The Board depends on this: a Ballot
		// arriving between two reads would make it report a total it has no
		// counts for.
		expect(sql).not.toContain(';');
		expect(sql.match(/from "entry" as "d0"/g)).toHaveLength(1);
	});

	test('read a Contest with its Entries in one join', () => {
		const sql = sqlOf(db.query.contest.findFirst({ where: { id: 'c' }, with: { entries: true } }));

		expect(sql).toContain('from "contest" as "d0"');
		expect(sql).toContain('from "entry" as "d1"');
		// The relation joins on the foreign key: contest.id = entry.contest_id.
		expect(sql).toContain('"d0"."id" = "d1"."contest_id"');
	});

	test('join every "many" relation on its foreign key, and the right way round', () => {
		const joins = [
			[
				'device → entries',
				db.query.device.findFirst({ with: { entries: true } }),
				'"d0"."id" = "d1"."device_id"'
			],
			[
				'device → ballots',
				db.query.device.findFirst({ with: { ballots: true } }),
				'"d0"."id" = "d1"."device_id"'
			],
			[
				'entry → votes',
				db.query.entry.findFirst({ with: { votes: true } }),
				'"d0"."id" = "d1"."entry_id"'
			],
			[
				'ballot → votes',
				db.query.ballot.findFirst({ with: { votes: true } }),
				'"d0"."id" = "d1"."ballot_id"'
			],
			[
				'contest → ballots',
				db.query.contest.findFirst({ with: { ballots: true } }),
				'"d0"."id" = "d1"."contest_id"'
			]
		] as const;

		for (const [name, query, join] of joins) {
			expect(sqlOf(query), name).toContain(join);
		}
	});

	test('join every "one" relation back to the foreign key it hangs off', () => {
		const joins = [
			[
				'entry → device',
				db.query.entry.findFirst({ with: { device: true } }),
				'"d0"."device_id" = "d1"."id"'
			],
			[
				'entry → contest',
				db.query.entry.findFirst({ with: { contest: true } }),
				'"d0"."contest_id" = "d1"."id"'
			],
			[
				'ballot → device',
				db.query.ballot.findFirst({ with: { device: true } }),
				'"d0"."device_id" = "d1"."id"'
			],
			[
				'vote → entry',
				db.query.vote.findFirst({ with: { entry: true } }),
				'"d0"."entry_id" = "d1"."id"'
			],
			[
				'participant → entry',
				db.query.participant.findFirst({ with: { entry: true } }),
				'"d0"."entry_id" = "d1"."id"'
			]
		] as const;

		for (const [name, query, join] of joins) {
			expect(sqlOf(query), name).toContain(join);
		}
	});
});
