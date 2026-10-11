// The device token: the opaque random value a browser receives on its first visit
// to a Contest, kept in a cookie and never shown again. It identifies a browser,
// not a person, and it is the only thing standing between one phone and two
// ballots (ADR 0004).
//
// Only the token's digest is stored, so a copy of the database holds no
// credentials, and a cookie replayed against another Contest is a different token
// as far as that Contest is concerned: the lookup is by (Contest, digest).

import { and, eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { getDb } from './db/index.js';
import { device } from './db/schema.js';

const DEVICE_COOKIE = 'cv_device';

/** Audience routes live under /c, so the cookie never travels to the admin area. */
const COOKIE_PATH = '/c';

/** Long enough to outlive any party, and short enough to be forgotten after. */
const LIFETIME_SECONDS = 60 * 60 * 24 * 180;

export type Device = typeof device.$inferSelect;

function randomHex(bytes: number): string {
	return [...crypto.getRandomValues(new Uint8Array(bytes))]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

/** The one way this module turns anything into something storable. */
async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The advisory Duplicate signal: where the request appeared to come from, and what
 * it claimed to be. Recorded because the operator may want to see it, and never
 * consulted when deciding whether to let someone in — a venue's guests share one
 * network address, so a hard rule on it would reject most of the room. A header
 * that was not sent is nothing to hash.
 */
async function signalHash(value: string | null): Promise<string | null> {
	return value === null || value === '' ? null : sha256Hex(value);
}

/**
 * The device making this request, created on first visit and found by cookie
 * afterwards. One row per browser per Contest, so the same phone entering two
 * different parties is two devices with nothing linking them.
 */
export async function resolveDevice(
	contestId: string,
	cookies: Cookies,
	request: Request
): Promise<Device> {
	const existing = cookies.get(DEVICE_COOKIE);
	if (existing !== undefined) {
		const found = await getDb()
			.select()
			.from(device)
			.where(and(eq(device.contestId, contestId), eq(device.tokenHash, await sha256Hex(existing))))
			.get();
		if (found !== undefined) return found;
	}

	const token = randomHex(32);
	const [created] = await getDb()
		.insert(device)
		.values({
			contestId,
			tokenHash: await sha256Hex(token),
			shuffleSeed: randomHex(16),
			networkHash: await signalHash(
				request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')
			),
			fingerprintHash: await signalHash(
				`${request.headers.get('user-agent') ?? ''}|${request.headers.get('accept-language') ?? ''}`
			)
		})
		.returning();

	// httpOnly because the token is a credential: nothing on an audience page ever
	// needs to read it back.
	cookies.set(DEVICE_COOKIE, token, {
		path: COOKIE_PATH,
		httpOnly: true,
		sameSite: 'lax',
		maxAge: LIFETIME_SECONDS
	});

	return created;
}
