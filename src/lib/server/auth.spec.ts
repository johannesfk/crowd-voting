import { describe, expect, it } from 'vitest';
import { createSessionValue, isSessionValueValid, verifyPassword } from './auth';

const secret = 'operator-secret';
const now = 1_700_000_000_000;

/** Swaps one character for a different one, so a tampered value is never identical. */
function flip(text: string, at: number): string {
	const original = text[at] ?? '';
	return text.slice(0, at) + (original === '0' ? '1' : '0') + text.slice(at + 1);
}

describe('the operator session', () => {
	it('accepts a session it signed itself', async () => {
		const value = await createSessionValue(secret, now);
		expect(await isSessionValueValid(value, secret, now)).toBe(true);
	});

	it('rejects a session that is missing or mangled', async () => {
		const value = await createSessionValue(secret, now);
		expect(await isSessionValueValid(undefined, secret, now)).toBe(false);

		// One character changed, one truncated, one appended, and a value with
		// none of a session's parts in it.
		expect(await isSessionValueValid(flip(value, 16), secret, now)).toBe(false);
		expect(await isSessionValueValid(flip(value, value.length - 3), secret, now)).toBe(false);
		expect(await isSessionValueValid(value.slice(0, -2), secret, now)).toBe(false);
		expect(await isSessionValueValid(value + 'x', secret, now)).toBe(false);
		expect(await isSessionValueValid('nonsense', secret, now)).toBe(false);
	});

	it('rejects a session signed with a different secret', async () => {
		const value = await createSessionValue('another-secret', now);
		expect(await isSessionValueValid(value, secret, now)).toBe(false);
	});

	it('rejects a session long after it was issued', async () => {
		const value = await createSessionValue(secret, now);
		expect(await isSessionValueValid(value, secret, now + 365 * 24 * 60 * 60 * 1000)).toBe(false);
	});
});

describe('the operator password', () => {
	it('accepts the right password', async () => {
		expect(await verifyPassword('operator-secret', secret)).toBe(true);
	});

	it('rejects a password with a single character wrong', async () => {
		expect(await verifyPassword('operator-secre', secret)).toBe(false);
		expect(await verifyPassword('operator-secret-', secret)).toBe(false);
		expect(await verifyPassword('operator-sekrets', secret)).toBe(false);
	});

	it('rejects an empty password', async () => {
		expect(await verifyPassword('', secret)).toBe(false);
	});
});
