<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// Shared by the three free-text fields so the styling lives in one place.
	const textareaClass =
		'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-16 w-full rounded-md border bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] focus-visible:ring-3 focus-visible:outline-none md:text-sm';
</script>

<svelte:head>
	<title>New Contest</title>
</svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">New Contest</h1>

<Card.Root>
	<Card.Header>
		<Card.Title>The Contest itself</Card.Title>
		<Card.Description>
			A Contest starts in Registration: the audience can sign up, and nobody can vote yet.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<form class="flex flex-col gap-6" method="POST">
			<div class="flex flex-col gap-2">
				<Label for="title">Title</Label>
				<Input
					id="title"
					name="title"
					value={form?.title ?? ''}
					required
					aria-invalid={form?.invalidContest ? true : undefined}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="description">Description</Label>
				<textarea
					id="description"
					name="description"
					rows="3"
					required
					aria-invalid={form?.invalidContest ? true : undefined}
					class={textareaClass}>{form?.description ?? ''}</textarea
				>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="registrationNotice">Note for people signing up</Label>
				<textarea id="registrationNotice" name="registrationNotice" rows="2" class={textareaClass}
					>{form?.registrationNotice ?? ''}</textarea
				>
				<p class="text-sm text-muted-foreground">
					Optional. Shown on the registration form — say whether people may enter alone or as a
					group.
				</p>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="votingNotice">Note for people voting</Label>
				<textarea id="votingNotice" name="votingNotice" rows="2" class={textareaClass}
					>{form?.votingNotice ?? ''}</textarea
				>
				<p class="text-sm text-muted-foreground">
					Optional. Shown on the ballot — say how many costumes people may choose.
				</p>
			</div>

			{#if form?.invalidContest}
				<p class="text-sm text-destructive">A Contest needs a title and a description.</p>
			{/if}

			<div class="flex gap-3">
				<Button type="submit">Create Contest</Button>
				<Button href="/admin" variant="ghost">Cancel</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
