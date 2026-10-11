# 06: Operator publishes, audience sees standings

**What to build:** the audience gets to see the result, at the moment the operator chooses. Once voting is closed, an audience member who opens the Contest link is shown a waiting page rather than an error. When the operator publishes, that page reveals the standings without the member reloading or doing anything. The standings are shared at a public link and ordered by votes, with tied costumes shown as sharing a place rather than one of them being given an invented win.

**Blocked by:** 05 Operator watches the Board and closes Voting

**Status:** ready-for-agent

- [ ] A member arriving at a closed-but-unpublished Contest sees a waiting page rather than an error or a ballot
- [ ] Publishing is a deliberate operator action, separate from closing voting, and the standings stay private until it happens
- [ ] The waiting page reveals the standings once the operator publishes, without the member reloading
- [ ] The connection survives being interrupted, and recovers on its own
- [ ] The standings are ordered by vote count, highest first
- [ ] Tied costumes share a place, so the number of costumes shown in a place is not always one
- [ ] The public standings show no operator-only information — no vote counts per device, no duplicate warnings
- [ ] Publication is not reversible
