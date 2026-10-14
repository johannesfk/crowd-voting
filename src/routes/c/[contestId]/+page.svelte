<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { fieldClass } from '#lib/components/field.js';
	import { MAX_VOTES } from '#lib/contest/ballot.js';
	import { acceptsEntries, acceptsVotes } from '#lib/contest/phases.js';
	import { preparePhoto } from '#lib/photo/prepare-photo.js';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Two inputs, not one: modern Android dropped the camera tile from a plain
	// image picker, so taking a photo is its own explicit action (ADR 0005).
	let camera = $state<HTMLInputElement | undefined>(undefined);
	let library = $state<HTMLInputElement | undefined>(undefined);

	let previewUrl = $state<string | null>(null);
	let chosenName = $state<string | null>(null);
	// The photo is processed before it can be submitted, so the button waits for
	// it rather than uploading whatever the picker happened to hand over.
	let ready = $state(false);

	// Picks, held so a fourth can be stopped in the browser. The server refuses
	// one anyway; this only means the guest is not allowed to try.
	let picks = $state<string[]>([]);

	$effect(() => {
		const url = previewUrl;
		return () => {
			if (url !== null) URL.revokeObjectURL(url);
		};
	});

	async function choose(event: Event) {
		const input = event.currentTarget as HTMLInputElement;

		const file = input.files?.[0];
		// Guarded on the file list being empty: the picker fires `cancel` when the
		// same file is picked a second time, which is not a dismissal.
		if (file === undefined) return;

		// One photo per Entry, so the input that was not used is emptied.
		for (const other of input.form?.querySelectorAll<HTMLInputElement>('input[type="file"]') ??
			[]) {
			if (other !== input) other.value = '';
		}

		const prepared = await preparePhoto(file);
		previewUrl = URL.createObjectURL(prepared);
		chosenName = prepared.name;

		// Hand the shrunk file back to the input, so an ordinary form submit
		// uploads the processed photo with no second code path to get wrong.
		if (typeof DataTransfer === 'function') {
			const transfer = new DataTransfer();
			transfer.items.add(prepared);
			input.files = transfer.files;
		}

		ready = true;
	}

	function retake() {
		for (const input of [camera, library]) if (input !== undefined) input.value = '';
		previewUrl = null;
		chosenName = null;
		ready = false;
	}

	function toggle(id: string, checked: boolean) {
		picks = checked ? [...picks, id] : picks.filter((pick) => pick !== id);
	}

	const open = $derived(acceptsEntries(data.contest.phase));
	const voting = $derived(acceptsVotes(data.contest.phase));

	/**
	 * The Own entry is pinned outside the grid and never enters `picks`: it is
	 * unselectable, so it must not hold a slot a costume they could have chosen
	 * would have taken. It is `undefined` when the operator has hidden it, because a
	 * Hidden Entry is absent from the ballot rather than shown unselectable.
	 */
	const ownEntry = $derived(data.ballotOwnEntry);
	const full = $derived(picks.length >= MAX_VOTES);
</script>

