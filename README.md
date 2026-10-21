# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@1.1.1 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright="demo:no" tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:cloudflare+cfTarget:workers" drizzle="database:d1" ai-tools="ide:opencode" experimental="features:async,remoteFunctions" --install pnpm crowd-voting
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Local setup

Two files, both gitignored, both with a committed example next to them:

```sh
cp .dev.vars.example .dev.vars    # the operator password, read from the Worker environment
cp .env.example .env.d1           # D1 credentials, read by drizzle-kit only
```

`.dev.vars` is the local stand-in for `wrangler secret put`: `npm run dev` and
`npm run preview` both read it, and the operator area stays locked without it.

### Database

Three files under `src/lib/server/db/`:

- `schema.ts` — the tables, their foreign keys and their indexes
- `relations.ts` — every relationship between the tables, in one `defineRelations` call
- `index.ts` — the drizzle client, which takes the relations

Reads go through the relational query builder (`db.query.entry.findMany({ with: ... })`),
which asks the database for the whole shape in one statement; writes go through the
query builder (`db.insert`, `db.update`, `db.delete`). The relations are named in
the domain's words, not the columns' — a Contest has Entries and Ballots, an Entry
has Participants, a Ballot has Votes.

### Database migrations

Schema changes go through drizzle-kit, then apply to the local D1 database that
`wrangler dev` keeps under `.wrangler/state`:

```sh
pnpm db:generate                                    # writes migrations/<stamp>_<name>/migration.sql
npx wrangler d1 migrations apply crowd-voting --local
npx wrangler d1 migrations apply crowd-voting       # the remote database
```

Drizzle 1 writes one folder per migration, with the SQL inside it and the
snapshot beside it. Wrangler only finds that layout when it is told to, so
`wrangler.jsonc` sets `migrations_pattern` to `migrations/*/migration.sql` on the
D1 binding. Wrangler records each migration in `d1_migrations` under its path
relative to `migrations_dir`, so the names look like
`20261017015721_omniscient_vermin/migration.sql`.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.
