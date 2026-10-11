# 09: Operator corrects a typo in an Entry

**What to build:** the operator can fix a misspelled name or a mislabelled costume from the admin area, while the Contest is still in Registration. Nobody else can: the people who registered an Entry cannot amend it, and once voting opens nobody can amend it at all.

**Blocked by:** 03 Audience registers an Entry, operator moderates

**Status:** needs-triage

- [ ] The operator can edit an Entry's costume and its Participants, and nothing else
- [ ] Correcting an Entry leaves its photo alone, and does not replace the registered device
- [ ] Correcting an Entry is refused once the Contest has left Registration
- [ ] The correction is as final as the original registration: it cannot be undone

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
