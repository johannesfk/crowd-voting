// The Worker's own environment: bindings and secrets. Production takes these from
// `wrangler secret put`, local development from `.dev.vars` (see `.dev.vars.example`)
// — and both `vite dev` and the built worker read the same values, which is why the
// operator password is taken from here rather than from `$app/env/private`, whose
// values come from `.env` files in dev and would need the password declared twice.

import { env } from 'cloudflare:workers';

/** Secrets are not part of the generated `Env` types, so they are read by name. */
interface WorkerSecrets {
	OPERATOR_PASSWORD?: string;
}

const secrets = env as unknown as WorkerSecrets;

/**
 * The one shared operator password (ADR 0003), or `undefined` when no secret is
 * configured — which leaves the operator area locked rather than open.
 */
export function operatorPassword(): string | undefined {
	return secrets.OPERATOR_PASSWORD;
}
