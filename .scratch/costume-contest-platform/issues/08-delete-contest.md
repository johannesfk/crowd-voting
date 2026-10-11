# 08: Operator deletes a Contest and its photos

**What to build:** the operator can remove a finished Contest and everything in it. Once the party is over, the Contest can be deleted from storage: its entries, its ballots, its standings and every photograph are gone. Because those photographs are of real people, deletion is confirmed by re-typing the Contest's title, and it is safe to retry — an interrupted deletion can be finished rather than leaving orphaned photos behind.

**Blocked by:** 03 Audience registers an Entry, operator moderates

**Status:** ready-for-agent

- [ ] A Contest can be deleted from storage by the operator at any phase
- [ ] Deletion is confirmed by re-typing the Contest's title, so it cannot happen by a single mis-tap
- [ ] Deletion removes the Contest's rows and the photo objects in object storage, not one or the other
- [ ] Deletion is safe to retry: an interrupted deletion can be run again to completion and leaves no orphaned photos
- [ ] A deleted Contest's link stops working, and does not resolve to a stale page or a cached entry
- [ ] Deletion is not reversible, and the app does not offer an undo
