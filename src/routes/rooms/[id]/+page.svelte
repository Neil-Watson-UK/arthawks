<script lang="ts">
	import { artworkRoute, artistRoute, ROUTES } from '$lib/constants/routes';
	import { directionsUrl, visitCueLine } from '$lib/visit-cue';

	let { data } = $props();
	const room = $derived(data.room);

	const summaryParagraphs = $derived(
		(room.bio ?? '')
			.split(/\n\s*\n/)
			.map((paragraph) => paragraph.trim())
			.filter(Boolean)
	);

	const showingCount = $derived(room.works.filter((work) => work.placement === 'showing').length);
	const pastWorks = $derived(room.works.filter((work) => work.placement === 'past'));
	const liveWorks = $derived(
		room.works.filter((work) => work.placement === 'showing' || work.placement === 'transit')
	);

	const visitCue = $derived(
		visitCueLine({ opening_hours: room.opening_hours, showing_count: showingCount })
	);

	const directionsHref = $derived(
		room.lat != null && room.lng != null ? directionsUrl(room.lat, room.lng) : null
	);
</script>

<svelte:head>
	<title>{room.venue_name} · Art Hawks</title>
	<meta
		name="description"
		content={summaryParagraphs[0]?.slice(0, 160) ||
			`${room.venue_name} - a room in the Art Hawks distributed gallery.`}
	/>
</svelte:head>

