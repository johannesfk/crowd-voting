# 08: Operator deletes a Contest and its photos

**What to build:** the operator can remove a finished Contest and everything in it. Once the party is over, the Contest can be deleted from storage: its entries, its ballots, its standings and every photograph are gone. Because those photographs are of real people, deletion is confirmed by re-typing the Contest's title, and it is safe to retry — an interrupted deletion can be finished rather than leaving orphaned photos behind.

**Blocked by:** 03 Audience registers an Entry, operator moderates

**Status:** ready-for-human

- [x] A Contest can be deleted from storage by the operator at any phase
- [x] Deletion is confirmed by re-typing the Contest's title, so it cannot happen by a single mis-tap
- [x] Deletion removes the Contest's rows and the photo objects in object storage, not one or the other
- [x] Deletion is safe to retry: an interrupted deletion can be run again to completion and leaves no orphaned photos
- [x] A deleted Contest's link stops working, and does not resolve to a stale page or a cached entry
- [x] Deletion is not reversible, and the app does not offer an undo

## Comments

### Where it lives

`deleteContest` in `#lib/server/contest.ts`, `deleteContestPhotos` in
`#lib/server/photos.ts`, and one `delete` action on the Contest page. The
confirmation rule is the pure `confirmsDeletion` in `#lib/contest/deletion.ts`,
the only new domain file — it is a rule about the Contest rather than about HTTP,
and the route reads it instead of deciding for itself.

### Photographs first, rows second

The order is the whole retry story, so it is worth stating: photographs are
removed before the Contest row, not after. The rows are what a second run needs
in order to find the Contest and enumerate what it still owns, so a run that took
the rows first and then failed would leave photographs of real people in storage
with nothing pointing at them and no link to resume from. In this order an
interrupted run leaves the Contest standing and the same run finishes it.

The rows themselves go in one statement, so the schema's cascades (entries take
participants and votes, the Contest takes devices, entries and ballots) either all
happen or none does. That cascade was checked against SQLite directly before the
code was written, because `entry.device_id` and `ballot.device_id` point at
`device` with no action and that ordering could have failed.

### No phase guard

Deletion is not a step on the machine, so it has none of the machine's rules: a
Contest abandoned halfway through Registration is as finished as one that was
Published, and asking the operator to run a cancelled party through voting first
would be asking them to invite a room to it.

### What the tests do and do not prove

Five Playwright tests through the built worker, plus four unit tests on the
confirmation rule. Two honest limits:

- **The interrupted-and-resumed run is reasoned, not provoked.** Provoking a
  failure halfway through would mean fault-injecting storage, which the Testing
  Decisions rule out, and neither agreed seam can ask for it. What is tested is
  that a second run of a completed deletion is a plain 404 rather than an error to
  act on, and that nothing resurfaces. The guarantee itself rests on the ordering
  above, the prefix enumeration, and R2 not minding a key being deleted twice.
- **The ballots and votes are evidenced by argument.** Nothing in the app counts a
  Ballot for a Contest that does not exist, so there is no surface on which to
  watch one disappear; what is observed is the Contest answering 404 from both
  sides and its photographs answering 404 from both sides.

### A photograph already downloaded is not a server's to retract

The audience photo route sends `private, max-age=60` by ticket 04's decision, so
for up to a minute after a deletion a guest's own browser can still render a
photograph it fetched before. Deletion stops the worker serving it to anyone,
which is the half a server can do; the other half sits in a browser cache no
server can reach. The tests ask the worker what it answers rather than what one
browser still holds, and say so where they do it.

### Load on this machine

`pnpm exec playwright test --workers=2`: 60 passed, 4 failed — all four in
pre-existing suites, all four the `[data-photo-preview]` hydration timeout, and the
same failures reproduce with this ticket's work stashed. See the standing note in
`docs/todo.md`.
