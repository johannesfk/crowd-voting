<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Operator sign-in</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-8">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold tracking-tight">Operator sign-in</h1>
		<p class="text-sm text-muted-foreground">
			The admin area is behind one shared password. The audience never sees this screen.
		</p>
	</header>

	<Card.Root>
		<Card.Content>
			<form class="flex flex-col gap-4" method="POST">
				<div class="flex flex-col gap-2">
					<Label for="password">Shared password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						aria-invalid={form?.invalidPassword || form?.notConfigured ? true : undefined}
					/>
					{#if form?.notConfigured}
						<p class="text-sm text-destructive">
							No operator password is configured for this deployment.
						</p>
					{:else if form?.invalidPassword}
						<p class="text-sm text-destructive">That password did not unlock the operator area.</p>
					{/if}
				</div>
				<Button type="submit">Sign in</Button>
			</form>
		</Card.Content>
	</Card.Root>
</main>
