# The operator secret is read from the Worker environment, not from `$app/env/private`

The one shared operator password is a Worker secret — `wrangler secret put` in
production, `.dev.vars` in local development. Code reaches it through the same
Worker environment the D1 and R2 bindings come from (`import { env } from
'cloudflare:workers'`), so both `npm run dev` and the built worker under
`wrangler dev` read the one value from the one place.

Rejected: SvelteKit's `$app/env/private`. In dev it is fed from `.env` files via
`vite.loadEnv`, and only the built worker receives the Worker environment, so the
password would have to be declared twice — in `.env` for the dev server and in
`.dev.vars` for wrangler — for two files that can silently disagree. Rejected:
`event.platform`, which adapter-cloudflare does not populate on requests in
SvelteKit 3, so bindings would be unreachable in the built worker.

## Consequences

One local file (`.dev.vars`) holds every local secret, and the app is locked down
rather than open when it is missing. Secrets are not part of the generated
`Env` types, so they are read by name in `#lib/server/secrets.ts` — a typed
cast in one module, rather than secrets scattered across routes.
