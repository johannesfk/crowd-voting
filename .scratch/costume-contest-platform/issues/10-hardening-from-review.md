# 10: Hardening and cleanup from the two-axis review

**What to build:** the findings from the 2026-10-17 whole-codebase review land. The correctness half closes real gaps against the spec — per-Contest device identity, a registration double-submit guard, race-safe phase transitions, the missing `cancel`-handler and the unsubstantiated device column. The cleanup half removes exact-duplicate logic and scaffold the review flagged. Nothing here changes what a guest or operator can do except in the ways the spec already asked for.

**Blocked by:** nothing — every prerequisite shipped (01–09 are done)

**Status:** ready-for-agent

- [x] The device token is scoped per Contest: opening a second Contest and returning to the first still recognises the first Contest's device, its own entry, its hasVoted state and its frozen shuffle
- [x] Registering twice from the same device cannot create two Entries: the guard is a unique index plus an insert that handles its own conflict, not the route's pre-check
- [x] Every phase transition and publication is race-safe: the write carries a `WHERE phase = expected` condition and a racing second publish is refused rather than re-stamping `publishedAt`
- [x] `publishResults` goes through the phase machine (`nextPhase`) instead of writing `phase: 'published'` directly
- [x] A vote cast between the two reads of `countVotes` cannot surface total+1 with stale standings
- [x] Dismissing the photo picker without choosing a file (the `cancel` event, guarded on an empty file list) restores the pick-a-photo state instead of pretending a registration happened
- [x] The operator's Entry list shows which device registered each Entry (story 85)
- [x] The operator-guard trio (`isSignedIn` + `getContest` + 404, repeated 7×) is one helper; `POLL_MS = 2000` exists once
- [x] The standings-row rendering is one component, used by both the public page and the operator board
- [x] `podium-image.ts` names the module-level photo cache honestly (`photoCache`), stops shadowing it with a local `loaded`, and the unbounded cache says in a comment why it never evicts
- [x] `src/lib/vitest-examples/` is deleted along with its references; `pnpm test:unit` still passes
- [x] `pnpm check` ✓, `pnpm lint` ✓, `pnpm test:unit` ✓, `pnpm test:e2e` ✓ (existing suites plus whatever this ticket adds)

Also resolved, either in code or on the spec page, whichever is the smaller edit:

- [x] Ballot-order inputs say one thing. Spec line 123: order is "derived server-side from the device token and a seed persisted on `device`"; `orderBallot` (`src/lib/contest/ballot.ts`) uses the persisted seed alone. Recommend: fix the spec line to "a seed persisted on `device`" — the seed is what makes the order stay the same across the Contest's life, which is the property the line is really claiming.

## Comments

### What the review found, itemised with where it landed

**Spec axis — correctness.**

