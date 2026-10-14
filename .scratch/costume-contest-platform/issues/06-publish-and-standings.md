# 06: Operator publishes, audience sees standings

**What to build:** the audience gets to see the result, at the moment the operator chooses. Once voting is closed, an audience member who opens the Contest link is shown a waiting page rather than an error. When the operator publishes, that page reveals the standings without the member reloading or doing anything. The standings are shared at a public link and ordered by votes, with tied costumes shown as sharing a place rather than one of them being given an invented win.

**Blocked by:** 05 Operator watches the Board and closes Voting

**Status:** ready-for-human

- [x] A member arriving at a closed-but-unpublished Contest sees a waiting page rather than an error or a ballot
- [x] Publishing is a deliberate operator action, separate from closing voting, and the standings stay private until it happens
- [x] The waiting page reveals the standings once the operator publishes, without the member reloading
- [x] The connection survives being interrupted, and recovers on its own
- [x] The standings are ordered by vote count, highest first
- [x] Tied costumes share a place, so the number of costumes shown in a place is not always one
- [x] The public standings show no operator-only information — no vote counts per device, no duplicate warnings
- [x] Publication is not reversible

## Comments

### One link, four phases

There is still one audience URL. It serves the registration form, then the ballot,
then the waiting page, then the standings — decided entirely by the phase, as the
path shape in the spec asks for. The spec's "results route" is this URL in its
published form rather than a second one, because story 6 promises one link that
works all evening and a separate results link would mean telling the room two.

### A live query that never yields will never render

`watchPublication` polls the phase and yields on change. Its first yield is not
optional, and getting that wrong hung the entire waiting page.

The generator began with `let published = false` and yielded only when the value
_changed_. On a genuinely unpublished Contest the first answer is `false`, which is
not a change, so the generator never yielded, the server waited on a stream that
would never speak, and every request for a waiting page timed out. It now starts
from `undefined` so the first answer always counts as one. Worth knowing because the
symptom pointed at the network rather than at the generator.

### Only Results waits

`isWaiting` is `phase === 'results'`, which is narrower than "has been scored" on
purpose. During voting the same link serves a ballot, and subscribing the waiting
query there put a never-ending connection on every guest's screen at the moment the
room was busiest — the fan-out ADR 0001 says not to build, arrived at by accident.
The whole suite hung on it, which is how it was found rather than argued.

### The public standings are a separate read, deliberately

`readPublicStandings` builds the audience's shape from the same ranking rule, and
nothing else. It is not `readBoard` with fields removed: the Board carries the
advisory Duplicate signal and the ballot total, and choosing which fields to drop is
how a duplicate warning ends up in front of the room a few releases later. Building
the public shape separately means there is no field to forget to remove. The test
asserts the rendered page contains no duplicate text, no ballot total, and no
operator control at all, against a Contest that really does have a duplicate
warning on the operator's Board.

### The reveal is the app catching up, not the guest refreshing

The live query can only say _that_ the result is out; the standings are the page's
own data, so `invalidateAll()` runs on the transition to published. That first
version re-read `revealed` without remembering it had already acted, so it re-fetched
on every re-evaluation — including the ones hydration itself causes. An effect that
fetches during hydration is a fetch in the middle of someone filling in a form, and
it showed up as the registration fixture losing what it had typed. It now fires once.

### Publication is two clicks and one direction

`publishResults` is named and guarded in `#lib/server/contest.ts`, refused out of any
phase but Results, and confirmed by the operator before it runs — the same shape as
`closeVoting`, and for the same reason. The machine has no edge back from Published,
so there is no `unpublish`, and a second publication is refused rather than
silently re-stamping the first, which is the only honest answer to "publish again".

`published_at` is a column the spec asked for and no ticket had created; migration
`0003` adds it.

### Frozen means gone, not greyed out

While the operator page previously rendered a disabled "Hide from the ballot" button
once voting opened, it now renders nothing. A disabled control on an admin page is
one a tired person clicks anyway, and the click being ignored teaches them the page
lies. Ticket 04's test asserted the button was disabled; that assertion is now
reversed, because the behaviour it described was the worse one.

### Verification (this machine)

`npm run check` ✓ (0 errors), `npx vitest run --project=server` ✓ (50 tests),
`npm run lint` ✓, `npx playwright test` ✓ (48 tests, 11 of them new).

Four consecutive full-suite runs at `--workers=1`, which is the honest count here:
the suite is heavy — 48 tests, each opening several browser contexts against one
local worker — and at three workers the hydration wait in the shared registration
fixture timed out repeatedly while every suite passed on its own. That looked like
the fan-out problem above and turned out to be the harness competing with itself, so
the suite's parallelism is the thing to lower before the product is.

Two bugs here were invisible to a single green run and were found by reading what a
timeout was actually waiting on: the generator that never yielded, and the effect
that fetched during hydration.
