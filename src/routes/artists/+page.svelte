<script lang="ts">
	import { artistRoute, ROUTES } from '$lib/constants/routes';

	let { data } = $props();
</script>

<svelte:head>
	<title>Artists · Art Hawks</title>
	<meta
		name="description"
		content="Meet the artists hanging work in cafés, bars, and rooms across the city."
	/>
</svelte:head>

<section class="directory">
	<p class="directory__eyebrow">City gallery</p>
	<h1 class="directory__title">Artists</h1>
	<p class="directory__lead">
		Makers with work on Art Hawks. Order reshuffles each day so everyone gets a turn near the top.
	</p>
	<p class="directory__links">
		<a href={ROUTES.discover}>Discover</a>
		·
		<a href={ROUTES.whyExhibit}>Why exhibit</a>
	</p>

	<ul class="directory__grid">
		{#each data.artists as artist (artist.id)}
			<li>
				<a class="directory__card" href={artistRoute(artist.username || artist.id)}>
					{#if artist.cover_image_url || artist.image_url}
						<img
							class="directory__media"
							src={artist.cover_image_url || artist.image_url}
							alt=""
							loading="lazy"
						/>
					{:else}
						<div class="directory__media directory__media--empty" aria-hidden="true"></div>
					{/if}
					<div class="directory__copy">
						<strong>{artist.full_name}</strong>
						{#if artist.medium}
							<span>{artist.medium}</span>
						{/if}
						<span class="directory__count">
							{artist.work_count}
							{artist.work_count === 1 ? 'work' : 'works'}
						</span>
					</div>
				</a>
			</li>
		{:else}
			<li class="directory__empty">No public artists yet. Check back soon.</li>
		{/each}
	</ul>
</section>

<style>
	.directory {
		max-width: 56rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}
	.directory__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.directory__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		font-weight: 500;
	}
	.directory__lead {
		margin: 0.75rem 0 0;
		max-width: 36rem;
		line-height: 1.5;
		opacity: 0.85;
	}
	.directory__links {
		margin: 0.85rem 0 0;
		font-size: 0.9rem;
	}
	.directory__links a {
		color: inherit;
	}
	.directory__grid {
		list-style: none;
		padding: 0;
		margin: 2rem 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
		gap: 1rem;
	}
	.directory__card {
		display: grid;
		gap: 0.55rem;
		text-decoration: none;
		color: inherit;
	}
	.directory__media {
		aspect-ratio: 4 / 5;
		width: 100%;
		object-fit: cover;
		background: rgb(30 41 59 / 0.08);
	}
	.directory__media--empty {
		min-height: 8rem;
	}
	.directory__copy {
		display: grid;
		gap: 0.15rem;
	}
	.directory__copy strong {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: 1.05rem;
	}
	.directory__copy span {
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.directory__count {
		opacity: 0.55 !important;
	}
	.directory__empty {
		grid-column: 1 / -1;
		opacity: 0.7;
	}
</style>
