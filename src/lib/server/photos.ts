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
 * Objects are grouped by Contest so that deleting a Contest can enumerate
 * everything it owns by prefix (ADR 0002), and named by Entry so an Entry's photo
 * has exactly one key.
 */
export function photoKeyFor(contestId: string, entryId: string): string {
	return `contests/${contestId}/entries/${entryId}`;
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
