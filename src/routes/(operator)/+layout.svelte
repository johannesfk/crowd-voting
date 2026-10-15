<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';

	let { children } = $props();

	/**
	 * Whether this page gets the operator's admin chrome.
	 *
	 * One route in this group does not: the Presentation. It is the operator's own page —
	 * same guard, same session, same Contest — but it is a full-screen reveal for a
	 * projector, and a header, a sign-out button and a max-width column around it are
	 * exactly what must not be on that screen, or captured in the exported image.
	 *
	 * Asked of the route rather than passed down as a flag, because a flag every admin
	 * page has to remember to set is a flag one of them will forget.
	 */
	const chrome = $derived(page.route.id !== '/(operator)/admin/presentation/[contestId]');
</script>

{#if chrome}
	<div class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
		<header class="flex items-center justify-between gap-4 border-b border-border pb-4">
			<span class="text-sm font-medium tracking-wide text-muted-foreground uppercase">Operator</span
			>
			<form method="POST" action="/admin/logout">
				<Button type="submit" variant="outline" size="sm">Sign out</Button>
			</form>
		</header>

		<main class="flex flex-1 flex-col gap-6">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}
