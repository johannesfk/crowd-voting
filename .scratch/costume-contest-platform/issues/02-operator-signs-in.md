# 02: Operator signs in and creates a Contest

**What to build:** the operator can get into the admin area and set up a Contest. They navigate to the admin area, enter the shared password, and are signed in. They create a Contest with a title, a description, an optional note shown to people signing up, and an optional note shown to people voting. The new Contest appears in their list, with its current phase shown as registration. Signing out returns them to the login screen and the admin area becomes unreachable.

**Blocked by:** 01 Foundations

**Status:** ready-for-human

- [x] The admin area is unreachable without signing in; phase controls and standings never leak to an unauthenticated visitor
- [x] Signing in with the shared password from a deployment secret issues a signed, http-only session scoped to the admin area
- [x] A Contest can be created with a title and description, and with both optional notices left empty
- [x] Contest identifiers are unguessable rather than human-readable, so an unpublished Contest cannot be found by guessing a URL
- [x] The Contest list shows every Contest with its phase, and several Contests can exist at once
- [x] Signing out ends the session and the admin area becomes unreachable again

## Comments

### Shape

A route group does the guarding: `src/routes/(operator)/+layout.server.ts` redirects
any visitor without a signed session to `/admin/login`, which sits outside the group
so the login route itself stays reachable. The audience route tree is untouched, and
no admin route imports anything that could reach a Contest without passing the guard.

Pure domain in `#lib/contest/phases.ts` (the phase machine, exhaustively unit-tested),
data access in `#lib/server/contest.ts`, session and password in
`#lib/server/auth.ts`, and routes that only marshal form fields. Phase display vocabulary
lives in `PHASE_LABELS` in the phase module, so the operator, the audience and the homepage
spell the four phases one way.

### The session

`v1.<expiry>.<HMAC>` in an http-only cookie, `path=/admin`, `sameSite=lax`, 12 hours.
The shared password is also the signing key, so rotating the secret revokes every
outstanding session — which is what ADR 0003 already promised. Signing out deletes the
cookie, and `/admin/logout` is a POST rather than a link so nothing prefetchable can end
a session.

### Where the secret comes from

ADR 0006. `#lib/server/secrets.ts` reads the Worker environment
(`cloudflare:workers`), so `wrangler secret put` in production and `.dev.vars` locally
are the one source of truth for both `npm run dev` and the built worker. `$app/env/private`
was rejected: in dev it is fed from `.env` files by `vite.loadEnv`, so the password would
have to be declared twice, in two files that can silently disagree.

### Two things that cost a day, recorded so they cost nobody another

1. **Actions run before the layout guard.** SvelteKit runs a page action before the
   layout's `load`, so guarding only the layout left the create-Contest action open to
   a sessionless POST. Every mutating action now checks `isSignedIn` itself
   (`(operator)/admin/contests/new/+page.server.ts`), and the e2e suite posts straight at
   the action without a session to keep it that way.
2. **`?/default` is a reserved action name in SvelteKit 3.** Posting to
   `/admin/contests/new?/default` throws `action_name_reserved`; a plain form posts to the
   page's own URL and lands on the `default` action. Don't "fix" this by renaming the
   action.

Also: `event.platform` is null on requests with adapter-cloudflare in SvelteKit 3 — bindings
come from `import { env } from 'cloudflare:workers'` (see ADR 0006), which is why the data
layer takes no db argument.

### Local database

There is no remote D1 yet, so migrations are local-only: `drizzle-kit generate` writes
`migrations/NNNN_*.sql`, and `npx wrangler d1 migrations apply crowd-voting --local`
applies them to the D1 database `wrangler dev` keeps under `.wrangler/state`. Note that
`pnpm db:generate` needs `.env.d1` present but only filled with placeholders — generation
never talks to Cloudflare. README records the workflow.

`migrations_dir` was tried in `wrangler.jsonc` and removed: wrangler rejects it as an
unexpected top-level field and finds `migrations/` by default anyway.

`created_at` is stored in **milliseconds** (`timestamp_ms`), not seconds. Seconds tied
two Contests created in the same sitting, which made "newest first" no order at all —
the e2e suite now pins the order. `0000` was regenerated from scratch rather than
patching it with a table rebuild: the table has never run anywhere but local `.wrangler`
state, so there is no deployed migration to preserve.

### Hardening worth knowing about

Operator-only pages answer `cache-control: no-store`, set once in
`(operator)/+layout.server.ts` so every later admin route inherits it. SvelteKit sets
only an ETag otherwise, and these pages name every Contest — from ticket 05 every Entry
and vote count too. A page that sets its own headers must not repeat this one, because
SvelteKit allows a given header to be set once.

The signing key is imported once per secret and cached, so a guarded request does one
HMAC rather than an import as well. A deployment with no password configured says so on
the login screen instead of reporting the operator's typing as wrong.

### The homepage link is deliberate

The landing page links to `/admin`. The operator has to get in somehow and ticket 03
does not give them a door; the login screen itself is public by design (ADR 0003), so
the link reveals nothing the phase card above it does not.

### Known limitation

No throttling on the login action. There is one shared password and no user table, so
there is nothing to lock out and nowhere to count attempts without new storage; the
password is long and shared only with the operator. If that stops being acceptable, the
counter belongs in `#lib/server/` behind the login action, not in the route.

### Verification

`npm run check` ✓ (0 errors), `npm run build` ✓, `pnpm lint` — only the six pre-existing
untracked files (`GLOSSARY.md`, `docs/adr/0001`–`0005`) fail prettier, as recorded in 01;
`pnpm test:unit` ✓ (13 tests), `pnpm test:e2e` ✓ (5 tests, run twice, plus the visual
pass below). A two-axis review of the committed diff found the actions-before-guard hole
and the missing `cache-control`, both fixed and pinned by a test each.

`pnpm test:unit` prints "close timed out after 10000ms" after the results. Reproduced
with only the two scaffold specs (`src/lib/vitest-examples/`), so it predates this ticket;
both projects start their own platform proxy and one keeps running.