1. **One device cookie serves every Contest.** `cv_device` is issued at path `/c` (`src/lib/server/device.ts:15-18`), resolved by `(contestId, tokenHash)` and re-minted on miss (`device.ts:58-68, 68-93`). A guest who touches Contest B clobbers Contest A's token: returning to `/c/A` creates a new device row — own entry unrecognised (`src/routes/c/[contestId]/+page.server.ts:47,63-64`), hasVoted lost, shuffle seed re-rolled. Story 5 makes touching two Contests normal; stories 37 and 39 fail when it happens. Fix: path-scoped `/c/[contestId]` cookie or a contest-suffixed name. The `device` table is already keyed per Contest — only the cookie scope is wrong. Add an e2e: register on Contest A, open Contest B, return to A — confirmation, own-entry pinning and the ballot's frozen order must survive.
2. **Registration double-submit race.** `castBallot` beds one-Ballot-per-device in a D1 unique index (`src/lib/server/db/schema.ts:149`, handling at `src/lib/server/ballot.ts:199-210`). Registration has no equivalent: `entry` (schema.ts:83-105) carries no unique index on `(contestId, deviceId)`, the pre-check lives in the route (`+page.server.ts:112`), and `registerEntry` inserts plainly (`src/lib/server/entry.ts:143-152`). Two concurrent posts both pass and both insert, and the ballot then pins only one own entry. Fix: migration adding the unique index + insert-on-conflict returning the existing Entry, doubling as the already-registered path. Note migration 0000's caveat from ticket 02 has lapsed — tables have shipped, so this is a forward patch, not a rebuild.
3. **Phase transitions race.** Transitions guard on a Contest snapshot fetched at action start; the writes carry no phase condition (`src/lib/server/contest.ts:72-79, 96-102, 122-127`; `ballot.ts:154` reuses the same snapshot). Two racing publishes both pass `current.phase !== 'results'` and the second overwrites `publishedAt` — contest.ts:113-116's own comment claims a refusal. A ballot or entry write can also land just after the phase moved. Fix: conditional update (`WHERE phase = expected`), treat no-rows-affected as the refusal, with `rowsAffected` as the test seam. Ticket 02's comment (createdAt in ms, generated rowversion not available) rules out optimistic version columns; the conditional update is the cheap shape.
4. **`cancel` handler missing.** Spec line 131: "Picker dismissal is detected via the `cancel` event, guarded on the file list being empty". `src/routes/c/[contestId]/+page.svelte:73-100` wires only `onchange` — the comment at lines 77-79 quotes the rule it does not implement. Fix: `oncancel` on the inputs, guarded on `target.files.length === 0`, clearing the transient "picked" state.
5. **Story 85 missing.** "I want to see which device registered which Entry" — no deviceId anywhere in the operator routes. Entry already stores the registering device; surface it as the short row tag the Board's duplicate-signal style already normalises. Advisory, like the Board's duplicate warning — same shared-wifi caveat.
6. **`countVotes` reads ballots then votes in two queries** (`ballot.ts:72-85`). Minor; a vote landing between them shows total+1 with stale standings. One join or two count queries read in the same statement closes it cheaply; do not reach for transactions D1 does not give you.

**Standards axis — cleanup.**

