# 04: Audience casts a Ballot

**What to build:** an audience member can vote. Once the operator opens voting, the Contest link becomes a ballot instead of a registration form. It shows every costume with its names, what it is dressed up as, and its photo, in a shuffled order that stays the same each time that member looks — so nobody can reload until their favourite lands at the top. The member picks one, two, or three costumes, and is stopped at three. Their own Entry appears marked as theirs, unselectable, and outside the shuffled grid so it never takes a slot from a costume they could have chosen. They submit, and their vote is final.

**Blocked by:** 03 Audience registers an Entry, operator moderates

**Status:** ready-for-agent

- [ ] The Contest link serves the ballot instead of the registration form once voting opens, and shows the operator's voting notice when one is set
- [ ] The ballot order is randomised, is derived on the server, and is identical on every visit by the same device and different between devices
- [ ] A ballot may hold one, two, or three picks, and a fourth is refused
- [ ] Each pick is a distinct Entry, so an Entry cannot be picked twice on one ballot
- [ ] All picks weigh equally; the rank of an Entry is simply how many ballots contain it
- [ ] The member's own Entry is shown marked as theirs, is unselectable, and sits outside the shuffled grid rather than occupying a slot
- [ ] Picks can be changed while the ballot is open, and a submitted ballot is final — never amended, replaced or withdrawn
- [ ] A device that has already cast a ballot is recognised, and the ballot is not offered to it again
- [ ] A device that has already cast a ballot is not refused with an error but shown that its vote is in
- [ ] A guest who leaves the form open past the close is not able to land a late ballot; they are shown the waiting page instead
- [ ] Registration is no longer accepted from the same link once voting opens
