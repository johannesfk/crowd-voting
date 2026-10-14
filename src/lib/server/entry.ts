// Entries and their Participants: reading them, creating one, and hiding one.
// Routes stay thin and call in here.
//
// Two rules live in this module rather than in a route, because both are about
// the Entry and not about HTTP. Registration is only open while the Contest is in
// Registration, and whether an Entry is hidden is only writable in that same
// phase — once voting opens the entry list is frozen, so no Entry can vanish
// from a ballot that has already been cast.

import { and, asc, eq, inArray } from 'drizzle-orm';
import { acceptsEntries } from '#lib/contest/phases.js';
import { getDb } from './db/index.js';
import { entry, participant } from './db/schema.js';
import { photoKeyFor, storePhoto } from './photos.js';
import type { Contest } from './contest.js';

export type Entry = typeof entry.$inferSelect;

/** An Entry with the names of its Participants, in the order they were typed. */
export type EntryWithNames = Entry & { names: string[] };

/** Every Entry of a Contest, newest last. */
export async function listEntries(contestId: string): Promise<EntryWithNames[]> {
	const rows = await getDb()
		.select()
		.from(entry)
		.where(eq(entry.contestId, contestId))
		.orderBy(asc(entry.registeredAt));

	if (rows.length === 0) return [];

	const people = await getDb()
		.select()
		.from(participant)
		.where(
			inArray(
				participant.entryId,
				rows.map((row) => row.id)
			)
		)
		.orderBy(asc(participant.position));

	const namesByEntry = new Map<string, string[]>();
	for (const person of people) {
		const names = namesByEntry.get(person.entryId) ?? [];
		names.push(person.name);
		namesByEntry.set(person.entryId, names);
	}

	return rows.map((row) => ({ ...row, names: namesByEntry.get(row.id) ?? [] }));
}

/**
 * The Entries the audience may choose — everything the operator has not hidden.
 * The ballot and the standings read this and nothing else, which is how a Hidden
 * Entry leaves both without either of them having to know what hidden means.
 */
export async function listVisibleEntries(contestId: string): Promise<EntryWithNames[]> {
	const all = await listEntries(contestId);
	return all.filter((row) => !row.hidden);
}

/**
 * This device's own Entry as the ballot may show it: nothing if the operator has
 * hidden it. A Hidden Entry is not votable and does not appear in results
 * (GLOSSARY), so it is not pinned on the ballot either — the registering device
 * sees it on the ballot as though it had never entered, which is the only reading
 * consistent with every other device's ballot.
 */
export async function findVisibleEntryByDevice(
	contestId: string,
	deviceId: string
): Promise<EntryWithNames | undefined> {
	const found = await findEntryByDevice(contestId, deviceId);
	return found?.hidden === true ? undefined : found;
}

export async function findEntry(contestId: string, entryId: string): Promise<Entry | undefined> {
	return getDb()
		.select()
		.from(entry)
		.where(and(eq(entry.contestId, contestId), eq(entry.id, entryId)))
		.get();
}

/**
 * What this device has already registered, so a returning visitor is told they
 * have entered rather than being shown the form again.
 */
/**
 * What this device registered, hidden or not. The registration confirmation still
 * names an Entry the operator has since hidden — they did enter, and telling them
 * otherwise would be a lie — so this is what the confirmation reads.
 *
 * The ballot does not use this: an Own Entry that the operator hid must be absent
 * from the ballot entirely rather than pinned there unselectable (story 42), so the
 * ballot reads the visible one below.
 */
export async function findEntryByDevice(
	contestId: string,
	deviceId: string
): Promise<EntryWithNames | undefined> {
	const found = await getDb()
		.select()
		.from(entry)
		.where(and(eq(entry.contestId, contestId), eq(entry.deviceId, deviceId)))
		.get();
	if (found === undefined) return undefined;

	const people = await getDb()
		.select()
		.from(participant)
		.where(eq(participant.entryId, found.id))
		.orderBy(asc(participant.position));

	return { ...found, names: people.map((person) => person.name) };
}

export class RegistrationClosed extends Error {}

/**
 * Records an Entry: the Contest, what it is dressed up as, every Participant, and
 * a photo in object storage.
 *
 * The photo is written last and the rows rolled back if it fails, so a broken
 * upload never leaves an Entry on the operator's list with a blank beside it.
 */
export async function registerEntry(input: {
	contest: Contest;
	deviceId: string;
	costume: string;
	names: string[];
	photo: File;
}): Promise<Entry> {
	const { contest } = input;
	if (!acceptsEntries(contest.phase)) throw new RegistrationClosed();

	const entryId = crypto.randomUUID();
	const db = getDb();

	const [created] = await db
		.insert(entry)
		.values({
			id: entryId,
			contestId: contest.id,
			costume: input.costume,
			photoKey: photoKeyFor(contest.id, entryId),
			deviceId: input.deviceId
		})
		.returning();

	try {
		await db
			.insert(participant)
			.values(input.names.map((name, position) => ({ entryId, name, position })));
		await storePhoto(created.photoKey, input.photo);
	} catch (cause) {
		await db.delete(entry).where(eq(entry.id, entryId));
		throw cause;
	}

	return created;
}

export class EntryListFrozen extends Error {}

/**
 * Hides or restores an Entry. Refused once voting has opened: the ballot is live
 * and any Entry that vanished would leave a cast ballot pointing at nothing.
 */
export async function setEntryHidden(
	contest: Contest,
	entryId: string,
	hidden: boolean
): Promise<Entry | undefined> {
	if (!acceptsEntries(contest.phase)) throw new EntryListFrozen();

	const [updated] = await getDb()
		.update(entry)
		.set({ hidden })
		.where(and(eq(entry.contestId, contest.id), eq(entry.id, entryId)))
		.returning();

	return updated;
}
