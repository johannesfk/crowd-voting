<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		PODIUM_COLOURS,
		PODIUM_LAYOUT,
		placeLabel,
		podiumCardWidth,
		podiumPhotoHeight,
		votesLabel,
		type PodiumFrame
	} from '#lib/contest/podium.js';
	import { renderPodiumImage } from '#lib/podium-image.js';

	/**
	 * The Presentation: the reveal, full screen, on keys alone.
	 *
	 * The one thing this component never does is move by itself. There is no timer, no
	 * interval and no autoplay anywhere in it, because the operator is standing in front
	 * of a room and pacing the result is their job — a reveal that advances itself has
	 * already announced the winner before the operator has said the word.
	 */
	let {
		title,
		contestId,
		frames,
		/** An opaque colour, or `null` for a background that composites over video. */
		background
	}: {
		title: string;
		contestId: string;
		frames: PodiumFrame[];
		background: string | null;
	} = $props();

	/** Which frame is on screen. 0 is before the reveal; 1…`frames.length` are places. */
	let index = $state(0);
	/** Whether the operator has hidden the chrome to announce over a still frame. */
	let held = $state(false);
	let saving = $state(false);
	let fullscreen = $state(false);
	let root: HTMLElement | undefined = $state();

	const frame = $derived(frames[index - 1] ?? null);
	/** The hint is for the operator, so it is gone the moment they start the reveal. */
	const showKeys = $derived(index === 0 && !held);
	const cardWidth = $derived(podiumCardWidth(frame?.onPodium.length ?? 0));
	const photoHeight = $derived(podiumPhotoHeight(cardWidth));

	function step(to: number) {
		// Clamped rather than wrapped: running past the last frame should leave the room
		// looking at the winner, not silently start again on third place.
		index = Math.min(Math.max(to, 0), frames.length);
		// Moving always ends the hold, including a replay back to the title — otherwise
		// an operator who runs the reveal again from a held frame gets the title with
		// neither the result nor the keys telling them what to press.
		held = false;
	}

	async function onkeydown(event: KeyboardEvent) {
		// A key held down is still one keypress. Without this, an operator reaching for
		// the right arrow leans on it and the reveal runs to the end on its own — the
		// exact thing no timer does.
		if (event.repeat) return;

		// With a modifier the key belongs to the browser rather than to the reveal: Cmd+S
		// saves the page and Ctrl+R reloads it, and an operator who asks for one of those
		// should not also get a Podium on top of it.
		if (event.ctrlKey || event.metaKey || event.altKey) return;

		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
			case ' ':
			case 'Enter':
				event.preventDefault();
				step(index + 1);
				return;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				event.preventDefault();
				step(index - 1);
				return;
			case 'Home':
			case 'r':
			case 'R':
				// Back to the start, for a second crowd or a second run at the room.
				step(0);
				return;
			case 'h':
			case 'H':
				held = !held;
				return;
			case 'f':
			case 'F':
				await toggleFullscreen();
				return;
			case 's':
			case 'S':
				await save();
				return;
			case 'Escape':
				// Escape leaves fullscreen by itself, and it has to: that is what the key does
				// everywhere else and the operator will not think otherwise. Only a
				// Presentation that is already not fullscreen is ours to leave — and where
				// it goes is the admin page this Contest came from.
				if (!fullscreen) {
					await goto(resolve('/(operator)/admin/contests/[contestId]', { contestId }));
				}
				return;
		}
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement === null) await root?.requestFullscreen();
			else await document.exitFullscreen();
		} catch {
			// A browser that will not go fullscreen is still a browser the operator can
			// present in, and an error mid-reveal is worse than a smaller window.
		}
	}

	async function save() {
		// One at a time: a second S while the first is still rendering is the same save,
		// and two downloads of the same file help nobody.
		if (saving) return;
		saving = true;

		try {
			const { blob, name } = await renderPodiumImage({
				title,
				headline: frame?.headline ?? null,
				entries: frame?.onPodium ?? [],
				photos: new Map(
					(frame?.onPodium ?? []).map((entry) => [
						entry.entryId,
						`/admin/contests/${contestId}/entries/${entry.entryId}/photo`
					])
				),
				background
			});

			download(blob, name);
		} finally {
			saving = false;
		}
	}

	/** Hands the operator the file, the only way a browser will save one without a dialog. */
	function download(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.hidden = true;
		// Clicked in the document rather than detached: a browser that ignores a click on
		// a link that was never in one gives the operator no file and no reason why.
		document.body.appendChild(link);
		link.click();
		link.remove();

		// Revoked on a later turn rather than straight away: a download the browser has
		// not started reading yet is a download that saves an empty file.
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	$effect(() => {
		const onchange = () => (fullscreen = document.fullscreenElement !== null);
		document.addEventListener('fullscreenchange', onchange);
		return () => document.removeEventListener('fullscreenchange', onchange);
	});
</script>

<svelte:window {onkeydown} />

<!--
	The only element on the page. `container-type: inline-size` makes every `cqw` below
	resolve against the Podium rather than the viewport, which is what lets the live view
	and the exported image share one set of measurements: the Podium is the same shape on
	a phone and on a projector, and the geometry is written once.
-->
<div
	bind:this={root}
	data-presentation
	data-frame={index}
	data-held={held}
	data-saving={saving}
	data-fullscreen={fullscreen}
	data-background={background === null ? 'transparent' : 'colour'}
	class="fixed inset-0 flex flex-col overflow-hidden text-white select-none"
	style:container-type="inline-size"
	style:background={background ?? 'transparent'}
	style:padding={`${PODIUM_LAYOUT.padding}cqw`}
	style:gap={`${PODIUM_LAYOUT.gap}cqw`}
>
	{#if frame === null}
		<!-- Before the reveal: the Contest's own title, and nothing else on screen. -->
		<div class="flex flex-1 items-center justify-center">
			<h1
				data-title
				class="mx-auto max-w-[82cqw] px-[3cqw] py-[2.5cqw] font-bold text-balance"
				style:border-radius={`${PODIUM_LAYOUT.radius}cqw`}
				style:background={PODIUM_COLOURS.panel}
				style:font-size={`${PODIUM_LAYOUT.titleSize * 1.7}cqw`}
			>
				{title}
			</h1>
		</div>
	{:else}
		<div class="flex flex-col items-center" style:gap={`${PODIUM_LAYOUT.gap}cqw`}>
			<p
				data-title
				class="max-w-full truncate px-[2cqw] py-[0.6cqw] font-semibold"
				style:border-radius={`${PODIUM_LAYOUT.radius}cqw`}
				style:background={PODIUM_COLOURS.panel}
				style:font-size={`${PODIUM_LAYOUT.titleSize}cqw`}
			>
				{title}
			</p>

			<h1
				data-headline
				class="max-w-full truncate px-[2cqw] py-[0.7cqw] font-bold"
				style:border-radius={`${PODIUM_LAYOUT.radius}cqw`}
				style:background={PODIUM_COLOURS.panel}
				style:font-size={`${PODIUM_LAYOUT.headlineSize}cqw`}
			>
				{frame.headline}
			</h1>
		</div>

		<!--
			One card per Entry on the Podium, so a tie puts two cards on the final frame and
			a clean win puts one. The width comes from the shared layout rather than a grid,
			because the exported image lays the same row out from the same number.
		-->
		<div class="flex flex-1 items-center justify-center" style:gap={`${PODIUM_LAYOUT.gap}cqw`}>
			{#each frame.onPodium as entry (entry.entryId)}
				<article
					data-podium-card={entry.entryId}
					data-place={entry.place}
					class="flex flex-col overflow-hidden"
					style:border-radius={`${PODIUM_LAYOUT.radius}cqw`}
					style:background={PODIUM_COLOURS.panel}
					style:width={`${cardWidth}cqw`}
				>
					<img
						src="/admin/contests/{contestId}/entries/{entry.entryId}/photo"
						alt="Photo of {entry.names.join(', ')}"
						class="w-full object-cover"
						style:height={`${photoHeight}cqw`}
					/>

					<div class="flex flex-col" style:padding={`${PODIUM_LAYOUT.namesSize * 0.5}cqw`}>
						<div
							class="flex items-baseline justify-between"
							style:gap={`${PODIUM_LAYOUT.gap * 0.5}cqw`}
						>
							<span
								data-place-badge
								class="px-[0.6cqw] font-bold"
								style:border-radius={`${PODIUM_LAYOUT.badgeRadius}cqw`}
								style:background={PODIUM_COLOURS.badge}
								style:font-size={`${PODIUM_LAYOUT.placeSize}cqw`}
							>
								{placeLabel(entry.place)}
							</span>
							<span
								style:color={PODIUM_COLOURS.muted}
								style:font-size={`${PODIUM_LAYOUT.votesSize}cqw`}
							>
								{votesLabel(entry.votes)}
							</span>
						</div>

						<p
							data-costume
							class="truncate font-bold"
							style:font-size={`${PODIUM_LAYOUT.costumeSize}cqw`}
						>
							{entry.costume}
						</p>
						<p
							class="truncate"
							style:color={PODIUM_COLOURS.muted}
							style:font-size={`${PODIUM_LAYOUT.namesSize}cqw`}
						>
							{entry.names.join(', ')}
						</p>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if showKeys}
		<!--
			The keys, on the page, because the operator is at the projector with a keyboard
			and no manual. They go the moment the reveal starts, because the first thing
			that screen is for is the result.
		-->
		<footer
			data-keys
			class="flex flex-wrap items-center justify-center gap-x-[3cqw] gap-y-[0.8cqw] px-[2cqw] py-[1cqw]"
			style:border-radius={`${PODIUM_LAYOUT.radius}cqw`}
			style:background={PODIUM_COLOURS.panel}
			style:font-size={`${PODIUM_LAYOUT.namesSize}cqw`}
		>
			<span><kbd>→</kbd> next place</span>
			<span><kbd>←</kbd> back</span>
			<span><kbd>R</kbd> start again</span>
			<span><kbd>H</kbd> hold this frame</span>
			<span><kbd>F</kbd> full screen</span>
			<span><kbd>S</kbd> save image</span>
			<span><kbd>Esc</kbd> leave</span>
			<span style:color={PODIUM_COLOURS.muted}>Nothing advances on its own.</span>
		</footer>
	{/if}
</div>
