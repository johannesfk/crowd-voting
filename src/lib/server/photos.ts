// Entry photographs, kept in object storage rather than in the database: they are
// by far the largest thing the platform holds, and a 12 megapixel phone photo in a
// SQLite row is a query problem as well as a storage one (ADR 0005).
//
// The Worker only stores and serves. Downscaling happens in the browser before
// upload, because that is where the memory is; what arrives is already about
// 300 KB, and the one thing refused here is a file no working browser pipeline
// would have produced.

import { env } from 'cloudflare:workers';

/**
 * Everything one Contest owns in object storage shares this prefix.
 *
 * The prefix is the whole of the delete story (ADR 0002): a deletion that lists
 * storage rather than reading keys off the Entry rows does not have to trust the
 * database to be in step with the bucket, so a rerun finds whatever the failed run
 * left behind — which is what makes deleting twice safe rather than merely
 * harmless.
 */
function photoPrefixFor(contestId: string): string {
	return `contests/${contestId}/`;
}

/**
 * Objects are grouped by Contest so that deleting a Contest can enumerate
 * everything it owns by prefix (ADR 0002), and named by Entry so an Entry's photo
 * has exactly one key.
 */
export function photoKeyFor(contestId: string, entryId: string): string {
	return `${photoPrefixFor(contestId)}entries/${entryId}`;
}

/**
 * The ceiling an upload is checked against before it is stored. The browser sends
 * about 300 KB; a file several times that arrived without being downscaled, and a
 * handful of people uploading whole camera rolls is exactly what venue wifi cannot
 * take.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function storePhoto(key: string, photo: File): Promise<void> {
	await env.PHOTOS.put(key, photo.stream(), {
		httpMetadata: { contentType: photo.type || 'application/octet-stream' }
	});
}

export type StoredPhoto = { body: ReadableStream; contentType: string };

/** The stored object, or `null` when the Entry has no photo in storage. */
export async function readPhoto(key: string): Promise<StoredPhoto | null> {
	const object = await env.PHOTOS.get(key);
	if (object === null) return null;
	return {
		body: object.body,
		contentType: object.httpMetadata?.contentType ?? 'application/octet-stream'
	};
}

/**
 * Every photograph one Contest owns, removed.
 *
 * Enumerated by prefix rather than by the keys on the Entry rows, and paged because
 * a big contest has more objects than one listing returns. Both of those choices
 * are what make deletion retryable: a run that failed partway through left objects
 * behind, the next run finds them under the same prefix without consulting the
 * database at all, and deleting a key that has already gone is not an error in R2 —
 * so a repeated run finishes the job rather than complaining about it.
 */
export async function deleteContestPhotos(contestId: string): Promise<void> {
	const prefix = photoPrefixFor(contestId);

	let cursor: string | undefined = undefined;
	do {
		const listed = await env.PHOTOS.list(cursor === undefined ? { prefix } : { prefix, cursor });
		await Promise.all(listed.objects.map((object) => env.PHOTOS.delete(object.key)));
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor !== undefined);
}
