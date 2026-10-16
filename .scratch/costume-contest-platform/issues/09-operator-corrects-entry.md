# 09: Operator corrects a typo in an Entry

**What to build:** the operator can fix a misspelled name or a mislabelled costume from the admin area, while the Contest is still in Registration. Nobody else can: the people who registered an Entry cannot amend it, and once voting opens nobody can amend it at all.

**Blocked by:** 03 Audience registers an Entry, operator moderates

**Status:** ready-for-agent

- [x] The operator can edit an Entry's costume and its Participants, and nothing else
- [x] Correcting an Entry leaves its photo alone, and does not replace the registered device
- [x] Correcting an Entry is refused once the Contest has left Registration
- [x] The correction is as final as the original registration: it cannot be undone

## Decisions

Taken at triage, on the two questions the comment below left open.

- **Participant rows keep their positions.** A Correction is a rename in place plus
  appends and removals at the end, not a rewrite of the whole list. Nothing else in
  the platform refers to a Participant row, so this is about the shape of the domain
  rule rather than about a reference staying valid: an operator fixing the third
  person in a group of five changes that person and nobody else.
- **A guest sees the corrected names.** The confirmation already reads the names from
  the database rather than from a copy taken at registration, so a Correction shows
  up the next time the registering device opens the link, with nothing extra to store.
- **The Correction is inline on the operator's Entry list**, beside the existing Hide
  control and available while the list is modifiable, because that is where every
  other moderation act already is. Hiding stays reachable while the form is open:
  they are two decisions, and spotting both at once should not mean abandoning one.

## Comments

### Found while implementing 03

Spec story 84 — "As an operator, I want to edit a registration to fix a typo" — and the
"Registration finality" implementation decision ("the operator may correct an Entry from
the admin area while the Contest is still in Registration; once voting opens, that goes
too") have no ticket covering them. Ticket 03 delivers the audience half of the rule
(entries are final for the people who registered them) and the freeze that a correction
would have to respect, but not the operator half.

Needs triage because two things are undecided: whether replacing the names means
rewriting the `participant` rows or keeping their positions stable, and whether a
correction is visible to the guests whose names it changes.

Triaged and implemented. The two open questions are answered under **Decisions** above.

Where it landed:

- `src/lib/contest/correction.ts` — the pure rules, none of them with a database
  behind them: `isCorrectionWorthMaking`, `parseCorrectedNames` (one box per
  Participant, a blank box ends the list) and `planNameCorrection` (renames in place,
  additions at the end, removals from the end).
- `correctEntry` in `src/lib/server/entry.ts`, guarded by `acceptsEntries` on the same
  edge the Entry list freezes at and refusing the same empty correction the route
  refuses, written as one batch so an Entry is never left half corrected.
- A `?/correct` action on the operator's Contest page, and the form inline on the Entry
  list beside the Hide control. Opened by URL rather than component state, so it works
  before the bundle has loaded; a refusal re-opens the form with what was typed still
  in it, in the Correction's own words rather than the Hide control's.

Verified at both agreed seams: 13 unit tests over the pure rules, and
`operator-corrects-entry.e2e.ts` over the whole slice — the Correction itself, who is
in a group, the empty refusal, the freeze, the refusal that arrives after voting opened
under the operator, no session, and the absence of any way back.
