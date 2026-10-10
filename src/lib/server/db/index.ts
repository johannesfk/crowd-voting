import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';
import * as schema from './schema';

/**
 * The Contest database, behind a drizzle client. Bindings come from the Worker's
 * own environment rather than `event.platform`, which adapter-cloudflare does not
 * populate on requests in SvelteKit 3. Called per query, so the binding is read
 * when a request runs and not when the module is first evaluated.
 */
export const getDb = () => drizzle(env.DB, { schema });
