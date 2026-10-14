# 04: Audience casts a Ballot

**What to build:** an audience member can vote. Once the operator opens voting, the Contest link becomes a ballot instead of a registration form. It shows every costume with its names, what it is dressed up as, and its photo, in a shuffled order that stays the same each time that member looks — so nobody can reload until their favourite lands at the top. The member picks one, two, or three costumes, and is stopped at three. Their own Entry appears marked as theirs, unselectable, and outside the shuffled grid so it never takes a slot from a costume they could have chosen. They submit, and their vote is final.

**Blocked by:** 03 Audience registers an Entry, operator moderates

**Status:** ready-for-human

- [x] The Contest link serves the ballot instead of the registration form once voting opens, and shows the operator's voting notice when one is set
- [x] The ballot order is randomised, is derived on the server, and is identical on every visit by the same device and different between devices
- [x] A ballot may hold one, two, or three picks, and a fourth is refused
- [x] Each pick is a distinct Entry, so an Entry cannot be picked twice on one ballot
- [x] All picks weigh equally; the rank of an Entry is simply how many ballots contain it
- [x] The member's own Entry is shown marked as theirs, is unselectable, and sits outside the shuffled grid rather than occupying a slot
- [x] Picks can be changed while the ballot is open, and a submitted ballot is final — never amended, replaced or withdrawn
- [x] A device that has already cast a ballot is recognised, and the ballot is not offered to it again
- [x] A device that has already cast a ballot is not refused with an error but shown that its vote is in
- [x] A guest who leaves the form open past the close is not able to land a late ballot; they are shown the waiting page instead
- [x] Registration is no longer accepted from the same link once voting opens

## Comments

### Where the rules live

Pure rules in `#lib/contest/ballot.ts`: `parsePicks` (de-duplicates, so one Entry
cannot become two picks), `pickCountAllowed` (one to three), `orderBallot` (the
shuffle) and `tallyVotes` (every pick counts the same, no 3/2/1). Every rule about
the _ballot_ is in `#lib/server/ballot.ts` — `castBallot` refuses a Contest that is
not in Voting, a device that has already voted, zero or four picks, an Entry the
operator hid, and the device's own Entry. No route can write past any of them,
which is the same shape as ticket 03's two rules in `#lib/server/entry.ts`.

`vote` has a composite primary key on (Ballot, Entry), so a repeated pick is
impossible at the database rather than merely unlikely. `ballot` has a unique index
on (Contest, device), which is what actually enforces one Ballot per device.

### The shuffle is a seeded Fisher-Yates, and the seed was already there

`orderBallot` is a Fisher-Yates driven by mulberry32 seeded from `device.shuffleSeed`
— a column ticket 03 already wrote and nothing read. FNV-1a hashes the seed string
because it is three lines and dependency-free. Fisher-Yates rather than the obvious
swap loop because the swap loop leaves the last Entry biased towards the end, and
that bias would be invisible from the ballot itself; the unit test asserts ten seeds
produce more than one distinct first Entry rather than trusting it.

### The Own entry is taken out of the grid, not shown in it

An unselectable card in a grid of three would spend one of a guest's picks on
something the rules forbid, so `load` shuffles the visible Entries and _removes_ the
device's own from the result. It is passed separately and pinned above the grid.
`castBallot` refuses it again server-side, because the card being unselectable in the
browser is not a rule.

### Two findings worth recording

1. **A Hidden Own entry is absent, not pinned.** `findEntryByDevice` returns whatever
   the device registered, hidden or not — they _did_ enter, and the registration
   confirmation says so. The ballot reads a separate `ballotOwnEntry` that is
   `undefined` when hidden, because a Hidden Entry is absent from the ballot
   (story 42) rather than shown unselectable. Its photograph 404s too, so leaving it
   pinned would have rendered a broken image. Covered by a test where the _hiding_
   device is the _registering_ device, which is the case the obvious implementation
   gets wrong.
