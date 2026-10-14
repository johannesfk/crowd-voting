# 05: Operator watches the Board and closes Voting

**What to build:** the operator can see how the contest is going and end it. While voting is open, the admin area shows every Entry with its vote count updating as ballots arrive, ordered by count, together with how many ballots have been cast. Where two ballots look as though they came from the same device, the operator is warned — but that warning is advisory only, because guests on shared venue wifi are never refused a vote. The operator then closes voting, which freezes the result and leaves it private.

**Blocked by:** 04 Audience casts a Ballot

**Status:** ready-for-human

- [x] The Board shows every visible Entry with its vote count, ordered by count, and the total number of ballots cast
- [x] The Board updates while voting is open without the operator reloading the page
- [x] The Board is never reachable by an unauthenticated visitor, and the audience sees no standings at all before publication
- [x] Where two ballots appear to come from the same device, the operator is warned with the entries they share
- [x] The warning is advisory: no vote is ever refused because of it, and a room sharing one network address is not penalised
- [x] Closing voting is a deliberate action, freezes the standings, and is not reversible
- [x] After voting closes, no further ballots are accepted from anyone
- [x] The operator is warned if they open voting with nothing to vote on

## Comments

### Shape

Ranking is a pure function in `#lib/contest/standings.ts`, alongside the advisory
`findDuplicateSignals`. Reading the counts is `#lib/server/ballot.ts`'s
`countVotes` and `listVotingDevices`; composing them into one read is
`#lib/server/board.ts`; the live connection that re-reads it is `src/lib/board.remote.ts`;
and the page renders it in `src/lib/components/board.svelte`.

The read lives outside the `.remote` file on purpose. A `.remote` module may export
nothing but remote functions, so the query has to wrap a read that something else —
the page's own server load — can also call.

### A `.remote` file must not live under src/lib/server/

`src/lib/server/board.remote.ts` builds fine and fails at `vite build` with
`config_feature_disabled`, whose message — "to enable remote functions" — points
exactly the wrong way, because remote functions are already enabled in
`vite.config.ts`. The real cause is in the SvelteKit server-only-import guard:
everything under `src/lib/server/` is server-only, including a `.remote` module put
there, so a client component importing it is a client entrypoint reaching a
server-only module — which the guard reports as a missing feature rather than as the
misplaced file it is.

The file now sits at `src/lib/board.remote.ts`, beside the component it serves.
Worth knowing because the error message will send anyone else down the wrong path.

### The live query, and what it deliberately is not

`query.live` is what the spec asked for: a generator the client stays connected to,
with reconnect and deduplication handled by the framework. It polls every two seconds
rather than being pushed to. A Durable Object broadcast hub is the documented upgrade
if this ever has to fan out (ADR 0001) and is not built now — the audience for this
data is one operator looking at one screen, and the only thing a push would buy is
noticing a vote a second sooner.

The Board stays on screen after voting closes, reading the result once instead of
streaming it. The operator is the one who publishes and presents the result, so a
page that went blank at the moment they needed it would be exactly wrong; what stops
when voting stops is the connection, not the numbers. `hasBeenScored` in the phase
module owns that question rather than the component.

### The duplicate signal needs both signals, and that is the interesting decision

`device.networkHash` and `device.fingerprintHash` are recorded but unread since
ticket 03. Read naively, either one on its own is noise at a real party:

- a shared **network address** is the access point. Everybody in the room has it.
- a shared **fingerprint** is a user agent and a language. Everybody on the same model
  of phone has it, which at a party is most of the room.

So `findDuplicateSignals` groups by _both_ together and additionally requires the
group to have agreed on at least two Entries. What survives is one person, two
browsers or two tabs, in one place, voting the same way — the only reading that is
evidence rather than scenery. A warning the operator cannot act on teaches them to
ignore the one warning that matters.

This was not the first design. The first reported network groups and fingerprint
groups separately, and the e2e caught it immediately: every Playwright context shares
a user agent, so the Board filled with warnings in a test where nothing was wrong.
That is the same property a real party has, which is how the flaw was found rather
than argued.

The warning is advisory in the strongest sense available: `findDuplicateSignals` is
only ever called by the Board's read, its result is never passed to `castBallot`, and
there is no parameter on any code path that could turn it into a refusal.

### Closing voting is two clicks, because it cannot be undone

The phase machine does not run backwards, so closing is final. One button that ends a
contest on a mis-click during a busy evening is not a control, so the first press asks
and the second confirms, with the confirmation a plain link back. The edge itself is
`closeVoting` in `#lib/server/contest.ts`, named and guarded exactly as `openVoting`
is: ticket 04's review rejected a generic one-step mover precisely because a later
ticket could call it to skip this deliberate close.

A guest who had the ballot open all evening and pressed send after it closed is sent
to the contest link, which serves the phase it is in now. That half of ticket 04's
late-ballot criterion is now observable from both sides.

### Opening with nothing to vote on is a warning, not a refusal

A contest where every Entry is hidden, or where nobody entered, would give the room an
empty ballot. The operator is told and asked again rather than met with an error, on
the grounds that running an empty contest is a mistake worth one more click rather
than one worth a dead end.

### Verification (this machine)

`npm run check` ✓ (0 errors), `npx vitest run --project=server` ✓ (48 tests, 16 of
them new), `npm run lint` ✓, `npx playwright test` ✓ (34 tests, 12 of them new).

Twenty consecutive full-suite runs with no failure — twelve at `--workers=4` and eight
at `--workers=6` — which is the bar ticket 04 set after a single green run turned out
to prove nothing. The two runs that did fail during development found the `.remote`
placement and the duplicate-signal threshold, both of which a single run would have
happened to miss.

Two things about the e2e worth recording, because both cost time and neither is
obvious. The worker reads `cf-connecting-ip` before `x-forwarded-for`, so a test that
sets only the latter is silently testing the same network for every context — which
made a "different networks" case pass for the wrong reason until the header was set
properly. And the Board count lives in its own `<span data-ballot-total>` rather than
in the sentence around it, because asserting the text of a `<p>` that also explains
itself means every copy change breaks a test about the count.
