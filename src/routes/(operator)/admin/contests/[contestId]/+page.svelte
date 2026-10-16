<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Board from '#lib/components/board.svelte';
	import { acceptsEntries, acceptsVotes, canPresent, hasBeenScored } from '#lib/contest/phases.js';
	import { DEFAULT_PODIUM_BACKGROUND } from '#lib/contest/podium.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** One Entry as the operator's list shows it, names and all. */
	type Entry = PageData['entries'][number];

	// The entry list freezes the moment voting opens, and that is the operator's
	// one control over what reaches the ballot.
	const modifiable = $derived(acceptsEntries(data.contest.phase));
	const voting = $derived(acceptsVotes(data.contest.phase));
	// Once voting has been open at all, the Board is worth showing: after it closes
	// the result is final, and the operator is the one who publishes and presents it.
	const scored = $derived(hasBeenScored(data.contest.phase));
	// There is nothing final to reveal until voting has closed, so the Presentation is
	// offered from Results onwards — and it stays available after publication, because
	// a party that wants to replay the reveal should not have to fake a phase.
	const presentable = $derived(canPresent(data.contest.phase));

	// The Podium's background, editable before it is saved. Held here rather than read
	// straight off the Contest so that unchecking "transparent" brings the colour back —
	// an operator setting this up at seven in the evening has to see what they are
	// choosing without saving and reloading first. Seeded once from what was saved:
	// re-seeding on every load would throw away whatever they had just changed.
	let podiumTransparent = $state(untrack(() => data.contest.background === null));
	let colour = $state(untrack(() => data.contest.background ?? DEFAULT_PODIUM_BACKGROUND));

	/**
	 * Whether a refusal came back from this Entry's own correction.
	 *
	 * Every field of the correction form is read back off the refusal rather than off the
	 * Entry, so this is asked in one place rather than spelled out at every field: the box
	 * that was wrong is still the box the operator was typing into.
	 */
	function refused(entryId: string): boolean {
		if (form?.entryId !== entryId) return false;
		return form.incompleteCorrection === true || form.correctionFrozen === true;
	}

	/**
	 * Whether this Entry's correction form is open.
	 *
	 * The URL is what opens it, rather than component state, so the form survives a
	 * reload and works with no JavaScript at all — an operator fixing a typo mid-party
	 * should not have to wait for a bundle to be usable first.
	 */
	function isCorrecting(entryId: string): boolean {
		return page.url.searchParams.get('correct') === entryId || refused(entryId);
	}

	/** Empty name boxes the operator has added to an Entry, by Entry. */
	let addedNames = $state<Record<string, number>>({});

	/** The costume in the box: what was typed and refused back, or what the Entry holds. */
	function correctionCostume(entry: Entry): string {
		return refused(entry.id) && form?.costume ? form.costume : entry.costume;
	}

	function addNameBox(entryId: string) {
		addedNames[entryId] = (addedNames[entryId] ?? 0) + 1;
	}

	/**
	 * One box per Participant the Entry has — what was typed and refused back if there
	 * was a refusal — plus any empty boxes the operator has added.
	 *
	 * Each carries a key so the boxes keep their identity as more are added, rather than
	 * every keystroke in the last box re-rendering the ones above it.
	 */
	function nameBoxes(entry: Entry) {
		const typed = refused(entry.id) && form?.names ? form.names : entry.names;
		const added = addedNames[entry.id] ?? 0;

		return [
			...typed.map((name, index) => ({ key: `existing-${index}`, name })),
			...Array.from({ length: added }, (_, index) => ({
				key: `added-${index}`,
				name: ''
			}))
		];
	}

	// …but re-seeded when the operator moves to another Contest from the list, which is a
	// client-side navigation that never re-runs this component. Without it, Contest A's
	// colour would still be in the box when they opened Contest B.
	let editingContest = $state(untrack(() => data.contest.id));
	$effect(() => {
		if (data.contest.id === editingContest) return;
		editingContest = data.contest.id;
		podiumTransparent = data.contest.background === null;
		colour = data.contest.background ?? DEFAULT_PODIUM_BACKGROUND;
	});
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
	{:else if data.contest.phase === 'results'}
		<p data-contest-phase class="text-sm text-muted-foreground">
			Results. The standings are final and nobody but you can see them yet — anyone on the contest
			link is waiting.
		</p>

		{#if form?.confirmPublish}
			<Card.Root data-confirm-publish class="border-destructive/40">
				<Card.Header>
					<Card.Title>Publish the result?</Card.Title>
					<Card.Description>
						Everyone on the contest link sees the standings the moment you do, and this cannot be
						taken back.
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex gap-3">
					<form method="POST" action="?/publish">
						<input type="hidden" name="confirm" value="publish" />
						<Button type="submit" variant="destructive">Yes, publish it</Button>
					</form>
					<Button href="/admin/contests/{data.contest.id}" variant="outline">Not yet</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			<form method="POST" action="?/publish" class="pt-2">
				<Button type="submit">Publish the result</Button>
			</form>
		{/if}
	{:else}
		<p data-contest-phase class="text-sm text-muted-foreground">
			Published. The standings are public at the contest link, and nothing here can be changed.
		</p>
	{/if}

	{#if form?.nothingToPublish}
		<p class="text-sm text-destructive">
			There is no result to publish: voting has not been closed yet.
		</p>
	{/if}

	{#if form?.votingNotOpen}
		<p class="text-sm text-destructive">Voting is not open, so there is nothing to close.</p>
	{/if}
</header>

{#if scored}
	<Board contestId={data.contest.id} frozen={!voting} />
{/if}

<!--
	The Podium, configured here rather than on the reveal itself: this page is where the
	operator sets a Contest up, and the reveal is a full-screen view with nothing on it but
	the result. Shown before voting has closed too, because choosing the colour at seven in
	the evening beats choosing it while standing in front of a room.
-->
<Card.Root data-podium>
	<Card.Header>
		<Card.Title>Podium</Card.Title>
		<Card.Description>
			{#if presentable}
				Present the result full screen on a projector or through a capture card. Every step of the
				reveal waits for a keypress.
			{:else}
				The reveal opens once voting has closed and the result has stopped moving.
			{/if}
		</Card.Description>
	</Card.Header>

	<Card.Content class="flex flex-col gap-4">
		{#if presentable}
			<Button href="/admin/presentation/{data.contest.id}" data-open-presentation
				>Open the Presentation</Button
			>
		{/if}

		<form method="POST" action="?/background" class="flex flex-col gap-4">
			<div class="flex flex-row items-end gap-4">
				<div class="flex flex-col gap-1.5">
					<Label for="podium-background">Background</Label>
					<Input
						id="podium-background"
						name="background"
						type="color"
						bind:value={colour}
						disabled={podiumTransparent}
						class="h-9 w-20 p-1"
					/>
				</div>

				<label class="flex flex-row items-center gap-2 pb-2 text-sm">
					<input
						name="transparent"
						type="checkbox"
						value="on"
						bind:checked={podiumTransparent}
						class="size-4 rounded border-input"
					/>
					Transparent, to composite over video
				</label>
			</div>

			<p class="text-sm text-muted-foreground">
				A transparent Podium composites over whatever is behind it in OBS. The title and the cards
				keep their own backing, so the names stay readable either way.
			</p>

			<Button type="submit" variant="outline" data-save-background>Save background</Button>
		</form>
	</Card.Content>
</Card.Root>

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
							{#if isCorrecting(entry.id)}
								<!--
									The Correction, in place of the names it is correcting. One box per
									Participant so a name is never split by a comma the operator typed
									inside it, and because a blank box is how somebody comes off the end
									without the operator hunting for a remove button — which also means the
									form works before the bundle has loaded.

									Opened only while the list is modifiable, like every other control here. It
									also stays open on a refusal, which is the one case where the Contest has
									stopped being modifiable: closing the form at that moment would leave the
									operator with no message and nothing they had typed (story 55).
								-->
								<form
									method="POST"
									action="?/correct"
									class="flex flex-col gap-3 pt-1"
									data-correcting
								>
									<input type="hidden" name="entryId" value={entry.id} />

									<div class="flex flex-col gap-1.5">
										<Label for="costume-{entry.id}">What this Entry is dressed up as</Label>
										<Input
											id="costume-{entry.id}"
											name="costume"
											value={correctionCostume(entry)}
										/>
									</div>

									<fieldset class="flex flex-col gap-1.5">
										<legend class="text-sm font-medium">Everyone in this costume</legend>
										{#each nameBoxes(entry) as person, index (person.key)}
											<Label for="person-{index + 1}-{entry.id}">Person {index + 1}</Label>
											<Input id="person-{index + 1}-{entry.id}" name="name" value={person.name} />
										{/each}
									</fieldset>

									<!--
										Both refusals in the correction's own words. An operator who had this form
										open when voting opened was correcting, not hiding, and being told the
										entry list is frozen would leave them hunting for the button they had
										just pressed.
									-->
									{#if form?.incompleteCorrection === true && form.entryId === entry.id}
										<p role="alert" class="text-sm text-destructive" data-correction-refused>
											An Entry needs at least one person and a costume. The photo and whoever
											registered this are left as they are.
										</p>
									{:else if form?.correctionFrozen === true && form.entryId === entry.id}
										<p role="alert" class="text-sm text-destructive" data-correction-refused>
											Voting has opened while this form was open, so the entry list is frozen and a
											correction can no longer be made. Nothing has been changed.
										</p>
									{/if}

									<div class="flex gap-3">
										<Button type="submit" size="sm" data-save-correction>
											Save the correction
										</Button>
										<Button
											href="/admin/contests/{data.contest.id}"
											variant="outline"
											size="sm"
											data-keep-entry
										>
											Keep it as it is
										</Button>
									</div>
								</form>

								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="self-start"
									onclick={() => addNameBox(entry.id)}
									data-add-person
								>
									Add a person
								</Button>
							{:else}
								<span class="font-medium">{entry.costume}</span>
								<span class="text-sm text-muted-foreground">{entry.names.join(', ')}</span>
								<span class="text-sm text-muted-foreground">
									Registered {entry.registeredAt.toLocaleString()}
								</span>

								{#if modifiable}
									<div class="pt-1">
										<Button
											href="/admin/contests/{data.contest.id}?correct={entry.id}"
											variant="outline"
											size="sm"
											data-open-correction
										>
											Correct this Entry
										</Button>
									</div>
								{/if}
							{/if}
							{#if modifiable}
								<!--
										Hiding stays available while a correction is open. They are two decisions
										rather than one, and an operator who has just noticed an Entry is also the
										wrong one to hide should not have to abandon the typo they are halfway
										through fixing in order to do it.
									-->
								<div class="pt-1">
									<form method="POST" action="?/hide">
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
								</div>
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

{#if modifiable}
	<p class="text-sm text-muted-foreground">
		A Correction fixes a misspelled name or a mislabelled costume while Registration is open, and is
		as final as the registration it replaces: the photo and whoever registered the Entry are left
		exactly as they were, and there is nothing to undo it with.
	</p>
{/if}

<!--
	Deletion, offered in every phase: a Contest abandoned halfway through signing up is
	as finished as one that was published, and the operator should not have to run a
	cancelled party through the whole machine to get rid of it.

	At the bottom, under everything about the Contest itself, because it is the one
	thing on this page that is about neither the phase nor the result.
-->
<section class="flex flex-col gap-3 border-t pt-6">
	<h2 class="text-lg font-semibold tracking-tight">Delete this Contest</h2>

	{#if form?.confirmDelete}
		<Card.Root data-confirm-delete class="border-destructive/40">
			<Card.Header>
				<Card.Title>Delete it for good?</Card.Title>
				<Card.Description>
					This removes the Contest, its entries, its ballots and every photograph taken for it.
					There is no undo, and the photographs are the part that cannot be got back.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<form method="POST" action="?/delete" class="flex flex-col gap-3">
					<div class="flex flex-col gap-1.5">
						<Label for="delete-title">Type the title to confirm</Label>
						<Input id="delete-title" name="title" value={form?.typed ?? ''} autocomplete="off" />
					</div>

					{#if form?.titleMismatch}
						<p class="text-sm text-destructive" data-title-mismatch>
							That is not this Contest's title, so nothing has been deleted.
						</p>
					{/if}

					<div class="flex gap-3">
						<Button type="submit" variant="destructive">Yes, delete it</Button>
						<Button href="/admin/contests/{data.contest.id}" variant="outline"
							>Keep this Contest</Button
						>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{:else}
		<form method="POST" action="?/delete">
			<Button type="submit" variant="destructive">Delete this Contest</Button>
		</form>
	{/if}

	<p class="text-sm text-muted-foreground">
		Safe to run twice: if a deletion is interrupted, running it again finishes the job rather than
		leaving photographs behind.
	</p>
</section>