2. **`hasVoted` is not gated on the phase.** A Ballot was cast once and stays cast,
   so the confirmation outlives voting closing. Gating it on the phase made a guest
   who had voted fall through to the waiting page telling them to keep the link for
   voting, in a phase where voting is over.

### The Ballot and its Votes are written in one batch

Two autocommitted statements with a compensating delete would leave a Ballot with
zero Votes behind if the Worker died between them, and a device with a cast Ballot
can never vote again — that failure costs somebody their vote permanently. D1's
`db.batch` makes it one atomic unit. The unique index firing inside that batch is
also how a double-pressed Send is handled: both posts pass the pre-check, the loser
of the race is translated into `AlreadyVoted`, and the guest is shown their vote
rather than a 500. The submit button is deliberately not disabled while in flight,
because a disabled button is worse on a slow connection than an idempotent post.

### Two forms on one page, so both actions are named

SvelteKit refuses a `default` action on a page that has any named ones
(`action_default_with_named`), and `/c/[contestId]` has the registration form and
the ballot. Both are named (`?/register`, `?/ballot`) and both forms name their own
action, so no-JavaScript, `enhance` and a hand-rolled post all reach the same place.

### A real bug this ticket found, in a ticket that was already "done"

Svelte 5 hydration re-applies a `value` attribute to a form field, which wiped
anything typed before the page finished loading: a guest on venue wifi who starts
typing the moment the form appears loses their names, and finds out only by being
told "A name and a costume are needed to enter". The fix is `defaultValue`, which
Svelte treats as the initial value and never re-applies. This affected the
registration form (ticket 03) and the operator's Contest form (ticket 02), both of
which were marked done. It is fixed here and pinned by a test in
`audience-registers.e2e.ts` that types before hydration and asserts the group
survives; reverting the fix makes that test fail roughly a quarter of the time,
which is the rate that makes it a real assertion rather than a passing one.

Found by running the suite repeatedly rather than once: it passed 12 consecutive
runs on `main` and failed within 1–3 runs on the branch, which is what pointed at a
behavioural change rather than at the local database, the machine's load, or the
form-submission timing it first looked like.

### The e2e fixtures are shared

`test/contest.ts` holds signing in, creating a Contest, filling it with real guests
and opening voting, because all three tickets now need the same handful of things and
ticket 03 already had a private copy. `postForm` builds the body by hand rather than
through Playwright's `form` option, because a repeated field is how a browser sends
several picks and what the worker's own guard reads. Ticket 05 will need these too.

### What review changed

A review over the diff found six things, all fixed:

- the Hidden Own entry described above;
- the double-submit 500 and the non-atomic write, both now in `castBallot`;
- `advanceContest` was a generic one-step mover that a later ticket could call to
  skip the deliberate close of voting, so it is now `openVoting`, which asserts the
  Contest is in Registration before moving it and refuses otherwise;
- the Registration→Voting edge was spelled as a phase literal in a route, which is
  what `acceptsEntries` exists to prevent;
- `hasVoted` and the operator's "Voting is open" line are now both phase-aware, the
  latter so ticket 05 does not inherit a page claiming the room is still voting
  after it has closed.

### Verification (this machine)

`npm run check` ✓ (0 errors), `npx vitest run --project=server` ✓ (32 tests),
`pnpm test:e2e` ✓ (23 tests, 13 of them new), `eslint` ✓. Ten consecutive full-suite
runs at `--workers=4` with no failure, which is how the hydration bug was pinned
down; the suite had been flaky on this branch and was not before.

Two criteria are partly observable in this ticket and partly not, and it is worth
saying which is which. "The rank of an Entry is simply how many ballots contain it"
is `tallyVotes` and is unit-tested exhaustively, but nothing reads it until ticket 06
computes standings, so there is no route that can yet show a vote count. The
late-ballot half of criterion 18 — a guest who leaves the form open _past the
close_ — needs a close action to leave a phase, which is ticket 05's; what lands here
is the guard that refuses any ballot outside Voting, tested from the before side.

Story 42 was already asserted by ticket 03 as "the rule the ballot will read" and is
now observed end to end, including the Own-entry case.
