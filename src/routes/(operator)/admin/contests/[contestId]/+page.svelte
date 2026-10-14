<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import Board from '#lib/components/board.svelte';
	import {
		acceptsEntries,
		acceptsVotes,
		hasBeenScored,
		PHASE_LABELS
	} from '#lib/contest/phases.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The entry list freezes the moment voting opens, and that is the operator's
	// one control over what reaches the ballot.
	const modifiable = $derived(acceptsEntries(data.contest.phase));
	const voting = $derived(acceptsVotes(data.contest.phase));
	// Once voting has been open at all, the Board is worth showing: after it closes
	// the result is final, and the operator is the one who publishes and presents it.
	const scored = $derived(hasBeenScored(data.contest.phase));
</script>

<svelte:head>
	<title>{data.contest.title} — Board</title>
</svelte:head>

<header class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold tracking-tight">{data.contest.title}</h1>
	<p class="text-sm text-muted-foreground">
		{data.entries.length === 0
			? 'No entries yet.'
			: `${data.onBallot} of ${data.entries.length} will be on the ballot.`}
		Share the contest link: <span class="font-mono">/c/{data.contest.id}</span>
	</p>

	{#if form?.nothingToVoteOn}
		<p data-nothing-to-vote class="text-sm text-destructive">
			Nothing is on the ballot: every Entry has been hidden, or none ever arrived. Opening voting
			now would give the room an empty ballot.
		</p>
	{:else if form?.alreadyOpen}
		<p class="text-sm text-destructive">Voting is already open for this Contest.</p>
	{/if}

	{#if modifiable}
		<form method="POST" action="?/openVoting" class="pt-2">
			<Button type="submit">Close registration and open voting</Button>
		</form>
		<p class="text-sm text-muted-foreground">
			Voting takes over the contest link, and the entry list freezes: nothing can be changed once
			the ballot is live.
		</p>
	{:else if voting}
		<p data-voting-open class="text-sm text-muted-foreground">
			Voting is open. The audience is casting ballots at the contest link.
		</p>

		{#if form?.confirmClose}
			<Card.Root data-confirm-close class="border-destructive/40">
				<Card.Header>
					<Card.Title>Close voting?</Card.Title>
					<Card.Description>
						The result is final from the moment you do this, and it cannot be reopened.
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex gap-3">
					<form method="POST" action="?/closeVoting">
						<input type="hidden" name="confirm" value="close" />
						<Button type="submit" variant="destructive">Yes, close voting</Button>
					</form>
					<Button href="/admin/contests/{data.contest.id}" variant="outline">
						Keep voting open
					</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			<form method="POST" action="?/closeVoting" class="pt-2">
				<Button type="submit" variant="outline">Close voting</Button>
			</form>
		{/if}
	{:else}
		<p data-contest-phase class="text-sm text-muted-foreground">
			{PHASE_LABELS[data.contest.phase]}. Nothing here can be changed, and the standings are
			{data.contest.phase === 'results' ? 'not public yet' : 'public at the contest link'}.
		</p>
	{/if}

	{#if form?.votingNotOpen}
		<p class="text-sm text-destructive">Voting is not open, so there is nothing to close.</p>
	{/if}
</header>

{#if scored}
	<Board contestId={data.contest.id} frozen={!voting} />
{/if}

{#if form?.frozen}
	<p class="text-sm text-destructive">
		Voting has opened, so the entry list is frozen: nothing can be hidden or restored now.
	</p>
{/if}

{#if data.entries.length === 0}
	<Card.Root>
		<Card.Header>
			<Card.Title>No entries yet</Card.Title>
			<Card.Description>
				Every registration appears here as it arrives, with its photo and its names.
			</Card.Description>
		</Card.Header>
	</Card.Root>
{:else}
	<ul class="flex flex-col gap-3">
		{#each data.entries as entry (entry.id)}
			<li data-entry-id={entry.id}>
				<Card.Root size="sm">
					<Card.Content class="flex flex-row items-start gap-4">
						<img
							src="/admin/contests/{data.contest.id}/entries/{entry.id}/photo"
							alt="Photo of {entry.names.join(', ')}"
							class="size-24 shrink-0 rounded-md border object-cover"
						/>

						<div class="flex flex-1 flex-col gap-1">
							<span class="font-medium">{entry.costume}</span>
							<span class="text-sm text-muted-foreground">{entry.names.join(', ')}</span>
							<span class="text-sm text-muted-foreground">
								Registered {entry.registeredAt.toLocaleString()}
							</span>

							{#if modifiable}
								<form method="POST" action="?/hide" class="pt-1">
									<input type="hidden" name="entryId" value={entry.id} />
									<input type="hidden" name="hidden" value={entry.hidden ? 'false' : 'true'} />
									<Button
										type="submit"
										size="sm"
										variant={entry.hidden ? 'outline' : 'destructive'}
									>
										{entry.hidden ? 'Put back on the ballot' : 'Hide from the ballot'}
									</Button>
								</form>
							{/if}
						</div>

						{#if entry.hidden}
							<span class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
								Hidden
							</span>
						{/if}
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<p class="text-sm text-muted-foreground">
	Hiding an Entry takes it off the ballot and the standings without touching anybody's vote.
	{#if !modifiable}The list is frozen while voting is open.{/if}
</p>
