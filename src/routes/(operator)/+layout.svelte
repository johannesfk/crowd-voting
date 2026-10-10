<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';

	let { children } = $props();
</script>

<div class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
	<header class="flex items-center justify-between gap-4 border-b border-border pb-4">
		<span class="text-sm font-medium tracking-wide text-muted-foreground uppercase">Operator</span>
		<form method="POST" action="/admin/logout">
			<Button type="submit" variant="outline" size="sm">Sign out</Button>
		</form>
	</header>

	<main class="flex flex-1 flex-col gap-6">
		{@render children()}
	</main>
</div>