7. **`publishResults` writes `phase: 'published'` directly** (`contest.ts:122-127`), the only edge bypassing `nextPhase` — spec.md:108 says one function owns every transition. Folds naturally into finding 3's conditional-update rewrite: each edge becomes a `nextPhase`-driven conditional write.
8. **Operator-guard trio repeated 7×** (`isSignedIn(cookies)` + `getContest` + `error(404)`; required, since actions run before the layout guard — ticket 02's comment). One `requireOperator(locals/cookies)` helper or an `orElse404` wrapper collapses ~40 lines without changing any request's answer. `POLL_MS = 2000` is declared twice (`board.remote.ts:26`, `publication.remote.ts:18`); it lives wherever the poll loop itself will (or in a tiny shared module if the loops are too different).
9. **Standings-row markup duplicated.** Place · photo · costume · names · votes rendered twice: `src/routes/c/[contestId]/+page.svelte` (`<ol data-standings>`) and `src/lib/components/board.svelte`. The two pages keep separate reads; only the row component is shared. Careful with the `data-standings` hook — the e2e suite pins it.
10. **Shadowed cache in `podium-image.ts`.** Module cache `const loaded = new Map…` shadowed by a local `const loaded = new Promise…` inside `loadImage`; rename to `photoCache`. The cache is unbounded by design (Contest page, ≤ hundreds of photos, browser lifetime); say so in one comment.
11. **`src/lib/vitest-examples/`** — Starter scaffold (greet, Welcome), unreferenced by routes. Ticket 02 already recorded this as the suspect behind the `close timed out after 10000ms` noise. Delete; also re-check whether that warning disappears.
12. **Optional, judgement call.** `castBallot` re-derives `NoPicks` vs `TooManyPicks` by re-comparing against the rules `pickCountAllowed` (`src/lib/contest/ballot.ts`) already owns. Fine to skip if the phase-transition rewrite touches it; a `parsePicks` typed result is the in-seam shape.

Out of scope: no behaviour beyond this list — standings logic, shuffle determinism, ranking with shared placement, deletion and the reveal all match the spec and stay untouched. The duplicate-signal strictness (≥2 shared entries, not just hash equality) stays as-is; the review called it the stricter of two defensible readings, not a defect.

### Where it landed

Every item above is implemented, except one deliberately skipped: `parsePicks` keeps its
current shape (finding 12, the sanctioned judgement call — the count rules are already in
one module, and the rewrite would not have changed a single behaviour).

**The correctness half.**

- `src/lib/server/device.ts` — the device cookie is now scoped to `/c/<contestId>`
  (`cookiePathFor`), so one browser holds one token per Contest. The new
  `device-identity.e2e.ts` registers in two Contests from one browser and then checks all
  four consequences: two cookies by path, the own Entry still pinned, the ballot order
  byte-identical across a trip to the other Contest, and the cast Ballot still cast.
- `src/lib/server/db/schema.ts` + `migrations/0005_omniscient_vermin.sql` — a unique index
  on `entry(contest_id, device_id)`, applied as a forward migration (the tables have
  shipped, so no 0000 rebuild this time). `db/constraint.ts` holds the one
  `isUniqueViolation` predicate that both `registerEntry` and `castBallot` now share;
  `registerEntry` names the loser `AlreadyEntered`, stores no photo for it, and the
  registration route turns that into the same redirect as the already-entered path.
- `src/lib/server/contest.ts` — one private `advance()` writes a phase edge with the phase
  it is leaving in the `where`, so a second writer finds no row and gets the same refusal
  its own precondition gives. `openVoting`, `closeVoting` and `publishResults` all go
  through it, and `publishResults` now takes its phase name from `nextPhase` instead of
  spelling `'published'` (finding 7).
- `src/lib/server/ballot.ts` — `castBallot` re-reads the phase rather than trusting the
  caller's snapshot, and `countVotes` reads Ballots and their Votes in one joined
  statement, so a Ballot landing mid-read cannot show a total with no counts behind it.
- `src/lib/server/entry.ts` — one `stillAcceptingEntries` re-read is now the freeze guard
  for registering, hiding and correcting alike.
- `src/routes/c/[contestId]/+page.svelte` — `oncancel` on both photo inputs, guarded on an
  empty file list, resets the prepared photo and disables the button; the e2e fires the
  event rather than a dialog a headless browser cannot open.
- The operator's entry list shows `Device <8 hex>` per Entry (`data-entry-device`), from
  the device id the Entry already carried.

**The cleanup half.**

- `#lib/server/operator.ts` — `requireOperator` / `requireOperatorContest` replace the
  session-plus-Contest-plus-404 trio at every operator action, load and the group layout
  (7 sites to 1 line each).
- `#lib/poll.ts` — one `POLL_MS`, imported by both live queries.
- `#lib/components/standing-row.svelte` — the place, photo, costume, names and (operator
  only) count are rendered once; each page keeps its own read and its own chrome.
- `podium-image.ts` — the module cache is `photoCache`, no longer shadowed by a local
  `loaded`, with the reason it never evicts written down.
- `src/lib/vitest-examples/` deleted. The `close timed out after 10000ms` note from ticket
  02 is _not_ explained by it: the warning survives, so the platform proxy is still the
  suspect.
- `spec.md` line 123 now says the ballot order comes from "a seed persisted on `device` at
  the device's first visit", which is what `orderBallot` actually does.

**Verification.** `pnpm check` 0 errors; `pnpm lint` clean; `pnpm test:unit` 83 tests in 8
files (was 10 files with the scaffold), all green. `pnpm test:e2e`: 76 tests, 75 passed and
1 flaky (it passed on retry) — run with `--workers=1 --retries=1`, because the suite is
flaky in this checkout at default parallelism for a pre-existing reason: the shared `enter`
fixture waits up to 30 s for hydration before the photo preview appears, and a parallel run
times that wait out. The unmodified tree fails 12 of 71 the same way, so this is not from
this ticket.

**Two honest limits on the new race tests.** The concurrent-registration and
concurrent-publication tests pin the _outcome_ (one Entry, one publication, both callers
answered as though nothing went wrong) whichever way the two requests interleave. Neither
proves the mechanism on its own: a local D1 tends to serialise the pair, so both tests also
pass with the unique index dropped and with the phase condition removed (checked, then
reverted). What they protect is the invariant; the index and the conditional write are what
hold it when the requests really do interleave.
