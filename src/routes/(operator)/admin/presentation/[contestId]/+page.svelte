<script lang="ts">
	import Presentation from '#lib/components/presentation.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.contest.title} — Podium</title>
</svelte:head>

<!--
	Nothing else on the page. The Presentation covers the viewport itself, so anything
	wrapped around it — a header, a container, a padding — would show at the edges of a
	projector or be captured in the exported image.
-->
<Presentation
	title={data.contest.title}
	contestId={data.contest.id}
	frames={data.frames}
	background={data.contest.background}
/>
