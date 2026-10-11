<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { fieldClass } from '#lib/components/field.js';
	import { acceptsEntries } from '#lib/contest/phases.js';
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

	const open = $derived(acceptsEntries(data.contest.phase));
</script>

<svelte:head>
	<title>{data.contest.title}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
	<header class="flex flex-col gap-2">
		<h1 class="text-2xl font-semibold tracking-tight">{data.contest.title}</h1>
		<p class="text-sm text-muted-foreground">{data.contest.description}</p>
	</header>

	{#if data.ownEntry}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">You are in</h2>
				<Card.Description>
					{data.ownEntry.names.join(', ')} — {data.ownEntry.costume}.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					You have already entered from this device. Entries are final, so nothing here can be
					changed — and there is nothing to do now but wait for the ballot.
				</p>
			</Card.Content>
		</Card.Root>
	{:else if !open}
		<Card.Root>
			<Card.Header>
				<h2 class="text-lg font-semibold">Registration is closed</h2>
				<Card.Description>Keep this link — voting happens here.</Card.Description>
			</Card.Header>
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
				<form class="flex flex-col gap-6" method="POST" enctype="multipart/form-data" use:enhance>
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
							class={fieldClass}>{form?.names?.join('\n') ?? ''}</textarea
						>
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
