# Outstanding — needs a human

Things that are deliberately not done, and why.

## Deployment

- [ ] **Create the remote D1 database.** `.env.d1` holds placeholders
      (`CLOUDFLARE_ACCOUNT_ID="local"` etc.). Generation and local runs work with
      those; `pnpm db:push` and a remote `wrangler d1 migrations apply` need real
      credentials.
- [ ] **Apply migrations to the remote database**, including `0002_first_cerise.sql`
      (the `ballot` and `vote` tables) and `0004_strong_quasar.sql` (the Podium's
      background). Local state under `.wrangler` already has them.
- [ ] **Create the R2 bucket** the `PHOTOS` binding points at, and confirm the binding
      name matches `wrangler.jsonc`. Nothing has ever run against real object storage —
      every photo so far has been a local Miniflare bucket.
- [ ] **Set the operator password in production**: `wrangler secret put OPERATOR_PASSWORD`.
      It is a deployment secret and is not in any file. Rotating it revokes every
      outstanding session (ADR 0003).
- [ ] **First deploy.** Nothing has been deployed. `npm run build` and the whole e2e
      suite pass against the local worker, which is the closest thing to a smoke test
      available without an account.
- [ ] **Decide whether a custom domain matters.** Contest identifiers are unguessable
      UUIDs, so the platform works on a workers.dev subdomain; a domain would only
      make the shared link shorter.

## Auth

- [ ] **Confirm one shared password is acceptable in production.** It is ADR 0003 and
      is a deliberate choice, not an oversight, but it means whoever has the password
      is the operator: they can hide Entries, close voting and publish the result.
      If that is wrong for a real party, the change is contained to
      `#lib/server/auth.ts` and the `/admin` layout guard.
- [ ] **No throttling on the login action.** Noted as a known limitation in ticket 02:
      one shared password and no user table means there is nothing to lock out and
      nowhere to count attempts without new storage.

## Worth deciding before the next ticket

- [ ] **The end-to-end suite is load-sensitive.** Every suite builds its own Contest
      with several browser contexts per test, and on a busy machine individual tests
      fail on the 60s timeout waiting for hydration rather than on anything to do with
      the change under test: the same run fails different tests each time, and the same
      failures reproduce with this ticket's work stashed. Either run the suites with
      fewer workers or make `finishContest`-style fixtures share one Contest across a
      serial block; both change what the suite costs rather than what it asserts, so
      neither is worth doing without a decision.
- [ ] **Duplicate-signal threshold.** Ticket 05 now warns only when two devices share
      a network _and_ a browser fingerprint _and_ agreed on two Entries. That is a
      judgement call about how much noise is acceptable. Watch it at a real party: if
      it never fires in practice the fingerprint is too coarse to ever be the thing
      that matters, and the honest response is to say so rather than loosen the
      threshold until something appears.
- [ ] **`spec.md` story 57** ("close registration and open voting in one action") is
      satisfied by ticket 04's operator button, not called out in any ticket file.
- [ ] **Tickets 08–09 are the ones left.** 07 (presentation) is done; 08 (delete) and
      09 (operator corrects an entry, `needs-triage` with two undecided questions)
      remain; there is still no ticket for the waiting page, the published standings, or
      the results phase, which ticket 05 leaves reachable but undecorated.

## Not a bug

- [ ] **A device token is a browser, not a person.** Registering on one phone and
      voting on another is two devices with nothing linking them (ADR 0004). This is
      documented rather than papered over; a guest on venue wifi is still one device.
