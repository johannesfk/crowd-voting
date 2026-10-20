// Told apart from a real write failure: a unique index refusing a second row for the
// same key is a race the caller lost, not a bug to report.
//
// Matched on SQLite's own constraint marker rather than on D1's message text, which is
// free to reword. The check is deliberately cheap and a little loose — every caller
// re-reads the row it expected anyway, so being wrong here only costs a slower path
// rather than a wrong answer.

const UNIQUE_CONSTRAINT = 'SQLITE_CONSTRAINT';

/** Whether a failed write lost a race against a unique index. */
export function isUniqueViolation(cause: unknown): boolean {
	return cause instanceof Error && cause.message.includes(UNIQUE_CONSTRAINT);
}