<article class="room min-h-dvh bg-cream">
	{#if room.image_url}
		<figure class="room__hero">
			<img
				class="room__hero-image"
				src={room.image_url}
				alt={`${room.venue_name} interior`}
				width="1600"
				height="900"
			/>
		</figure>
	{/if}

	<div class="room__inner">
		<header class="room__header">
			<div class="room__rule" aria-hidden="true"></div>
			<p class="room__eyebrow">Room of the city</p>
			<h1 class="room__title">{room.venue_name}</h1>
			<p class="room__location">{room.location}</p>

			{#if summaryParagraphs.length > 0}
				<div class="room__summary">
					{#each summaryParagraphs as paragraph (paragraph)}
						<p>{paragraph}</p>
					{/each}
				</div>
			{/if}

			<div class="room__meta">
				{#if room.instagram || room.website}
					<p class="room__links">
						{#if room.instagram}<span>{room.instagram}</span>{/if}
						{#if room.website}
							<a href={room.website} target="_blank" rel="noopener noreferrer">Website</a>
						{/if}
					</p>
				{/if}

				<p class="room__census">
					{showingCount}
					{showingCount === 1 ? 'work' : 'works'} showing now
					{#if pastWorks.length > 0}
						<span aria-hidden="true"> · </span>
						{pastWorks.length} past on these walls
					{/if}
				</p>

				{#if visitCue}
					<p class="room__visit">{visitCue}</p>
				{/if}

				{#if directionsHref}
					<a
						class="room__directions"
						href={directionsHref}
						target="_blank"
						rel="noopener noreferrer"
					>
						Go there now
					</a>
				{/if}
			</div>
		</header>

		<section class="room__gallery" aria-label="Works in this room">
			<header class="room__gallery-header">
				<p class="room__gallery-eyebrow">On these walls</p>
				<h2 class="room__gallery-title">Open the door</h2>
			</header>

			{#if liveWorks.length === 0}
				<p class="room__empty">Walls waiting - no works placed here yet.</p>
			{:else}
				<div class="room__grid">
					{#each liveWorks as work (work.id)}
						<article class="work">
							<a class="work__frame" href={artworkRoute(work.id)}>
								<img
									class="work__image"
									src={work.image_url}
									alt={work.title}
									loading="lazy"
								/>
							</a>
							<div class="work__body">
								<p class="work__placement work__placement--{work.placement}">
									{work.placement === 'showing' ? 'Now showing' : 'Heading here'}
								</p>
								<h3 class="work__title">
									<a href={artworkRoute(work.id)}>{work.title}</a>
								</h3>
								{#if work.artist_username || work.artist_id}
									<p class="work__artist">
										<a href={artistRoute(work.artist_username || work.artist_id!)}
											>{work.artist_name}</a
										>
									</p>
								{:else}
									<p class="work__artist">{work.artist_name}</p>
								{/if}
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
			{/if}
		</section>

		{#if pastWorks.length > 0}
			<section class="room__gallery room__gallery--past" aria-label="Past exhibits">
				<header class="room__gallery-header">
					<p class="room__gallery-eyebrow">Past on these walls</p>
					<h2 class="room__gallery-title">Still part of the room</h2>
					<p class="room__gallery-lede">
						Works that hung here - marked sold when they’ve found a home. An available past hang
						earns this room a 5% finder’s fee for 30 days after it was hung, unless the work is
						already at another venue.
					</p>
				</header>

				<div class="room__grid">
					{#each pastWorks as work (work.id)}
						<article class="work" class:work--sold={work.status === 'sold'}>
							<a
								class="work__frame"
								href={`${artworkRoute(work.id)}?from=past&venue=${room.venue_id}`}
							>
								<img
									class="work__image"
									src={work.image_url}
									alt={work.title}
									loading="lazy"
								/>
							</a>
							<div class="work__body">
								<p class="work__placement work__placement--past">
									{work.status === 'sold' ? 'Sold · hung here' : 'Once hung here'}
								</p>
								<h3 class="work__title">
									<a href={`${artworkRoute(work.id)}?from=past&venue=${room.venue_id}`}
										>{work.title}</a
									>
								</h3>
								{#if work.artist_username || work.artist_id}
									<p class="work__artist">
										<a href={artistRoute(work.artist_username || work.artist_id!)}
											>{work.artist_name}</a
										>
									</p>
								{:else}
									<p class="work__artist">{work.artist_name}</p>
								{/if}
								{#if work.status === 'sold'}
									<p class="work__sold-note">Found a home through Art Hawks</p>
								{:else}
									<a
										class="work__door"
										href={`${artworkRoute(work.id)}?from=past&venue=${room.venue_id}`}
										>Open the door</a
									>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<nav class="room__nav">
			<a href={ROUTES.map}>Back to map</a>
			<a href={ROUTES.discover}>Discover</a>
		</nav>
	</div>
</article>

<style>
	.room {
		color: var(--color-indigo);
	}

	.room__hero {
		margin: 0;
		width: 100%;
		max-height: min(62vh, 36rem);
		overflow: hidden;
		background: var(--color-indigo);
	}

	.room__hero-image {
		display: block;
		width: 100%;
		height: min(62vh, 36rem);
		object-fit: cover;
		object-position: center;
		animation: room-hero-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.room__inner {
		width: min(100%, 72rem);
		margin: 0 auto;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
	}

	.room__header {
		width: min(100%, 40rem);
		animation: room-copy-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: 80ms;
	}

	.room__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.room__eyebrow,
	.room__gallery-eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.room__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(2.25rem, 6vw, 3.25rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.room__location {
		margin: 0.55rem 0 0;
		font-size: 0.875rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.room__summary {
		display: grid;
		gap: 1rem;
		margin: 1.5rem 0 0;
	}

	.room__summary p {
		margin: 0;
		font-size: 1.0625rem;
		line-height: 1.6;
		color: rgb(30 41 59 / 0.74);
	}

	.room__meta {
		margin-top: 1.5rem;
	}

	.room__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin: 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.room__links a {
		color: var(--color-burnt);
		text-decoration: none;
	}

	.room__census {
		margin: 0.85rem 0 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.room__visit {
		margin: 0.85rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
		font-weight: 500;
		line-height: 1.35;
		color: var(--color-indigo);
	}

	.room__directions {
		display: inline-block;
		margin-top: 1.1rem;
		padding: 0.7rem 1.05rem;
		border-radius: 0.2rem;
		background: var(--color-burnt);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-cream);
		text-decoration: none;
	}

	.room__directions:hover {
		filter: brightness(1.05);
	}

	.room__gallery {
		margin-top: 3.25rem;
	}

	.room__gallery-header {
		margin-bottom: 1.75rem;
	}

	.room__gallery-title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.65rem, 3vw, 2.15rem);
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.room__grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2.5rem 1.5rem;
	}

	.room__empty {
		margin: 0;
		font-size: 0.9375rem;
		color: rgb(30 41 59 / 0.55);
	}

	.work {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.work__frame {
		display: block;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--color-indigo);
		text-decoration: none;
	}

	.work__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.work__frame:hover .work__image {
		transform: scale(1.03);
	}

	.work__body {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding-top: 0.95rem;
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
		color: rgb(30 41 59 / 0.45);
	}

	.work__placement--past {
		color: rgb(30 41 59 / 0.5);
	}

	.room__gallery--past {
		margin-top: 2.75rem;
		padding-top: 2rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.room__gallery-lede {
		margin: 0.65rem 0 0;
		max-width: 36rem;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.58);
	}

	.work--sold .work__image {
		filter: saturate(0.85);
		opacity: 0.92;
	}

	.work__sold-note {
		margin: 0.55rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		color: rgb(30 41 59 / 0.5);
	}

	.work__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.25rem;
		font-weight: 500;
		line-height: 1.2;
	}

	.work__title a {
		color: inherit;
		text-decoration: none;
	}

	.work__artist,
	.work__style {
		margin: 0.3rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.work__artist a {
		color: var(--color-burnt);
		text-decoration: none;
	}

	.work__artist a:hover {
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.work__style {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.work__story {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		overflow: hidden;
		margin: 0.7rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-style: italic;
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.68);
	}

	.work__door {
		display: inline-block;
		margin-top: auto;
		padding-top: 0.85rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.work__door:hover {
		color: var(--color-burnt);
	}

	.room__nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}

	.room__nav a {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.room__nav a:hover {
		color: var(--color-burnt);
	}

	@keyframes room-hero-in {
		from {
			opacity: 0;
			transform: scale(1.04);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes room-copy-in {
		from {
			opacity: 0;
			transform: translateY(0.65rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (min-width: 720px) {
		.room__grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1040px) {
		.room__grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 2.75rem 1.75rem;
		}

		.room__inner {
			padding-inline: 1.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.room__hero-image,
		.room__header,
		.work__image {
			animation: none;
			transition: none;
		}
	}
</style>
