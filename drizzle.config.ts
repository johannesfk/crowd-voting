import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// D1 credentials live in .env.d1, never .env: wrangler folds .env into the
// Worker's bindings, which would leak toolkit secrets into worker-configuration.d.ts
// and make the generated types differ between a clean checkout and a real one.
// Copy .env.example to .env.d1 and fill it in before running any db:* command.
if (existsSync('.env.d1')) process.loadEnvFile('.env.d1');

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
	throw new Error('CLOUDFLARE_ACCOUNT_ID is not set. Copy .env.example to .env.d1 and fill it in.');
}
if (!process.env.CLOUDFLARE_DATABASE_ID) {
	throw new Error(
		'CLOUDFLARE_DATABASE_ID is not set. Copy .env.example to .env.d1 and fill it in.'
	);
}
if (!process.env.CLOUDFLARE_D1_TOKEN) {
	throw new Error('CLOUDFLARE_D1_TOKEN is not set. Copy .env.example to .env.d1 and fill it in.');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './migrations',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID,
		token: process.env.CLOUDFLARE_D1_TOKEN
	},
	verbose: true,
	strict: true
});
