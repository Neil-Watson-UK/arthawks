<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ArtworkQr from '$lib/components/qr/ArtworkQr.svelte';
	import ArtHawksWordmark from '$lib/components/brand/ArtHawksWordmark.svelte';
	import ShareActions from '$lib/components/share/ShareActions.svelte';
	import { formatArtStyle } from '$lib/constants/art-styles';
	import { artworkRoute, artistRoute, roomRoute, ROUTES } from '$lib/constants/routes';
	import { discoverFeed, currentUser, logSpottedInteraction } from '$lib/stores/network';
	import { formatArtistName, formatPrice } from '$lib/utils/format';
	import { directionsUrl, visitCueLine } from '$lib/visit-cue';
	import type { CityMapPin } from '$lib/types/map';

	let { data } = $props();

	let spottingArtworkId = $state<string | null>(null);
	let note = $state('');
	let submitError = $state<string | null>(null);
	let isSubmitting = $state(false);

	type VenueGeo = { lat: number; lng: number; opening_hours: string | null };
	let venueGeoById = $state<Record<string, VenueGeo>>({});

	const feed = $derived($discoverFeed);
	const signedIn = $derived(Boolean($page.data.session || $page.data.sessionIdentity));
	const showWallQr = $derived(signedIn && $currentUser.role !== 'buyer');
	const showShare = $derived(!signedIn || $currentUser.role === 'buyer');
	const worksSold = $derived($page.data.worksSold ?? 0);
	const spotlight = $derived(data.spotlight);
	const hasSpotlight = $derived(Boolean(spotlight?.artist || spotlight?.venue));

	const featuredRoom = $derived(feed.rooms[0] ?? null);
	const otherRooms = $derived(feed.rooms.slice(1));
	const leadWork = $derived(feed.artworks[0] ?? null);
	const galleryRest = $derived(feed.artworks.slice(1));

	onMount(() => {
		void (async () => {
			try {
				const response = await fetch('/api/map');
				const payload = (await response.json().catch(() => null)) as {
					pins?: CityMapPin[];
				} | null;
				const next: Record<string, VenueGeo> = {};
				for (const pin of payload?.pins ?? []) {
					if (!pin.venue_id || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
					next[pin.venue_id] = {
						lat: pin.lat,
						lng: pin.lng,
						opening_hours: pin.opening_hours ?? null
					};
				}
				venueGeoById = next;
			} catch {
				/* Visit cues stay optional if map enrichment fails */
			}
		})();
	});

	function openSpotForm(artworkId: string): void {
		spottingArtworkId = artworkId;
		note = '';
		submitError = null;
	}

	function cancelSpotForm(): void {
		spottingArtworkId = null;
		submitError = null;
	}

	async function submitSpot(artworkId: string): Promise<void> {
		if (!signedIn) {
			submitError = 'Sign in to log a spotting.';
			return;
		}
		if (isSubmitting) return;
		isSubmitting = true;
		submitError = null;

		try {
			await logSpottedInteraction({
				username: $currentUser.username,
				artwork_id: artworkId,
				content: note.trim()
			});
			spottingArtworkId = null;
			note = '';
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Could not log spotting';
		} finally {
			isSubmitting = false;
		}
	}

	function artworkLabel(artworkId: string): string {
		return feed.artworks.find((a) => a.id === artworkId)?.title ?? 'this painting';
	}

	function formatTimestamp(iso: string): string {
		return new Intl.DateTimeFormat('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			day: 'numeric',
			month: 'short'
		}).format(new Date(iso));
	}

	type PlacementTone = 'showing' | 'transit' | 'nearby';

	function whereLine(card: (typeof feed.artworks)[number]): {
		prefix: string;
		venue_name: string | null;
		venue_id: string | null;
		tone: PlacementTone;
	} {
		if (card.placement?.placement === 'showing') {
			return {
				prefix: 'Now showing at',
				venue_name: card.placement.venue_name,
				venue_id: card.placement.venue_id,
				tone: 'showing'
			};
		}
		if (card.placement) {
			return {
				prefix: 'Heading toward',
				venue_name: card.placement.venue_name,
				venue_id: card.placement.venue_id,
				tone: 'transit'
			};
		}
		return {
			prefix: 'In studio',
			venue_name: null,
			venue_id: null,
			tone: 'nearby'
		};
	}

	function visitFor(card: (typeof feed.artworks)[number]) {
		const where = whereLine(card);
		if (!where.venue_id) {
			return { where, cue: null as string | null, directions: null as string | null, roomHref: null as string | null };
		}
		const geo = venueGeoById[where.venue_id];
		const room = feed.rooms.find((r) => r.venue_id === where.venue_id);
		return {
			where,
			cue: visitCueLine({
				opening_hours: geo?.opening_hours,
				showing_count: room?.work_count ?? (where.tone === 'showing' ? 1 : 0)
			}),
			directions: geo ? directionsUrl(geo.lat, geo.lng) : null,
			roomHref: roomRoute(where.venue_id)
		};
	}
