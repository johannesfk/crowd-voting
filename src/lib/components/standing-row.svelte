<script lang="ts">
	/**
	 * One row of the standings, as both the room and the operator read it.
	 *
	 * The two pages keep their own reads — the audience is shown no ballot count and no
	 * duplicate signal (see `#lib/server/board.js`) — and their own chrome. Only the row
	 * inside is shared, so the place, the photograph, the costume and the names cannot
	 * be laid out one way for the operator and another way for the room.
	 */
	let {
		place,
		costume,
		names,
		photoSrc,
		votes = null
	}: {
		place: number;
		costume: string;
		names: string[];
		photoSrc: string;
		/** The operator's own count, which the room is never shown. */
		votes?: number | null;
	} = $props();
</script>

<span data-place-label class="w-10 shrink-0 text-lg font-semibold tabular-nums">{place}</span>
<img
	src={photoSrc}
	alt="Photo of {names.join(', ')}"
	class="size-12 shrink-0 rounded-md border object-cover"
/>
<div class="flex flex-1 flex-col gap-0.5">
	<span class="font-medium">{costume}</span>
	<span class="text-sm text-muted-foreground">{names.join(', ')}</span>
</div>
{#if votes !== null}
	<span data-votes class="text-lg font-semibold tabular-nums">{votes}</span>
{/if}
