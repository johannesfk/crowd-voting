<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { PHASE_LABELS } from '#lib/contest/phases.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Contests</title>
</svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold tracking-tight">Contests</h1>
	<Button href="/admin/contests/new" size="sm">New Contest</Button>
</div>

{#if data.contests.length === 0}
	<Card.Root>
		<Card.Header>
			<Card.Title>No Contests yet</Card.Title>
			<Card.Description>
				A Contest carries one party from registration through voting to a published Podium.
			</Card.Description>
		</Card.Header>
		<Card.Footer>
			<Button href="/admin/contests/new" variant="outline">Create your first Contest</Button>
		</Card.Footer>
	</Card.Root>
{:else}
	<ul class="flex flex-col gap-3">
		{#each data.contests as contest (contest.id)}
			<li data-contest-id={contest.id}>
				<Card.Root size="sm">
					<Card.Content class="flex flex-col gap-1">
						<div class="flex items-baseline justify-between gap-4">
							<span class="font-medium">{contest.title}</span>
							<span class="text-sm text-muted-foreground">
								{PHASE_LABELS[contest.phase] ?? contest.phase}
							</span>
						</div>
						{#if contest.description}
							<p class="text-sm text-muted-foreground">{contest.description}</p>
						{/if}
						<Button
							href="/admin/contests/{contest.id}"
							size="sm"
							variant="outline"
							class="self-start"
						>
							Entries
						</Button>
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}