</script>

<section class="discover">
	<div class="discover__wash" aria-hidden="true"></div>

	<div class="discover__inner">
		<!-- 1. Hero: one composition -->
		<header class="hero">
			<ArtHawksWordmark size="body" showLink={false} />
			<h1 class="hero__title">The city is the gallery.</h1>
			<p class="hero__lede">
				Browse the work first - then go see it on café and pub walls.
			</p>
			{#if worksSold > 0}
				<p class="hero__proof">
					<strong>{worksSold}</strong>
					{worksSold === 1 ? 'work sold' : 'works sold'} through Art Hawks - from walls into homes.
				</p>
			{/if}
			<p class="hero__cta">
				<a class="hero__cta-primary" href={ROUTES.discoverSwipe}>Taste Match</a>
				<a class="hero__cta-secondary" href={ROUTES.map}>View the map</a>
			</p>
		</header>

		{#if !signedIn}
			<p class="guest-nudge" role="note">
				Browsing is open - no account needed.
				<a href={ROUTES.onboardBuyer}>Create an account</a>
				to log spottings and keep your taste, or
				<a href={ROUTES.login}>sign in</a>.
			</p>
		{/if}

		{#if hasSpotlight}
			<section class="spotlight" aria-label="Today’s picks">
				<header class="spotlight__head">
					<p class="label">Today</p>
					<h2 class="spotlight__title">Artist &amp; venue of the day</h2>
					<p class="spotlight__lede">
						A fresh pairing each day.
						<a href={ROUTES.artists}>Browse all artists</a>
					</p>
				</header>
				<div class="spotlight__grid">
					{#if spotlight.artist}
						<a
							class="spotlight__card"
							href={artistRoute(spotlight.artist.username || spotlight.artist.id)}
						>
							{#if spotlight.artist.cover_image_url || spotlight.artist.image_url}
								<img
									src={spotlight.artist.cover_image_url || spotlight.artist.image_url}
									alt=""
									loading="lazy"
								/>
							{/if}
							<div class="spotlight__copy">
								<p class="label">Artist of the day</p>
								<strong>{spotlight.artist.full_name}</strong>
								{#if spotlight.artist.medium}
									<span>{spotlight.artist.medium}</span>
								{/if}
							</div>
						</a>
					{/if}
					{#if spotlight.venue}
						<a class="spotlight__card" href={roomRoute(spotlight.venue.id)}>
							{#if spotlight.venue.image_url}
								<img src={spotlight.venue.image_url} alt="" loading="lazy" />
							{/if}
							<div class="spotlight__copy">
								<p class="label">Venue of the day</p>
								<strong>{spotlight.venue.name}</strong>
								{#if spotlight.venue.district || spotlight.venue.postcode}
									<span
										>{[spotlight.venue.district, spotlight.venue.postcode]
											.filter(Boolean)
											.join(' · ')}</span
									>
								{/if}
							</div>
						</a>
					{/if}
				</div>
			</section>
		{/if}

		<!-- 2. Works: art-first gallery -->
		<section class="works" aria-label="Works on walls">
			<header class="works__head">
				<p class="label">On the walls</p>
				<h2 class="works__title">Open the door</h2>
			</header>

			{#if !leadWork}
				<p class="discover__empty">The walls are quiet for now. Artists are hanging the next chapter.</p>
			{:else}
				{@const leadVisit = visitFor(leadWork)}
				<article class="lead">
					<a class="lead__frame" href={artworkRoute(leadWork.id)}>
						<img src={leadWork.image_url} alt={leadWork.title} loading="eager" />
					</a>
					<div class="lead__body">
						<p class="lead__place label label--venue">
							{leadVisit.where.prefix}
							{#if leadVisit.where.venue_id && leadVisit.where.venue_name}
								<a href={roomRoute(leadVisit.where.venue_id)}>{leadVisit.where.venue_name}</a>
							{/if}
						</p>
						{#if leadVisit.cue}
							<p class="visit-cue">{leadVisit.cue}</p>
						{/if}
						<h3 class="lead__title">
							<a href={artworkRoute(leadWork.id)}>{leadWork.title}</a>
						</h3>
						<p class="label label--artist">
							<a href={artistRoute(leadWork.artist_username || leadWork.artist_id)}
								>{formatArtistName(leadWork.artist_full_name, leadWork.artist_username)}</a
							>
						</p>
						{#if leadWork.style}
							<p class="lead__style">{formatArtStyle(leadWork.style)}</p>
						{/if}
						{#if leadWork.description}
							<p class="lead__story">{leadWork.description}</p>
						{/if}
						<p class="lead__price">{formatPrice(leadWork.price)}</p>
						<div class="lead__actions">
							<a class="lead__door" href={artworkRoute(leadWork.id)}>Open the door</a>
							{#if leadVisit.roomHref}
								<a class="visit-cta" href={leadVisit.roomHref}>Go see it</a>
							{/if}
							{#if leadVisit.directions}
								<a class="visit-cta visit-cta--ghost" href={leadVisit.directions} target="_blank" rel="noopener noreferrer"
									>Directions</a
								>
							{/if}
							{#if showShare}
								<ShareActions
									path={artworkRoute(leadWork.id)}
									title={leadWork.title}
									text={`I found “${leadWork.title}” on Art Hawks - original art in everyday rooms.`}
								/>
							{/if}
							{#if showWallQr}
								<ArtworkQr artworkId={leadWork.id} size={64} compact caption="Wall QR" />
							{/if}
						</div>
						{#if spottingArtworkId === leadWork.id}
							{#if !signedIn}
								<p class="spot-promo" role="status">
									<a href={ROUTES.login}>Sign in</a>
									or
									<a href={ROUTES.onboardBuyer}>create an account</a>
									to log a spotting - keep browsing either way.
									<button class="spot-promo__dismiss" type="button" onclick={cancelSpotForm}
										>Dismiss</button
									>
								</p>
							{:else}
								<form
									class="spot-form"
									onsubmit={(e) => {
										e.preventDefault();
										void submitSpot(leadWork.id);
									}}
								>
									<label class="spot-form__label" for="note-{leadWork.id}">Where did you see it?</label>
									<textarea
										id="note-{leadWork.id}"
										class="spot-form__input"
										rows="2"
										placeholder="Spotted over lunch at..."
										bind:value={note}
									></textarea>
									{#if submitError}
										<p class="spot-form__error" role="alert">{submitError}</p>
									{/if}
									<div class="spot-form__actions">
										<button class="btn btn--primary" type="submit" disabled={isSubmitting}>
											{isSubmitting ? 'Logging...' : 'Log spotting'}
										</button>
										<button class="btn btn--ghost" type="button" onclick={cancelSpotForm}>Cancel</button>
									</div>
								</form>
							{/if}
						{:else}
							<button type="button" class="spot-trigger" onclick={() => openSpotForm(leadWork.id)}>
								I spotted this in the wild
							</button>
						{/if}
					</div>
				</article>

				{#if galleryRest.length > 0}
					<div class="rail" role="list">
						{#each galleryRest as artwork, index (artwork.id)}
							{@const visit = visitFor(artwork)}
							<article class="row" class:row--flip={index % 2 === 1} role="listitem">
								<a class="row__frame" href={artworkRoute(artwork.id)}>
									<img src={artwork.image_url} alt={artwork.title} loading="lazy" />
								</a>
								<div class="row__body">
									<p class="label label--venue">
										{visit.where.prefix}
										{#if visit.where.venue_id && visit.where.venue_name}
											<a href={roomRoute(visit.where.venue_id)}>{visit.where.venue_name}</a>
										{/if}
									</p>
									{#if visit.cue}
										<p class="visit-cue">{visit.cue}</p>
									{/if}
									<h3 class="row__title">
										<a href={artworkRoute(artwork.id)}>{artwork.title}</a>
									</h3>
									<p class="label label--artist">
										<a href={artistRoute(artwork.artist_username || artwork.artist_id)}
											>{formatArtistName(artwork.artist_full_name, artwork.artist_username)}</a
										>
									</p>
									{#if artwork.style}
										<p class="row__style">{formatArtStyle(artwork.style)}</p>
									{/if}
									{#if artwork.description}
										<p class="row__story">{artwork.description}</p>
									{/if}
									<p class="row__meta">
										<span>{formatPrice(artwork.price)}</span>
										<span aria-hidden="true">·</span>
										<span
											>{artwork.spotting_count}
											{artwork.spotting_count === 1 ? 'spotting' : 'spottings'}</span
										>
									</p>
									<div class="row__actions">
										<a class="row__door" href={artworkRoute(artwork.id)}>Open the door</a>
										{#if visit.roomHref}
											<a class="visit-cta" href={visit.roomHref}>Go see it</a>
										{/if}
										{#if visit.directions}
											<a class="visit-cta visit-cta--ghost" href={visit.directions} target="_blank" rel="noopener noreferrer"
												>Directions</a
											>
										{/if}
									</div>
									{#if showShare}
										<div class="row__share">
											<ShareActions
												path={artworkRoute(artwork.id)}
												title={artwork.title}
												text={`I found “${artwork.title}” on Art Hawks - original art in everyday rooms.`}
											/>
										</div>
									{/if}
									{#if showWallQr}
										<div class="row__qr">
											<ArtworkQr artworkId={artwork.id} size={56} compact caption="Wall QR" />
										</div>
									{/if}
									{#if spottingArtworkId === artwork.id}
										{#if !signedIn}
											<p class="spot-promo" role="status">
												<a href={ROUTES.login}>Sign in</a>
												or
												<a href={ROUTES.onboardBuyer}>create an account</a>
												to log a spotting - keep browsing either way.
												<button class="spot-promo__dismiss" type="button" onclick={cancelSpotForm}
													>Dismiss</button
												>
											</p>
										{:else}
											<form
												class="spot-form"
												onsubmit={(e) => {
													e.preventDefault();
													void submitSpot(artwork.id);
												}}
											>
												<label class="spot-form__label" for="note-{artwork.id}">Where did you see it?</label>
												<textarea
													id="note-{artwork.id}"
													class="spot-form__input"
													rows="2"
													placeholder="Spotted over lunch at..."
													bind:value={note}
												></textarea>
												{#if submitError}
													<p class="spot-form__error" role="alert">{submitError}</p>
												{/if}
												<div class="spot-form__actions">
													<button class="btn btn--primary" type="submit" disabled={isSubmitting}>
														{isSubmitting ? 'Logging...' : 'Log spotting'}
													</button>
													<button class="btn btn--ghost" type="button" onclick={cancelSpotForm}
														>Cancel</button
													>
												</div>
											</form>
										{/if}
									{:else}
										<button
											type="button"
											class="spot-trigger"
											onclick={() => openSpotForm(artwork.id)}
										>
											I spotted this in the wild
										</button>
									{/if}
								</div>
							</article>
						{/each}
					</div>
				{/if}
			{/if}
		</section>

		<!-- 3. Featured room: secondary, after art -->
		{#if featuredRoom}
			<section class="feature-room" aria-labelledby="feature-room-title">
				<p class="label label--venue">Room with art</p>
				<div class="feature-room__stage">
					{#if featuredRoom.image_url}
						<a class="feature-room__media" href={roomRoute(featuredRoom.venue_id)}>
							<img src={featuredRoom.image_url} alt="" loading="lazy" />
						</a>
					{/if}
					<div class="feature-room__copy">
						<p class="label label--place">{featuredRoom.location}</p>
						<h2 id="feature-room-title" class="feature-room__name">
							<a href={roomRoute(featuredRoom.venue_id)}>{featuredRoom.venue_name}</a>
						</h2>
						{#if featuredRoom.bio}
							<p class="feature-room__bio">{featuredRoom.bio}</p>
						{/if}
						<p class="feature-room__count">
							{featuredRoom.work_count}
							{featuredRoom.work_count === 1 ? 'work' : 'works'} on the walls
						</p>
						<ol class="feature-room__hanging">
							{#each featuredRoom.works as work, i (work.id)}
								<li>
									<span class="feature-room__num" aria-hidden="true"
										>{String(i + 1).padStart(2, '0')}</span
									>
									<a href={artworkRoute(work.id)}>{work.title}</a>
									<span class="label label--artist feature-room__by">
										<a href={artistRoute(work.artist_username || work.artist_id)}
											>{formatArtistName(work.artist_full_name, work.artist_username)}</a
										>
									</span>
								</li>
							{/each}
						</ol>
						<a class="feature-room__enter" href={roomRoute(featuredRoom.venue_id)}>Enter the room</a>
					</div>
				</div>
			</section>
		{/if}

		{#if otherRooms.length > 0}
			<section class="room-index" aria-label="More rooms">
				<p class="label label--venue">Also open</p>
				<ul class="room-index__list">
					{#each otherRooms as room (room.venue_id)}
						<li>
							<a class="room-index__name" href={roomRoute(room.venue_id)}>{room.venue_name}</a>
							<span class="label label--place">{room.location}</span>
							<span class="room-index__n">{room.work_count}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- 4. Spottings -->
		<section class="traces" aria-label="Hawkeyed Art Lovers">
			<header class="traces__head">
				<p class="label label--people">
					<span class="traces__live" aria-hidden="true"></span>
					People
				</p>
				<h2 class="traces__title">Hawkeyed Art Lovers</h2>
				<p class="traces__intro">
					Art that art lovers have seen, and loved, hanging on Art Hawks walls.
				</p>
			</header>

			{#if feed.interactions.length === 0}
				<p class="traces__empty">No spottings yet. Be the first to notice a work in the wild.</p>
			{:else}
				<ul class="traces__list">
					{#each feed.interactions as interaction (interaction.id)}
						<li class="trace">
							<span class="trace__time">{formatTimestamp(interaction.created_at)}</span>
							<span class="label label--artist">@{interaction.username}</span>
							<p class="trace__copy">
								Spotted <strong>{artworkLabel(interaction.artwork_id)}</strong>
								{#if interaction.content}
									- {interaction.content}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="triad triad--footer" aria-label="Spaces, art, and people">
			<div class="triad__item triad__item--spaces">
				<p class="triad__label">Spaces</p>
				<p class="triad__value">{feed.rooms.length}</p>
				<p class="triad__hint">{feed.rooms.length === 1 ? 'room open' : 'rooms open'}</p>
			</div>
			<div class="triad__item triad__item--art">
				<p class="triad__label">Art</p>
				<p class="triad__value">{feed.artworks.length}</p>
				<p class="triad__hint">{feed.artworks.length === 1 ? 'work on walls' : 'works on walls'}</p>
			</div>
			<div class="triad__item triad__item--people">
				<p class="triad__label">People</p>
				<p class="triad__value">{feed.interactions.length}</p>
				<p class="triad__hint">
					{feed.interactions.length === 1 ? 'spotting' : 'spottings'}
				</p>
			</div>
		</section>

		<a class="discover__back" href={ROUTES.home}>Back to the door</a>
	</div>
</section>

<style>
	.discover {
		--tone-venue: var(--color-ember, #c9652e);
		--tone-artist: var(--color-ink, #0e181f);
		--tone-place: var(--color-moss, #2f4f40);
		--tone-people: var(--color-sky, #5c7a8a);
		--tone-pulse: var(--color-pulse, #d4a35a);
		position: relative;
		isolation: isolate;
		min-height: 100dvh;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 4rem;
		color: var(--color-ink);
		overflow: hidden;
	}

	.discover__wash {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(ellipse 60% 42% at 100% -5%, rgb(201 101 46 / 0.16), transparent 58%),
			radial-gradient(ellipse 48% 38% at -5% 28%, rgb(47 79 64 / 0.14), transparent 55%),
			radial-gradient(ellipse 40% 30% at 70% 70%, rgb(92 122 138 / 0.1), transparent 50%),
			linear-gradient(180deg, #ddd6c8 0%, var(--color-wall) 28%, #efebe2 62%, var(--color-wall) 100%);
	}

	.discover__inner {
		width: min(100%, 72rem);
		margin: 0 auto;
	}

	.label {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.label--venue {
		color: var(--tone-venue);
	}

	.label--artist {
		color: var(--tone-artist);
		opacity: 0.72;
	}

	.label--place {
		color: var(--tone-place);
	}

	.label--people {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--tone-people);
	}

	.label a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 0.18em;
		text-decoration-color: rgb(201 101 46 / 0.35);
	}

	.label--artist a {
		text-decoration-color: rgb(30 41 59 / 0.25);
	}

	.label--artist a:hover {
		text-decoration-color: rgb(30 41 59 / 0.55);
	}

	.hero {
		max-width: 40rem;
		padding: 1rem 0 2.25rem;
		animation: rise 0.8s ease-out both;
	}

	.hero__title {
		margin: 1rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2.75rem, 8.5vw, 4.5rem);
		font-weight: 500;
		line-height: 0.96;
		letter-spacing: -0.045em;
		color: var(--color-ink);
	}

	.hero__lede {
		margin: 1.35rem 0 0;
		max-width: 34ch;
		font-size: 1.08rem;
		line-height: 1.55;
		color: rgb(14 24 31 / 0.72);
	}

	.hero__proof {
		margin: 1rem 0 0;
		max-width: 36ch;
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(14 24 31 / 0.62);
	}

	.hero__proof strong {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-weight: 500;
		color: var(--color-ink, #0e181f);
	}

	.hero__cta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 1rem 1.5rem;
		margin: 1.85rem 0 0;
	}

	.hero__cta-primary {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #fff;
		text-decoration: none;
		background: var(--tone-venue);
		padding: 0.7rem 1.15rem;
	}

	.hero__cta-secondary {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--tone-venue);
		text-decoration: none;
		border-bottom: 1px solid rgb(201 101 46 / 0.4);
		padding-bottom: 0.15rem;
	}

	.triad {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 0 0 2rem;
		padding: 1.15rem 0 1.35rem;
		border-top: 1px solid rgb(14 24 31 / 0.12);
		border-bottom: 1px solid rgb(14 24 31 / 0.12);
		animation: rise 0.85s ease-out 0.05s both;
	}

	.triad--footer {
		margin: 2.5rem 0 0;
		opacity: 0.72;
		animation: none;
	}

	.triad--footer .triad__value {
		font-size: clamp(1.35rem, 3vw, 1.75rem);
	}

	.triad__item {
		position: relative;
		display: grid;
		gap: 0.2rem;
		padding: 0.35rem 0.15rem;
	}

	.triad__pulse {
		position: absolute;
		top: 0.45rem;
		right: 0.2rem;
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		opacity: 0.9;
		animation: pulse-dot 2.6s ease-out infinite;
	}

	.triad__item--spaces .triad__pulse {
		background: var(--tone-place);
		box-shadow: 0 0 0 0 rgb(47 79 64 / 0.45);
		animation-delay: 0s;
	}

	.triad__item--art .triad__pulse {
		background: var(--tone-venue);
		box-shadow: 0 0 0 0 rgb(201 101 46 / 0.45);
		animation-delay: 0.4s;
	}

	.triad__item--people .triad__pulse {
		background: var(--tone-people);
		box-shadow: 0 0 0 0 rgb(92 122 138 / 0.45);
		animation-delay: 0.8s;
	}

	.triad__label {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.triad__item--spaces .triad__label {
		color: var(--tone-place);
	}

	.triad__item--art .triad__label {
		color: var(--tone-venue);
	}

	.triad__item--people .triad__label {
		color: var(--tone-people);
	}

	.triad__value {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.65rem, 4vw, 2.25rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1;
		color: var(--color-ink);
	}

	.triad__hint {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		line-height: 1.3;
		color: rgb(14 24 31 / 0.5);
	}

	.guest-nudge {
		margin: 0 0 1.5rem;
		padding: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.62);
		animation: rise 0.85s ease-out 0.06s both;
	}

	.guest-nudge a {
		color: var(--tone-venue);
		font-weight: 600;
		text-decoration: none;
	}

	.spotlight {
		margin: 2.25rem 0 0;
		padding-top: 1.75rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}
	.spotlight__head {
		margin-bottom: 1rem;
	}
	.spotlight__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.45rem, 3vw, 1.85rem);
		font-weight: 500;
	}
	.spotlight__lede {
		margin: 0.45rem 0 0;
		font-size: 0.95rem;
		opacity: 0.75;
	}
	.spotlight__lede a {
		color: inherit;
		font-weight: 600;
	}
	.spotlight__grid {
		display: grid;
		gap: 0.85rem;
	}
	@media (min-width: 720px) {
		.spotlight__grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.spotlight__card {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.85rem;
		align-items: center;
		padding: 0.65rem;
		text-decoration: none;
		color: inherit;
		border: 1px solid rgb(30 41 59 / 0.12);
		background: rgb(255 255 255 / 0.55);
	}
	.spotlight__card img {
		width: 5.5rem;
		height: 5.5rem;
		object-fit: cover;
	}
	.spotlight__copy {
		display: grid;
		gap: 0.2rem;
	}
	.spotlight__copy strong {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 500;
	}
	.spotlight__copy span {
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.feature-room {
		padding: 2.5rem 0 2rem;
		border-top: 1px solid rgb(14 24 31 / 0.1);
		animation: rise 0.9s ease-out 0.08s both;
	}

	.feature-room__stage {
		display: grid;
		gap: 1.75rem;
		margin-top: 1.25rem;
	}

	.feature-room__media {
		display: block;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		background: var(--color-ink);
		box-shadow: 0 28px 50px rgb(14 24 31 / 0.14);
	}

	.feature-room__media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.feature-room__media:hover img {
		transform: scale(1.03);
	}

	.feature-room__name {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 3.1rem);
		font-weight: 500;
		line-height: 1.05;
		letter-spacing: -0.03em;
	}

	.feature-room__name a {
		color: var(--tone-venue);
		text-decoration: none;
	}

	.feature-room__name a:hover {
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.feature-room__bio {
		margin: 1rem 0 0;
		max-width: 42ch;
		font-size: 1rem;
		line-height: 1.55;
		color: rgb(14 24 31 / 0.72);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
	}

	.feature-room__count {
		margin: 1rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.45);
	}

	.feature-room__hanging {
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.85rem;
	}

	.feature-room__hanging li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		column-gap: 0.65rem;
		row-gap: 0.15rem;
		align-items: baseline;
	}

	.feature-room__num {
		font-family: var(--font-display);
		font-size: 0.85rem;
		color: rgb(14 24 31 / 0.35);
	}

	.feature-room__hanging a {
		grid-column: 2;
		font-family: var(--font-display);
		font-size: 1.15rem;
		color: var(--color-ink);
		text-decoration: none;
	}

	.feature-room__hanging a:hover {
		color: var(--tone-venue);
	}

	.feature-room__by {
		grid-column: 2;
	}

	.feature-room__enter {
		display: inline-block;
		margin-top: 1.75rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--tone-venue);
		text-decoration: none;
		border-bottom: 1px solid rgb(201 101 46 / 0.4);
		padding-bottom: 0.15rem;
	}

	.room-index {
		padding: 1.5rem 0 2.5rem;
		animation: rise 0.9s ease-out 0.12s both;
	}

	.room-index__list {
		margin: 0.85rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0;
	}

	.room-index__list li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 0.75rem 1.25rem;
		align-items: baseline;
		padding: 0.95rem 0;
		border-bottom: 1px solid rgb(14 24 31 / 0.08);
	}

	.room-index__name {
		font-family: var(--font-display);
		font-size: 1.2rem;
		color: var(--tone-venue);
		text-decoration: none;
	}

	.room-index__n {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgb(14 24 31 / 0.4);
	}

	.works {
		padding: 2.5rem 0 1rem;
		border-top: 1px solid rgb(14 24 31 / 0.1);
		animation: rise 1s ease-out 0.14s both;
	}

	.works__head {
		margin-bottom: 2rem;
	}

	.works__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 4vw, 2.4rem);
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.discover__empty {
		margin: 0;
		color: rgb(14 24 31 / 0.55);
	}

	.lead {
		display: grid;
		gap: 1.5rem;
		padding-bottom: 3rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid rgb(14 24 31 / 0.1);
	}

	.lead__frame {
		display: block;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--color-ink);
		max-height: min(78vh, 42rem);
		box-shadow: 0 28px 50px rgb(14 24 31 / 0.14);
	}

	.lead__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.lead__frame:hover img {
		transform: scale(1.025);
	}

	.lead__title {
		margin: 0.5rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.85rem, 4vw, 2.75rem);
		font-weight: 500;
		line-height: 1.05;
		letter-spacing: -0.03em;
	}

	.lead__title a {
		color: inherit;
		text-decoration: none;
	}

	.lead__style {
		margin: 0.45rem 0 0;
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.42);
	}

	.lead__story {
		margin: 1rem 0 0;
		max-width: 40ch;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-style: italic;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.75);
	}

	.lead__price {
		margin: 1.1rem 0 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
	}

	.lead__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 1rem 1.5rem;
		margin-top: 1.25rem;
	}

	.lead__door,
	.row__door {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--tone-venue);
		text-decoration: none;
	}

	.visit-cue {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--tone-place);
	}

	.visit-cta {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--tone-place);
		text-decoration: none;
		border-bottom: 1px solid rgb(47 79 64 / 0.35);
		padding-bottom: 0.1rem;
	}

	.visit-cta--ghost {
		color: rgb(14 24 31 / 0.55);
		border-bottom-color: rgb(14 24 31 / 0.2);
	}

	.row__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.85rem 1.25rem;
		margin-top: 0.85rem;
	}

	.rail {
		display: grid;
		gap: 0;
	}

	.row {
		display: grid;
		gap: 1.25rem;
		padding: 2.25rem 0;
		border-bottom: 1px solid rgb(14 24 31 / 0.08);
	}

	.row__frame {
		display: block;
		aspect-ratio: 5 / 6;
		overflow: hidden;
		background: rgb(14 24 31 / 0.08);
		max-width: 22rem;
	}

	.row__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.row__frame:hover img {
		transform: scale(1.03);
	}

	.row__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 3vw, 1.75rem);
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.row__title a {
		color: inherit;
		text-decoration: none;
	}

	.row__style {
		margin: 0.35rem 0 0;
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.4);
	}

	.row__story {
		margin: 0.75rem 0 0;
		max-width: 38ch;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-style: italic;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.7);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}

	.row__meta {
		margin: 0.85rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: rgb(14 24 31 / 0.5);
	}

	.row__door {
		display: inline-block;
		margin-top: 0.85rem;
	}

	.row__share,
	.row__qr {
		margin-top: 0.75rem;
	}

	.spot-trigger {
		margin-top: 1rem;
		padding: 0;
		border: none;
		background: transparent;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--tone-venue);
		cursor: pointer;
		text-align: left;
	}

	.spot-promo {
		margin: 1rem 0 0;
		padding: 0.85rem 0 0;
		border-top: 1px solid rgb(14 24 31 / 0.1);
		font-size: 0.8125rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.68);
	}

	.spot-promo a {
		color: var(--tone-venue);
		font-weight: 600;
		text-decoration: none;
	}

	.spot-promo__dismiss {
		display: inline;
		margin-left: 0.35rem;
		padding: 0;
		border: none;
		background: transparent;
		font: inherit;
		color: rgb(14 24 31 / 0.45);
		text-decoration: underline;
		cursor: pointer;
	}

	.spot-form {
		display: grid;
		gap: 0.45rem;
		margin-top: 1rem;
		max-width: 24rem;
	}

	.spot-form__label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.45);
	}

	.spot-form__input {
		width: 100%;
		padding: 0.55rem 0;
		border: none;
		border-bottom: 1px solid rgb(14 24 31 / 0.18);
		background: transparent;
		font: inherit;
		color: var(--color-ink);
		resize: vertical;
		min-height: 3rem;
	}

	.spot-form__error {
		margin: 0;
		font-size: 0.8125rem;
		color: #9a3412;
	}

	.spot-form__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn {
		min-height: 2.4rem;
		padding: 0 1rem;
		border: 1px solid transparent;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn--primary {
		border-color: var(--tone-venue);
		background: var(--tone-venue);
		color: var(--color-wall);
	}

	.btn--ghost {
		border-color: rgb(14 24 31 / 0.16);
		background: transparent;
		color: var(--color-ink);
	}

	.traces {
		margin-top: 3rem;
		padding: 2.25rem 1.35rem 1.5rem;
		border: 1px solid rgb(14 24 31 / 0.1);
		background:
			radial-gradient(ellipse 55% 60% at 0% 0%, rgb(92 122 138 / 0.12), transparent 55%),
			rgb(14 24 31 / 0.03);
	}

	.traces__live {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--tone-people);
		box-shadow: 0 0 0 0 rgb(92 122 138 / 0.45);
		animation: pulse-dot 2.4s ease-out infinite;
	}

	.traces__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: 500;
	}

	.traces__intro {
		margin: 0.65rem 0 0;
		max-width: 40ch;
		color: rgb(14 24 31 / 0.58);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.traces__empty {
		margin: 1.25rem 0 0;
		color: rgb(14 24 31 / 0.55);
		font-size: 0.9rem;
	}

	.traces__list {
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0;
	}

	.trace {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		gap: 0.25rem 1rem;
		padding: 1rem 0;
		border-bottom: 1px solid rgb(14 24 31 / 0.06);
	}

	.trace__time {
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.4);
	}

	.trace .label {
		grid-column: 2;
	}

	.trace__copy {
		grid-column: 2;
		margin: 0.15rem 0 0;
		font-size: 0.925rem;
		line-height: 1.45;
	}

	.discover__back {
		display: inline-block;
		margin-top: 2.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.45);
		text-decoration: none;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse-dot {
		0% {
			box-shadow: 0 0 0 0 currentColor;
			opacity: 0.95;
		}
		70% {
			box-shadow: 0 0 0 10px transparent;
			opacity: 0.7;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
			opacity: 0.95;
		}
	}

	@media (min-width: 800px) {
		.feature-room__stage {
			grid-template-columns: 1.15fr 0.85fr;
			gap: 2.5rem;
			align-items: end;
		}

		.feature-room__media {
			aspect-ratio: 4 / 5;
			max-height: 36rem;
		}

		.lead {
			grid-template-columns: 1.2fr 0.8fr;
			gap: 2.75rem;
			align-items: end;
		}

		.lead__frame {
			aspect-ratio: 4 / 5;
		}

		.row {
			grid-template-columns: minmax(12rem, 18rem) minmax(0, 1fr);
			gap: 2.5rem;
			align-items: center;
		}

		.row--flip {
			grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem);
		}

		.row--flip .row__frame {
			order: 2;
			justify-self: end;
		}

		.row--flip .row__body {
			order: 1;
			text-align: right;
		}

		.row--flip .row__story {
			margin-left: auto;
		}

		.row--flip .spot-form,
		.row--flip .row__share,
		.row--flip .row__qr {
			margin-left: auto;
		}

		.row--flip .spot-trigger {
			text-align: right;
			width: 100%;
		}

		.room-index__list li {
			grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 2rem;
		}

		.triad {
			gap: 1.5rem;
			padding: 1.5rem 0 1.75rem;
		}

		.traces {
			padding: 2.5rem 2rem 1.75rem;
		}
	}

	@media (min-width: 1100px) {
		.discover {
			padding-inline: 2rem;
		}

		.hero {
			padding-bottom: 3rem;
		}
	}

	@media (max-width: 520px) {
		.triad {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}

		.triad__item {
			grid-template-columns: auto auto 1fr;
			align-items: baseline;
			column-gap: 0.75rem;
			padding: 0.55rem 0;
		}

		.triad__pulse {
			position: static;
			align-self: center;
		}

		.triad__value {
			font-size: 1.35rem;
		}

		.triad__hint {
			grid-column: 3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero,
		.triad,
		.feature-room,
		.room-index,
		.works,
		.triad__pulse,
		.traces__live {
			animation: none;
		}

		.feature-room__media img,
		.lead__frame img,
		.row__frame img {
			transition: none;
		}
	}
</style>

