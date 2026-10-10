<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	// The phase machine is the backbone of the domain: Registration → Voting →
	// Results → Published, in that order and never backwards. The ballot, the
	// waiting page and the standings all key off whichever of these is current.
	const phases = [
		{
			name: 'Registration',
			detail:
				'The audience registers Entries — one costume each, alone or as a group. Nobody can vote yet.'
		},
		{
			name: 'Voting',
			detail:
				'Registration is closed and the ballot is live: up to three unranked picks, one Ballot per device.'
		},
		{
			name: 'Results',
			detail: 'Voting is closed and the standings are final, but still private to the operator.'
		},
		{
			name: 'Published',
			detail: "The operator makes the standings public at the contest's link."
		}
	];
</script>

<main class="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 p-8">
	<header class="flex flex-col gap-3">
		<h1 class="text-3xl font-semibold tracking-tight">Costume contest platform</h1>
		<p class="text-muted-foreground">
			One link carries a Contest from registration through voting to a published Podium.
		</p>
	</header>

	<Card.Root>
		<Card.Header>
			<Card.Title>How a Contest runs</Card.Title>
			<Card.Description>Four phases, in this order, and never backwards.</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="flex flex-col gap-3">
				{#each phases as phase (phase.name)}
					<li class="flex flex-col gap-1">
						<span class="font-medium">{phase.name}</span>
						<span class="text-sm text-muted-foreground">{phase.detail}</span>
					</li>
				{/each}
			</ol>
		</Card.Content>
		<Card.Footer>
			<p class="text-sm text-muted-foreground">
				Running a Contest?
				<Button href="/admin" variant="link" class="h-auto p-0 align-baseline">
					Sign in to the operator area
				</Button>.
			</p>
		</Card.Footer>
	</Card.Root>
</main>
