# 01: Foundations — bindings, generated types, component library

**What to build:** the app builds and runs locally, so that every later ticket can be verified as it lands. An operator can start the dev server and the build pipeline completes without manual intervention. This is not a user-facing behaviour; it is the ground every vertical slice stands on.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] Database and object-storage bindings are declared in the worker configuration, so the data layer can reach a real database
- [x] Worker type definitions are generated and committed, so the type-checking and build scripts pass rather than failing on a missing file
- [x] The component library is initialised, and a Button and a Card are available for the slices that follow
- [x] `npm run build` and `npm run check` both succeed from a clean checkout, with no steps that must be run by hand first
- [x] The default scaffold route is replaced by something that reflects the Contest vocabulary rather than the framework's welcome heading

## Comments

### Bindings

`wrangler.jsonc` declares `DB` (D1, `crowd-voting`) and `PHOTOS` (R2, `crowd-voting-photos`),
both with `database_id`/`bucket_name` matching the local-dev defaults so `wrangler dev`
creates them under `.wrangler/state` with no extra setup.

### D1 credentials moved out of `.env`

The scaffold's `.env` held the three `CLOUDFLARE_*` values used by `drizzle-kit` to reach
remote D1. Wrangler folds `.env` into the Worker's bindings, so those toolkit secrets were
being written into `worker-configuration.d.ts` — which made the generated types differ
between a clean checkout (no `.env`) and a real one. Renamed to `.env.d1`, loaded explicitly
in `drizzle.config.ts` via `process.loadEnvFile`. `.env.example` documents the rename.

### `wrangler types` removed from `build`/`check`

`wrangler types --check` cannot be green in every state, so it is not in either script:
`wrangler types` emits a `GlobalProps { mainModule }` block introspecting `main`
(`.svelte-kit/cloudflare/_worker.js`) once that file exists. Before the first build it is
absent; after any build it is present. With `--check` that means the _second_ `npm run build`
fails, and with a bare `wrangler types` the file is rewritten after a build and then drags
the entire built worker into `svelte-check` (477 errors, all inside `.svelte-kit/output`).

So the committed `worker-configuration.d.ts` is the pre-build form (no `GlobalProps`), both
scripts run green repeatedly, and `pnpm gen` remains the deliberate regeneration step after
`wrangler.jsonc` changes. `worker-configuration.d.ts` is in `.prettierignore` (generated).

### Component library

`shadcn-svelte` initialised with the vega preset — style `vega`, base colour `neutral`,
lucide icons, Inter variable font — against the scaffold's `#lib` aliases
(`components.json` written; `#lib/utils.ts` added). `button` and `card` were then added
under `src/lib/components/ui/`.

Note the alias shape: the scaffold maps `#lib` → `./src/lib/index.js`, and neither Node's
`imports` field nor TypeScript resolve a directory to its `index.ts`, so component imports
are explicit — `#lib/components/ui/card/index.js`, matching the `#lib/utils.js` the CLI
itself generates. Neither `$lib` nor bare `#lib/components/ui/card` typechecks here.

### Vitest and the local D1 file lock

The `d1_databases` binding made both vitest projects start their own platform proxy, and
two proxies sharing `.wrangler/state` deadlock on the local D1 file (`SQLITE_BUSY`,
"Failed to initialize projects"). Each project alone passes. Under vitest the Cloudflare
adapter is now configured with `platformProxy: { persist: false }`, so the tests use
in-memory bindings; dev and preview still persist.

### Verification (this machine)

`npm run build` ✓, `npm run check` ✓ (0 errors), `pnpm test:unit` ✓ (2 files, 2 tests),
`pnpm test:e2e` ✓ (1 test), run three times each in the order above.

`pnpm lint` is **not** green on this machine, and was not before this ticket either:
`prettier --check .` reports the six pre-existing untracked files (`GLOSSARY.md`,
`docs/adr/0001`–`0005`). Everything under `src/` passes both prettier and eslint, and
`worker-configuration.d.ts` is ignored by both. The vendored registry components are
exempt from `svelte/no-navigation-without-resolve` in `eslint.config.js` — they emit plain
anchors and editing them would fight `shadcn-svelte add|update`.
