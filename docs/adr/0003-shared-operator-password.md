# One shared operator password, held as a Worker secret

The Operator authenticates with a single shared password from a Worker secret, exchanged for a signed session cookie. There is no user table, no registration, and no password reset.

Rejected: Cloudflare Access in front of `/admin` — genuinely less code, but it moves authorization outside the repository where it cannot be read or tested alongside the app. Rejected: a user table with magic-link email — correct for a multi-organizer product, overkill for one operator; revoking is `wrangler secret put` rather than a migration.

## Consequences

The auth shape is deliberately narrow so Access can be swapped in later without a rewrite. Audience routes must remain entirely unauthenticated and must never be gated behind this check.