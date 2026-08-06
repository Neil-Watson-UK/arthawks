<script lang="ts">
	import { formatArtStyle } from '$lib/constants/art-styles';
	import { artworkRoute, artistRoute, roomRoute, ROUTES } from '$lib/constants/routes';
	import { directionsUrl, visitCueLine } from '$lib/visit-cue';
	import { formatPrice } from '$lib/utils/format';

	let { data } = $props();

	const styleLabels = $derived(data.styles.map((style) => formatArtStyle(style)));
</script>

<main class="find">
	<header class="find__hero">
		<p class="find__kicker">Your taste</p>
		<h1 class="find__title">
			{#if styleLabels.length}
				Drawn to {styleLabels.join(' · ')}
			{:else}
				Tell us what you’re drawn to
			{/if}
		</h1>
		{#if data.prompt}
			<p class="find__prompt">“{data.prompt}”</p>
		{/if}
		<p class="find__lede">
			Rooms where that work lives, artists who make it, and pieces you can go and see.
		</p>
		{#if styleLabels.length}
			<ul class="find__chips" aria-label="Selected styles">
				{#each styleLabels as label}
					<li>{label}</li>
				{/each}
			</ul>
		{/if}
		<nav class="find__alt" aria-label="Other ways in">
			<a class="find__alt-link find__alt-link--primary" href={ROUTES.home}
				>{styleLabels.length ? 'Refine your search' : 'Start your art search'}</a
			>
			<a class="find__alt-link" href={ROUTES.discover}>Browse Discover</a>
			<a class="find__alt-link" href={ROUTES.discoverSwipe}>Taste Match</a>
			<a class="find__alt-link" href={ROUTES.map}>Open the map</a>
		</nav>
	</header>

	{#if data.error}
		<p class="find__error" role="alert">{data.error}</p>
	{/if}

	{#if !styleLabels.length}
		<section class="find__empty">
			<p>
				You haven’t told us what you’re looking for yet. Start with a few styles or a short
				description - we’ll shortlist rooms and artists from there.
			</p>
			<div class="find__empty-actions">
				<a class="find__cta" href={ROUTES.home}>Start your art search</a>
				<a class="find__cta find__cta--ghost" href={ROUTES.discover}>Browse Discover</a>
			</div>
		</section>
	{:else if data.empty}
		<section class="find__empty">
			<p>
				Nothing matching {styleLabels.join(' / ')} is live on walls yet. Browse Discover while the
				city fills in - or check the map for open rooms.
			</p>
			<div class="find__empty-actions">
				<a class="find__cta" href={ROUTES.discover}>Discover</a>
				<a class="find__cta find__cta--ghost" href={ROUTES.map}>Map</a>
			</div>
		</section>
	{:else}
		{#if data.rooms.length}
			<section class="find__section" aria-labelledby="find-rooms">
				<header class="find__section-head">
					<p class="find__section-kicker">Rooms</p>
					<h2 id="find-rooms" class="find__section-title">Where to go</h2>
					<p class="find__section-copy">Venues with matching work on the walls - or rooms tuned to this mood.</p>
				</header>
				<ul class="find__rooms">
					{#each data.rooms as room (room.venue_id)}
						<li class="find__room">
							<a class="find__room-link" href={roomRoute(room.venue_id)}>
								{#if room.image_url || room.sample_works[0]?.image_url}
									<img
										src={room.image_url || room.sample_works[0].image_url}
										alt=""
										class="find__room-media"
									/>
								{:else}
									<div class="find__room-media find__room-media--empty" aria-hidden="true"></div>
								{/if}
								<div class="find__room-copy">
									<h3 class="find__room-name">{room.venue_name}</h3>
									{#if room.location}
										<p class="find__meta">{room.location}</p>
									{/if}
									{#if room.matching_styles.length}
										<p class="find__tags">{room.matching_styles.join(' · ')}</p>
									{/if}
									{#if room.showing_count > 0}
										<p class="find__meta">
											{room.showing_count}
											{room.showing_count === 1 ? 'work showing' : 'works showing'}
										</p>
									{/if}
									{#if visitCueLine(room)}
										<p class="find__cue">{visitCueLine(room)}</p>
									{/if}
								</div>
							</a>
							{#if room.lat != null && room.lng != null}
								<a
									class="find__directions"
									href={directionsUrl(room.lat, room.lng)}
									target="_blank"
									rel="noopener noreferrer"
								>
									Directions
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.artists.length}
			<section class="find__section" aria-labelledby="find-artists">
				<header class="find__section-head">
					<p class="find__section-kicker">Artists</p>
					<h2 id="find-artists" class="find__section-title">Who makes this</h2>
					<p class="find__section-copy">Makers whose catalogue matches what you described.</p>
				</header>
				<ul class="find__artists">
					{#each data.artists as artist (artist.id)}
						<li>
							<a class="find__artist" href={artistRoute(artist.username || artist.id)}>
								{#if artist.sample_works[0]?.image_url}
									<img src={artist.sample_works[0].image_url} alt="" class="find__artist-media" />
								{:else}
									<div class="find__artist-media find__artist-media--empty" aria-hidden="true"></div>
								{/if}
								<div>
									<h3 class="find__artist-name">{artist.full_name}</h3>
									{#if artist.matching_styles.length}
										<p class="find__tags">{artist.matching_styles.join(' · ')}</p>
									{/if}
									<p class="find__meta">
										{artist.work_count}
										{artist.work_count === 1 ? 'matching work' : 'matching works'}
										{#if artist.medium}
											· {artist.medium}
										{/if}
									</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.works.length}
			<section class="find__section" aria-labelledby="find-works">
				<header class="find__section-head">
					<p class="find__section-kicker">Works</p>
					<h2 id="find-works" class="find__section-title">Pieces to notice</h2>
					<p class="find__section-copy">Open a door - on a wall now, in transit, or still in studio.</p>
				</header>
				<ul class="find__works">
					{#each data.works as work (work.id)}
						<li>
							<a class="find__work" href={artworkRoute(work.id)}>
								{#if work.image_url}
									<img src={work.image_url} alt="" class="find__work-media" />
								{:else}
									<div class="find__work-media find__work-media--empty" aria-hidden="true"></div>
								{/if}
								<div class="find__work-copy">
									<p class="find__work-place">
										{#if work.placement === 'showing' && work.venue_name}
											Showing at {work.venue_name}
										{:else if work.placement === 'transit' && work.venue_name}
											Heading to {work.venue_name}
										{:else}
											In studio · available
										{/if}
									</p>
									<h3 class="find__work-title">{work.title}</h3>
									<p class="find__meta">
										{work.artist_name}
										{#if work.style_label}
											· {work.style_label}
										{/if}
										· {formatPrice(work.price_pence)}
									</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</main>

<style>
	.find {
		width: min(100% - 2rem, 68rem);
		margin: 0 auto;
		padding: 2.5rem 0 4rem;
		color: var(--color-ink);
	}

	.find__hero {
		max-width: 38rem;
	}

	.find__kicker,
	.find__section-kicker {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-ember);
	}

	.find__title,
	.find__section-title,
	.find__room-name,
	.find__artist-name,
	.find__work-title {
		font-family: var(--font-display);
		font-weight: 500;
	}

	.find__title {
		margin: 0.4rem 0 0;
		font-size: clamp(2rem, 5vw, 2.8rem);
		line-height: 1.1;
	}

	.find__prompt {
		margin: 0.85rem 0 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-style: italic;
		opacity: 0.8;
	}

	.find__lede,
	.find__section-copy,
	.find__meta {
		margin: 0.75rem 0 0;
		font-size: 0.95rem;
		line-height: 1.55;
		opacity: 0.72;
	}

	.find__alt {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.15rem 0 0;
	}

	.find__alt-link {
		display: inline-flex;
		align-items: center;
		padding: 0.55rem 0.85rem;
		border: 1px solid rgb(14 24 31 / 0.18);
		border-radius: 0.3rem;
		background: rgb(243 240 232 / 0.65);
		color: inherit;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.find__alt-link:hover,
	.find__alt-link:focus-visible {
		border-color: rgb(14 24 31 / 0.35);
		background: rgb(243 240 232 / 0.95);
	}

	.find__alt-link--primary {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-chalk);
	}

	.find__alt-link--primary:hover,
	.find__alt-link--primary:focus-visible {
		background: rgb(14 24 31 / 0.88);
		border-color: rgb(14 24 31 / 0.88);
		color: var(--color-chalk);
	}

	.find__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
	}

	.find__chips li {
		padding: 0.3rem 0.65rem;
		border: 1px solid rgb(14 24 31 / 0.14);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.find__directions {
		color: inherit;
		font-weight: 600;
	}

	.find__empty p {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.55;
		opacity: 0.8;
	}

	.find__error {
		margin-top: 1.5rem;
		color: #9a3412;
		font-weight: 600;
	}

	.find__empty {
		margin-top: 2.5rem;
		max-width: 32rem;
	}

	.find__empty-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	.find__cta {
		display: inline-block;
		padding: 0.65rem 1rem;
		border-radius: 0.3rem;
		background: var(--color-ink);
		color: var(--color-chalk);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.find__cta--ghost {
		background: transparent;
		color: var(--color-ink);
		border: 1px solid rgb(14 24 31 / 0.2);
	}

	.find__section {
		margin-top: 3rem;
	}

	.find__section-title {
		margin: 0.35rem 0 0;
		font-size: clamp(1.5rem, 3vw, 1.9rem);
	}

	.find__rooms,
	.find__artists,
	.find__works {
		list-style: none;
		margin: 1.5rem 0 0;
		padding: 0;
		display: grid;
		gap: 1rem;
	}

	.find__rooms {
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}

	.find__room {
		position: relative;
		border: 1px solid rgb(14 24 31 / 0.1);
		background: rgb(243 240 232 / 0.55);
	}

	.find__room-link {
		display: grid;
		grid-template-rows: 10rem auto;
		color: inherit;
		text-decoration: none;
		min-height: 100%;
	}

	.find__room-media,
	.find__artist-media,
	.find__work-media {
		width: 100%;
		height: 10rem;
		object-fit: cover;
		display: block;
		background: rgb(14 24 31 / 0.06);
	}

	.find__room-media--empty,
	.find__artist-media--empty,
	.find__work-media--empty {
		background:
			linear-gradient(135deg, rgb(201 101 46 / 0.18), transparent 55%),
			rgb(14 24 31 / 0.06);
	}

	.find__room-copy,
	.find__work-copy {
		padding: 0.9rem 1rem 1.1rem;
	}

	.find__room-name,
	.find__artist-name,
	.find__work-title {
		margin: 0;
		font-size: 1.2rem;
		line-height: 1.2;
	}

	.find__tags {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		color: var(--color-ember);
		font-weight: 600;
	}

	.find__cue {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.find__directions {
		display: inline-block;
		margin: 0 1rem 1rem;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.find__artists {
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
	}

	.find__artist {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.9rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid rgb(14 24 31 / 0.1);
		background: rgb(243 240 232 / 0.45);
		color: inherit;
		text-decoration: none;
	}

	.find__artist-media {
		height: 5.5rem;
	}

	.find__works {
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
	}

	.find__work {
		display: grid;
		color: inherit;
		text-decoration: none;
		border: 1px solid rgb(14 24 31 / 0.1);
		background: rgb(243 240 232 / 0.4);
	}

	.find__work-place {
		margin: 0 0 0.35rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	@media (max-width: 640px) {
		.find__artist {
			grid-template-columns: 4.5rem 1fr;
		}
	}
</style>
