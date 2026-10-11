# Hard delete cascades from Contest to R2 objects

Deleting a Contest permanently removes its entries, votes and every photo object in R2. There is no soft-delete staging area.

Rejected: two-step delete (hide, then purge) — it defers the only part that matters, since the photos are the data people would want gone, and it means the staging area is never actually purged. Rejected: deleting rows but keeping images — keeping photographs of people after deleting the reason they consented to them is worse than either alternative.

## Consequences

Deletion is guarded by a typed confirmation (re-entering the contest title) because it destroys other people's photographs with no undo. The delete path must enumerate R2 keys by contest prefix and can fail partway; it needs to be idempotent so a retry completes the job rather than leaving orphaned objects.