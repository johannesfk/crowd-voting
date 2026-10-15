// Removing a Contest: what the operator has to do before it happens.
//
// Deletion is the one thing here that cannot be walked back — it takes photographs
// of real people with no undo (ADR 0002) — so it is confirmed by re-typing the
// Contest's title rather than by a button that can be hit by accident during a
// busy evening. That is a rule about the Contest, not about HTTP, which is why it
// is expressed here and the route reads it.
//
// A pure function, like the rest of `#lib/contest/`: no request, no database, and
// no way for the route to decide on its own that a post is a confirmation.

/**
 * Whether what the operator typed is this Contest's title, and so their
 * confirmation to destroy it.
 *
 * Both sides are trimmed, because a stray space is not a different title and an
 * operator re-typing a long one on a phone keyboard should not be refused for it.
 * Nothing else is forgiving: a title one character out is a title somebody else
 * could have had in mind, and the whole point of typing it is that this is the
 * Contest they meant.
 */
export function confirmsDeletion(typed: string, title: string): boolean {
	return typed.trim() === title.trim();
}
