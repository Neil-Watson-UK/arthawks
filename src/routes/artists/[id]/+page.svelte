<script lang="ts">
	import { artworkRoute, roomRoute, ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	const artist = $derived(data.artist);

	const summaryParagraphs = $derived(
		(artist.bio ?? '')
			.split(/\n\s*\n/)
			.map((paragraph) => paragraph.trim())
			.filter(Boolean)
	);

	const onWalls = $derived(artist.works.filter((work) => work.placement === 'showing'));
	const heading = $derived(artist.works.filter((work) => work.placement === 'transit'));
	const studio = $derived(artist.works.filter((work) => work.placement === 'studio'));
	const sold = $derived(artist.works.filter((work) => work.placement === 'sold'));
	const soldCount = $derived(sold.length);
</script>

<svelte:head>
	<title>{artist.full_name} · Art Hawks</title>
	<meta
		name="description"
		content={summaryParagraphs[0]?.slice(0, 160) ||
			`${artist.full_name} - original work living in rooms across the city.`}
	/>
</svelte:head>

<article class="artist min-h-dvh bg-cream">
	{#if artist.image_url}
		<figure class="artist__hero">
			<img
				class="artist__hero-image"
				src={artist.image_url}
				alt=""
				width="1600"
				height="900"
			/>
		</figure>
	{/if}

	<div class="artist__inner">
		<header class="artist__header">
			<div class="artist__rule" aria-hidden="true"></div>
			<p class="artist__eyebrow">Artist in the city</p>
			<h1 class="artist__title">{artist.full_name}</h1>
			{#if artist.location || artist.medium}
				<p class="artist__place">
					{#if artist.medium}<span>{artist.medium}</span>{/if}
					{#if artist.medium && artist.location}<span aria-hidden="true"> · </span>{/if}
					{#if artist.location}<span>{artist.location}</span>{/if}
				</p>
			{/if}

			{#if summaryParagraphs.length > 0}
				<div class="artist__summary">
					{#each summaryParagraphs as paragraph (paragraph)}
						<p>{paragraph}</p>
					{/each}
				</div>
			{/if}

			<div class="artist__meta">
				{#if artist.instagram || artist.website}
					<p class="artist__links">
						{#if artist.instagram}<span>{artist.instagram}</span>{/if}
						{#if artist.website}
							<a href={artist.website} target="_blank" rel="noopener noreferrer">Website</a>
						{/if}
					</p>
				{/if}

				<p class="artist__census">
					{artist.on_walls_count}
					{artist.on_walls_count === 1 ? 'work' : 'works'} on walls now
					<span aria-hidden="true"> · </span>
					{artist.works.length}
					{artist.works.length === 1 ? 'piece' : 'pieces'} in the catalogue
					{#if soldCount > 0}
						<span aria-hidden="true"> · </span>
						{soldCount} sold through Art Hawks
					{/if}
				</p>
			</div>
		</header>

		{#each [{ key: 'walls', label: 'On walls nearby', title: 'Find them in the room', works: onWalls }, { key: 'transit', label: 'Heading out', title: 'Soon on a wall', works: heading }, { key: 'studio', label: 'In the studio', title: 'Open the door', works: studio }, { key: 'sold', label: 'Found a home', title: 'Sold through Art Hawks', works: sold }] as lane (lane.key)}
			{#if lane.works.length > 0}
				<section class="artist__gallery" aria-label={lane.label}>
					<header class="artist__gallery-header">
						<p class="artist__gallery-eyebrow">{lane.label}</p>
						<h2 class="artist__gallery-title">{lane.title}</h2>
					</header>

					<div class="artist__grid">
						{#each lane.works as work (work.id)}
							<article class="work" class:work--sold={work.placement === 'sold'}>
								<a class="work__frame" href={artworkRoute(work.id)}>
									<img
										class="work__image"
										src={work.image_url}
										alt={work.title}
										loading="lazy"
									/>
								</a>
								<div class="work__body">
									{#if work.placement === 'showing' && work.venue_id && work.venue_name}
										<p class="work__placement work__placement--showing">
											Now showing at
											<a href={roomRoute(work.venue_id)}>{work.venue_name}</a>
										</p>
									{:else if work.placement === 'transit' && work.venue_id && work.venue_name}
										<p class="work__placement work__placement--transit">
											Heading toward
											<a href={roomRoute(work.venue_id)}>{work.venue_name}</a>
										</p>
									{:else if work.placement === 'sold'}
										<p class="work__placement work__placement--sold">Sold</p>
									{:else}
										<p class="work__placement work__placement--studio">In the studio</p>
									{/if}
									<h3 class="work__title">
										<a href={artworkRoute(work.id)}>{work.title}</a>
									</h3>
									{#if work.style}
										<p class="work__style">{work.style}</p>
									{/if}
									{#if work.description}
										<p class="work__story">{work.description}</p>
									{/if}
									<a class="work__door" href={artworkRoute(work.id)}>Open the door</a>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/if}
		{/each}

		{#if artist.works.length === 0}
			<p class="artist__empty">Catalogue quiet for now - the next hang is coming.</p>
		{/if}

		<nav class="artist__nav">
			<a href={ROUTES.discover}>Discover</a>
			<a href={ROUTES.map}>Map</a>
		</nav>
	</div>
</article>

<style>
	.artist {
		color: var(--color-indigo);
	}

	.artist__hero {
		margin: 0;
		width: 100%;
		max-height: min(48vh, 28rem);
		overflow: hidden;
		background: var(--color-indigo);
	}

	.artist__hero-image {
		display: block;
		width: 100%;
		height: min(48vh, 28rem);
		object-fit: cover;
		object-position: center;
		animation: artist-hero-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.artist__inner {
		width: min(100%, 72rem);
		margin: 0 auto;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
	}

	.artist__header {
		width: min(100%, 40rem);
		animation: artist-copy-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: 80ms;
	}

	.artist__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.artist__eyebrow,
	.artist__gallery-eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.artist__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(2.2rem, 7vw, 3.4rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.artist__place {
		margin: 0.65rem 0 0;
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
	}

	.artist__summary {
		margin: 1.25rem 0 0;
		display: grid;
		gap: 0.85rem;
		max-width: 42ch;
		font-size: 1.05rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.78);
	}

	.artist__summary p {
		margin: 0;
	}

	.artist__meta {
		margin-top: 1.35rem;
		display: grid;
		gap: 0.55rem;
	}

	.artist__links {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
		font-size: 0.8rem;
		color: rgb(30 41 59 / 0.55);
	}

	.artist__links a,
	.artist__nav a,
	.work__door,
	.work__placement a,
	.work__title a {
		color: var(--color-burnt);
		text-decoration: none;
	}

	.artist__census {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.artist__gallery {
		margin-top: 3.25rem;
	}

	.artist__gallery-title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.6rem, 4vw, 2.1rem);
		font-weight: 500;
	}

	.artist__empty {
		margin: 2.5rem 0 0;
		color: rgb(30 41 59 / 0.55);
	}

	.artist__grid {
		margin-top: 1.75rem;
		display: grid;
		gap: 2.5rem 1.5rem;
	}

	.work__frame {
		display: block;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--color-indigo);
	}

	.work__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.work__frame:hover .work__image {
		transform: scale(1.03);
	}

	.work__body {
		margin-top: 0.85rem;
		max-width: 34ch;
	}

	.work__placement {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.work__placement--showing {
		color: var(--color-burnt);
	}

	.work__placement--transit {
		color: rgb(30 41 59 / 0.55);
	}

	.work__placement--studio {
		color: rgb(30 41 59 / 0.4);
	}

	.work__placement--sold {
		color: var(--color-burnt);
	}

	.work--sold .work__image {
		filter: saturate(0.85);
		opacity: 0.92;
	}

	.work__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.35rem;
		font-weight: 500;
		line-height: 1.2;
	}

	.work__style {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.work__story {
		margin: 0.55rem 0 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.7);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.work__door {
		display: inline-block;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.artist__nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		margin-top: 3rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	@keyframes artist-hero-in {
		from {
			opacity: 0;
			transform: scale(1.04);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes artist-copy-in {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (min-width: 820px) {
		.artist__grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.artist__inner {
			padding-inline: 2rem;
		}

		.artist__grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.artist__hero-image,
		.artist__header,
		.work__image {
			animation: none;
			transition: none;
		}
	}
</style>
