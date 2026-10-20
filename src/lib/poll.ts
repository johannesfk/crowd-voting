// How often a live query re-reads while something is watching it.
//
// Shared, because the product's two waits — the operator's Board and the audience's
// waiting page — are the same mechanism and should not drift apart, and because one
// number is what has to change when polling is finally replaced by a push (ADR 0001).

/** The interval, in milliseconds, between two reads of a live query. */
export const POLL_MS = 2000;