<svelte:head>
	<title>{data.contest.title}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold tracking-tight">{data.contest.title}</h1>
		<p class="text-sm text-muted-foreground">{data.contest.description}</p>
	</header>

	{#if data.hasVoted}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">Your vote is in</h2>
				<Card.Description>Your ballot has been counted.</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					One ballot per device, and yours is spent. There is nothing to change — results appear at
					this link when the operator publishes them.
				</p>
			</Card.Content>
		</Card.Root>
	{:else if voting}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">Pick your favourites</h2>
				{#if data.contest.votingNotice}
					<Card.Description>{data.contest.votingNotice}</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content>
				{#if ownEntry}
					<figure data-own-entry={ownEntry.id} class="flex flex-col gap-2 pb-6">
						<img
							src="/c/{data.contest.id}/entries/{ownEntry.id}/photo"
							alt="Photo of {ownEntry.names.join(', ')}"
							class="max-h-48 w-full rounded-md border object-contain"
						/>
						<figcaption class="flex flex-col gap-1">
							<span class="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
								Yours — you cannot vote for it
							</span>
							<span class="font-medium">{ownEntry.costume}</span>
							<span class="text-sm text-muted-foreground">{ownEntry.names.join(', ')}</span>
						</figcaption>
					</figure>
				{/if}

				{#if data.entries.length === 0}
					<p class="text-sm text-muted-foreground">
						There is nothing to vote on. The operator may still be adding entries.
					</p>
				{:else}
					<form method="POST" action="?/ballot" use:enhance class="flex flex-col gap-6">
						<ul data-ballot-grid class="grid grid-cols-2 gap-3">
							{#each data.entries as candidate (candidate.id)}
								<li data-ballot-entry={candidate.id} data-costume={candidate.costume}>
									<label
										class="flex cursor-pointer flex-col gap-2 rounded-lg p-1 ring-1 ring-foreground/10 has-[:checked]:ring-2 has-[:checked]:ring-primary"
									>
										<img
											src="/c/{data.contest.id}/entries/{candidate.id}/photo"
											alt="Photo of {candidate.names.join(', ')}"
											loading="lazy"
											class="aspect-square w-full rounded-md object-cover"
										/>
										<span class="flex flex-col gap-0.5">
											<span class="text-sm font-medium">{candidate.costume}</span>
											<span class="line-clamp-2 text-xs text-muted-foreground">
												{candidate.names.join(', ')}
											</span>
										</span>
										<input
											type="checkbox"
											name="picks"
											value={candidate.id}
											checked={picks.includes(candidate.id)}
											disabled={full && !picks.includes(candidate.id)}
											onchange={(event) => toggle(candidate.id, event.currentTarget.checked)}
											class="mt-1 size-4 rounded border-input"
											aria-label="Vote for {candidate.costume}"
										/>
									</label>
								</li>
							{/each}
						</ul>

						{#if form?.rejected === 'tooManyPicks'}
							<p class="text-sm text-destructive">
								A ballot holds at most {MAX_VOTES} picks. Take one off and send it again.
							</p>
						{:else if form?.rejected === 'noPicks'}
							<p class="text-sm text-destructive">Pick at least one costume.</p>
						{:else if form?.rejected === 'ownEntry'}
							<p class="text-sm text-destructive">You cannot vote for your own entry.</p>
						{:else if form?.rejected === 'notOnBallot'}
							<p class="text-sm text-destructive">
								One of those is not on the ballot any more. Send the ballot again.
							</p>
						{/if}

						<div class="flex flex-col gap-2">
							<p class="text-sm text-muted-foreground" data-pick-count>
								{picks.length} of {MAX_VOTES} picked
							</p>
							<Button type="submit" disabled={picks.length === 0}>Send my ballot</Button>
							<p class="text-sm text-muted-foreground">
								Every pick counts the same, and sending is final — there is no changing it
								afterwards.
							</p>
						</div>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else if ownEntry && open}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">You are in</h2>
				<Card.Description>
					{ownEntry.names.join(', ')} — {ownEntry.costume}.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					You have already entered from this device. Entries are final, so nothing here can be
					changed — and the ballot appears at this link when the operator opens voting.
				</p>
			</Card.Content>
		</Card.Root>
	{:else if !open}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">
					{#if ownEntry}
						You are in
					{:else if data.contest.phase === 'registration'}
						Registration is closed
					{:else}
						Voting has closed
					{/if}
				</h2>
				<Card.Description>Keep this link — everything else happens here too.</Card.Description>
			</Card.Header>
			{#if ownEntry && data.contest.phase !== 'registration'}
				<Card.Content>
					<p class="text-sm text-muted-foreground">
						{ownEntry.names.join(', ')} — {ownEntry.costume}. Your vote has been counted; the
						results appear here when the operator publishes them.
					</p>
				</Card.Content>
			{/if}
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">Enter the contest</h2>
				{#if data.contest.registrationNotice}
					<Card.Description>{data.contest.registrationNotice}</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content>
				<form
					class="flex flex-col gap-6"
					method="POST"
					action="?/register"
					enctype="multipart/form-data"
					use:enhance
				>
					<div class="flex flex-col gap-2">
						<Label for="participants">Everyone in this costume</Label>
						<textarea
							id="participants"
							name="participants"
							rows="4"
							required
							placeholder="Ada Lovelace
Alan Turing"
							aria-invalid={form?.missingDetails ? true : undefined}
							class={fieldClass}
							defaultValue={form?.names?.join('\n') ?? ''}></textarea>
						<p class="text-sm text-muted-foreground">
							One name per line, or separated by commas. Enter alone or as a group — a group of any
							size is one entry.
						</p>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="costume">What are you dressed up as?</Label>
						<Input
							id="costume"
							name="costume"
							value={form?.costume ?? ''}
							required
							aria-invalid={form?.missingDetails ? true : undefined}
						/>
					</div>

					<div class="flex flex-col gap-2">
						<span class="text-sm font-medium">Photo</span>
						<div class="flex flex-wrap gap-3">
							<Button type="button" variant="outline" onclick={() => camera?.click()}>
								Take a photo
							</Button>
							<Button type="button" variant="outline" onclick={() => library?.click()}>
								Choose from library
							</Button>
						</div>
						<input
							bind:this={camera}
							type="file"
							name="photo"
							accept="image/*"
							capture="environment"
							class="hidden"
							onchange={choose}
						/>
						<input
							bind:this={library}
							type="file"
							name="photo"
							accept="image/*"
							class="hidden"
							onchange={choose}
						/>

						{#if previewUrl !== null}
							<figure class="flex flex-col gap-2">
								<img
									src={previewUrl}
									alt="Preview of your choice"
									data-photo-preview
									class="max-h-64 w-full rounded-md border object-contain"
								/>
								<figcaption class="flex items-center justify-between gap-3">
									<span class="truncate text-sm text-muted-foreground">{chosenName}</span>
									<Button type="button" variant="ghost" size="sm" onclick={retake}>Retake</Button>
								</figcaption>
							</figure>
						{/if}

						<p class="text-sm text-muted-foreground">
							Shrunk on your phone before it is uploaded, so signing up works on venue wifi.
						</p>
					</div>

					{#if form?.missingDetails}
						<p class="text-sm text-destructive">A name and a costume are needed to enter.</p>
					{:else if form?.missingPhoto}
						<p class="text-sm text-destructive">Every entry needs a photo.</p>
					{:else if form?.photoTooLarge}
						<p class="text-sm text-destructive">
							That photo is too large to upload. Choose another, or retake it.
						</p>
					{/if}

					<Button type="submit" disabled={!ready}>Enter the contest</Button>

					<p class="text-sm text-muted-foreground">
						Entering is final. There is no editing, and no taking an entry back.
					</p>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</main>
