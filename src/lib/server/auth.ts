// The Operator's one shared password, held as a deployment secret, exchanged for a
// signed http-only cookie (ADR 0003). There is no Operator user table and no
// registration, so revoking access is rotating the secret — which is also the
// signing key, so rotating it invalidates every outstanding session at once.

import type { Cookies } from '@sveltejs/kit';
import { operatorPassword } from './secrets.js';

const SESSION_COOKIE = 'cv_session';
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const VERSION = 'v1';

/** The session cookie never travels outside the admin area. */
const COOKIE_PATH = '/admin';

const encoder = new TextEncoder();

const b64url = (bytes: ArrayBuffer): string =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

/**
 * Compares byte by byte with no early exit, so a wrong value costs the same to
 * check as a right one.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	let mismatch = a.length === b.length ? 0 : 1;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a[i] ^ b[i];
	}
	return mismatch === 0;
}

async function digest(value: string): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/**
 * Imported once per secret and reused, so a guarded request does one signing
 * operation rather than an import as well. Keyed by secret, so rotating the
 * password never reuses a stale key.
 */
const signingKeys = new Map<string, Promise<CryptoKey>>();

function signingKey(secret: string): Promise<CryptoKey> {
	const existing = signingKeys.get(secret);
	if (existing) return existing;

	const importing = crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	signingKeys.set(secret, importing);
	return importing;
}

async function sign(payload: string, secret: string): Promise<string> {
	const key = await signingKey(secret);
	return b64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

/** A session is `version.expiry.signature`, signed over `version.expiry`. */
export async function createSessionValue(secret: string, now = Date.now()): Promise<string> {
	const expiry = now + SESSION_LIFETIME_MS;
	const signature = await sign(`${VERSION}.${expiry}`, secret);
	return `${VERSION}.${expiry}.${signature}`;
}

export async function isSessionValueValid(
	value: string | undefined,
	secret: string,
	now = Date.now()
): Promise<boolean> {
	const parts = value?.split('.');
	if (parts?.length !== 3) return false;
	const [version, expiry, signature] = parts;
	if (version !== VERSION) return false;
	const expiresAt = Number(expiry);
	if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;

	const expected = await sign(`${version}.${expiry}`, secret);
	return constantTimeEqual(encoder.encode(signature), encoder.encode(expected));
}

/**
 * The candidate password is checked by digesting both first, so nothing leaks
 * through an early exit or a length comparison on the secret itself.
 */
export async function verifyPassword(candidate: string, secret: string): Promise<boolean> {
	return constantTimeEqual(await digest(candidate), await digest(secret));
}

/** Whether there is a shared password to sign in with at all. */
export function isPasswordConfigured(): boolean {
	return operatorPassword() !== undefined;
}

/** Checks a submitted password against the deployment secret. */
export async function passwordMatches(candidate: string): Promise<boolean> {
	const secret = operatorPassword();
	return secret !== undefined && verifyPassword(candidate, secret);
}

export async function signIn(cookies: Cookies): Promise<void> {
	const secret = operatorPassword();
	// `passwordMatches` has already refused an unconfigured deployment, so a
	// missing secret here would be a programming error, not a case to swallow.
	if (secret === undefined) throw new Error('Cannot sign in: no operator password is configured.');

	// SvelteKit's defaults are httpOnly, with `secure` on except over
	// http://localhost. The cookie stays inside the admin area and the browser
	// drops it at the same moment the server stops honouring it.
	cookies.set(SESSION_COOKIE, await createSessionValue(secret), {
		path: COOKIE_PATH,
		sameSite: 'lax',
		maxAge: SESSION_LIFETIME_MS / 1000
	});
}

export function signOut(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: COOKIE_PATH });
}

/**
 * The secret is optional so a deployment without one still serves the audience:
 * the admin area stays locked rather than the whole app failing.
 */
export async function isSignedIn(cookies: Cookies): Promise<boolean> {
	const secret = operatorPassword();
	if (secret === undefined) return false;
	return isSessionValueValid(cookies.get(SESSION_COOKIE), secret);
}
