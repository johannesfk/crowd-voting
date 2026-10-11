# 03: Audience registers an Entry, operator moderates

**What to build:** an audience member can enter the Contest and the operator can decide what reaches the ballot. The audience member opens the Contest link, adds their own name or the names of everyone in their group, says what they are dressed up as, and attaches a photo — either by taking one with the camera or picking one from their library. The photo is shrunk in the browser before it is uploaded, so registration completes on venue wifi. They submit, and are told they have entered; if they open the link again they are told they have already entered. Meanwhile the operator sees every Entry arriving with its photo, and can hide one that is inappropriate, unreadable, or a duplicate.

**Blocked by:** 02 Operator signs in and creates a Contest

**Status:** ready-for-human

- [x] Registration is reachable from the Contest link while the Contest is in registration, and shows the operator's sign-up notice when one is set
- [x] A group of any size can be entered as one Entry, with every participant named
- [x] A photo can be taken with the camera or picked from the library, and both paths are offered explicitly because modern Android no longer offers a camera tile in the picker on its own
- [x] The photo is downscaled in the browser before upload, and a registration still completes if that processing fails
- [x] A photo that is already small enough is not needlessly re-processed or degraded
- [x] Registration confirms success, and a returning visitor on the same device is told they have already registered rather than being shown the form again
- [x] The registration recorded is final: there is no editing, no correcting a name, no swapping the photo, and no withdrawing
- [x] The operator sees every Entry with its photo and names, as registrations arrive
- [x] The operator can hide an Entry before voting opens, and hidden Entries are absent from the ballot and from the standings
- [x] The photo is stored in object storage under a key derived from the Contest and the Entry
- [x] An Entry records which device registered it, so that the ballot can later recognise it as that device's own

## Comments

### Routes

The audience link is `/c/<contestId>` and the operator's entry list is
`/admin/contests/<contestId>`. `/c` is also the path of the device cookie, so the
token never travels to the admin area. `/c/<id>` is written to serve the ballot
too once ticket 04 lands; today it falls through to "Registration is closed" for
any later phase.

Photos are served to the operator only, from
`/admin/contests/<contestId>/entries/<entryId>/photo`, which checks the session
itself because it is a `+server.ts` route rather than a page. Nothing the audience
can reach hands out a photograph before voting opens (story 86); the ballot will
serve them itself, and only while it is live.

### Two rules live in the entry module, not in routes

`registerEntry` refuses a Contest that is no longer in Registration, and
`setEntryHidden` refuses one that has left it. Both checks are in
`#lib/server/entry.ts` so that no route can write past them: a guest who leaves
the form open past the close is redirected to the Contest link (which then serves
the current phase) rather than shown an error, and hiding an Entry once voting has
opened is refused outright. `listVisibleEntries` is the only query the ballot and
the standings will read, which is how a Hidden Entry leaves both.

### The device row carries the fields the later tickets need

`device` holds the hashed token, the shuffle seed fixed at first visit, and the
advisory network and fingerprint hashes (ADR 0004). Only the digest is stored, so a
copy of the database is not a set of credentials. The network and fingerprint
hashes are recorded but never consulted — nothing is refused on their basis — and
the Board will show them in ticket 05.

### Both photo inputs share one name, and an empty input still submits

The camera input and the library input are both `name="photo"`, and a file input
with nothing chosen submits an empty `File` under that name. `FormData.get('photo')`
therefore returns the empty one first, which reads as "no photo" even though the
guest chose one. The action takes the first entry that actually has bytes in it.

### The photo the browser prepared is the photo that is uploaded

`preparePhoto` runs on `change` and hands the processed `File` back to the input
through a `DataTransfer`, so the form submits exactly what was previewed — one
code path for no JavaScript, SvelteKit's `enhance`, and a plain browser alike. The
submit button stays disabled until processing finishes, which is both correct
behaviour and what stops the swap racing the submit. A file under 300 KB is
uploaded untouched: re-encoding it would only degrade it.

### What review changed

Two axes of review ran over the change and both found things worth keeping:

- `parseParticipants` no longer merges repeated names. Two people in a group may both
  be called Alex, and dropping one of them is worse than showing the operator a name
  twice.
- `acceptsEntries(phase)` moved the "still in Registration" test into the phase
  module, where it is unit-tested, instead of six copies of `phase === 'registration'`
  spread over routes and components.
- The device cookie is `httpOnly`: the token is a credential and nothing on an
  audience page needs to read it.
- The operator page no longer invents a "Frozen" label that is not one of the four
  phases, and `deletePhoto` was dropped rather than left for a ticket that has not
  been written.
- `EntryWithNames`, not `EntryWithParticipants`: the value is a name, not a row.
- The two photo assertions were strengthened. A 200px photo coming back as
  `image/png` is stored untouched, not merely unscaled; a 400KB file of random bytes
  is big enough to be worth processing and genuinely unreadable, so it exercises the
  fallback rather than the size guard that would have caught a smaller file.

### Verification (this machine)

`npm run check` ✓ (0 errors), `pnpm test:unit` ✓ (5 files, 19 tests),
`pnpm test:e2e` ✓ (11 tests, 6 of them new), `eslint src` ✓.

The two load-bearing assertions are both measured rather than asserted from prose:
a 1800px test photo arrives at the operator as 1600px, and a 200px one arrives at
200px, which is the only honest way to see whether the browser shrank it or left it
alone. The unreadable-photo case is a real registration with real bytes in it, not
a mock.

The `hidden` half of "absent from the ballot and from the standings" is only
observable once ticket 04 serves a ballot and ticket 06 a standings page; what
lands here is the rule those will read, the freeze that protects it, and a count of
what is left on the ballot.

Story 84 — the operator correcting a misspelled name — is not in any ticket. It is
recorded as `09-operator-corrects-entry.md` with `needs-triage`, rather than folded
in here, because the spec leaves two things about it undecided.
