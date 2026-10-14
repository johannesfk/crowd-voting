<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { getBoard, getFrozenBoard } from '#lib/board.remote.js';

	/**
	 * Whether the Board is still moving. Voting open means live; voting closed means
	 * frozen — and the operator still needs to see the result then, because they are
	 * the one who publishes and presents it. Only the connection stops.
	 */
	let { contestId, frozen = false }: { contestId: string; frozen?: boolean } = $props();

	// Awaited once, at the top level, and then kept up to date by the query's own
	// connection for as long as this component is on screen. Rendering this component
	// is what opens the connection and unmounting it is what closes it.
	const board = $derived(await (frozen ? getFrozenBoard(contestId) : getBoard(contestId)));
</script>

<section data-board class="flex flex-col gap-3">
	<h2 class="text-lg font-semibold">Board</h2>
	<p class="text-sm text-muted-foreground">
		<span data-ballot-total
			>{board.ballots === 1 ? '1 ballot cast.' : `${board.ballots} ballots cast.`}</span
		>
		{#if frozen}
			Voting is closed, so these are final.
		{:else}
			Live — this updates as ballots arrive.
		{/if}
	</p>

	{#if board.standings.length === 0}
		<p class="text-sm text-muted-foreground">There is nothing on the ballot to score.</p>
	{:else}
		<ol class="flex flex-col gap-2">
			{#each board.standings as standing (standing.entryId)}
				<li data-standing={standing.entryId} data-place={standing.place}>
					<Card.Root size="sm">
						<Card.Content class="flex flex-row items-center gap-4">
							<span data-place-label class="w-10 shrink-0 text-lg font-semibold tabular-nums">
								{standing.place}
							</span>
							<img
								src="/admin/contests/{contestId}/entries/{standing.entryId}/photo"
								alt="Photo of {standing.names.join(', ')}"
								class="size-12 shrink-0 rounded-md border object-cover"
							/>
							<div class="flex flex-1 flex-col gap-0.5">
								<span class="font-medium">{standing.costume}</span>
								<span class="text-sm text-muted-foreground">{standing.names.join(', ')}</span>
							</div>
							<span data-votes class="text-lg font-semibold tabular-nums">{standing.votes}</span>
						</Card.Content>
					</Card.Root>
				</li>
			{/each}
		</ol>
	{/if}

	{#if board.duplicates.length > 0}
		<div data-duplicates class="flex flex-col gap-2">
			<h3 class="text-sm font-medium">Possible duplicate ballots</h3>
			{#each board.duplicates as group, index (index)}
				<p class="text-sm text-muted-foreground">
					{group.devices.length} devices look like they came from one browser on one network, and they
					agreed on {group.sharedEntries.length} Entries. Nothing has been refused because of this.
				</p>
			{/each}
			<p class="text-xs text-muted-foreground">
				A hint, not a finding. Guests at one party share a network address, so a full room looks
				exactly like this — use it to spot something odd, never to turn anyone away.
			</p>
		</div>
	{/if}
</section>
