<script lang="ts">
	import { ROUTES, spaceRoute } from '$lib/constants/routes';

	let { data } = $props();
</script>

<section class="spaces">
	<p class="spaces__eyebrow">Bristol</p>
	<h1 class="spaces__title">Potential Art Hawks spaces</h1>
	<p class="spaces__lead">
		Could this space become part of Bristol’s living gallery? These profiles are prospects from open
		map data - not Art Hawks partners, and they are not currently hosting artwork.
	</p>
	<p class="spaces__links">
		<a href={ROUTES.map}>See them on the map</a>
		·
		<a href={ROUTES.whyHost}>Register a new space</a>
	</p>

	<ul class="spaces__list">
		{#each data.spaces as space (space.id)}
			<li>
				<a class="spaces__card" href={spaceRoute(space.id)}>
					<strong>{space.name}</strong>
					<span>
						{space.category ?? 'Venue'}
						{#if space.locality || space.postcode}
							· {[space.locality, space.postcode].filter(Boolean).join(', ')}
						{/if}
					</span>
					<span class="spaces__cta">Claim this venue →</span>
				</a>
			</li>
		{:else}
			<li class="spaces__empty">No public prospects yet. Check back after curation.</li>
		{/each}
	</ul>
</section>

<style>
	.spaces {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}
	.spaces__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.spaces__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		font-weight: 500;
	}
	.spaces__lead {
		line-height: 1.5;
		opacity: 0.85;
	}
	.spaces__links {
		font-size: 0.9rem;
	}
	.spaces__list {
		list-style: none;
		padding: 0;
		margin: 2rem 0 0;
		display: grid;
		gap: 0.65rem;
	}
	.spaces__card {
		display: grid;
		gap: 0.2rem;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: inherit;
		border-bottom: 1px solid rgb(30 41 59 / 0.1);
	}
	.spaces__cta {
		font-size: 0.85rem;
		font-weight: 600;
		margin-top: 0.25rem;
		opacity: 0.75;
	}
	.spaces__empty {
		opacity: 0.6;
	}
</style>
