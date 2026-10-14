import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	// The suite drives a real browser against a real worker, and several tests build
	// a Contest with six guests on six devices before asserting anything. Playwright's
	// 30s default is tight for that when several suites run at once on one machine,
	// and a timeout here reads as a product failure when it is only the harness
	// running out of patience.
	timeout: 60_000
});
