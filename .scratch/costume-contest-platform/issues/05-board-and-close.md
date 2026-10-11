# 05: Operator watches the Board and closes Voting

**What to build:** the operator can see how the contest is going and end it. While voting is open, the admin area shows every Entry with its vote count updating as ballots arrive, ordered by count, together with how many ballots have been cast. Where two ballots look as though they came from the same device, the operator is warned — but that warning is advisory only, because guests on shared venue wifi are never refused a vote. The operator then closes voting, which freezes the result and leaves it private.

**Blocked by:** 04 Audience casts a Ballot

**Status:** ready-for-agent

- [ ] The Board shows every visible Entry with its vote count, ordered by count, and the total number of ballots cast
- [ ] The Board updates while voting is open without the operator reloading the page
- [ ] The Board is never reachable by an unauthenticated visitor, and the audience sees no standings at all before publication
- [ ] Where two ballots appear to come from the same device, the operator is warned with the entries they share
- [ ] The warning is advisory: no vote is ever refused because of it, and a room sharing one network address is not penalised
- [ ] Closing voting is a deliberate action, freezes the standings, and is not reversible
- [ ] After voting closes, no further ballots are accepted from anyone
- [ ] The operator is warned if they open voting with nothing to vote on
