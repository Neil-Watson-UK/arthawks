<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import SwipeStack from '$lib/components/SwipeStack.svelte';
	import { isArtStyle } from '$lib/constants/art-styles';
	import { roomRoute, ROUTES } from '$lib/constants/routes';
	import { loveArtwork, lovedArt } from '$lib/stores/loved-art';
	import {
		discoverFeed,
		hydrateNetworkFromSupabase,
		setTastePreferences,
		tastePreferences,
		type DiscoverFeedCard
	} from '$lib/stores/network';
	import type { CityMapPin } from '$lib/types/map';
	import type { SwipeEventDetail } from '$lib/types/swipe';
	import { directionsUrl, visitCueLine } from '$lib/visit-cue';

	type VenueGeo = { lat: number; lng: number; opening_hours: string | null };

	let cards = $state<DiscoverFeedCard[]>([]);
	let deckReady = $state(false);
	let finished = $state(false);
	let venueGeoById = $state<Record<string, VenueGeo>>({});

	const feed = $derived($discoverFeed);
	const loves = $derived($lovedArt);

	const shortlist = $derived.by(() => {
		const lovedIds = new Set(loves.map((entry) => entry.id));
		const byVenue = new Map<
			string,
			{
				venue_id: string;
				venue_name: string;
				works: DiscoverFeedCard[];
			}
		>();

		for (const work of feed.artworks) {
			if (!lovedIds.has(work.id)) continue;
			if (work.placement?.placement !== 'showing') continue;
			const venueId = work.placement.venue_id;
			const existing = byVenue.get(venueId);
			if (existing) {
				existing.works.push(work);
			} else {
				byVenue.set(venueId, {
					venue_id: venueId,
					venue_name: work.placement.venue_name,
					works: [work]
				});
			}
		}

		return [...byVenue.values()].map((room) => {
			const geo = venueGeoById[room.venue_id];
			return {
				...room,
				cue: visitCueLine({
					opening_hours: geo?.opening_hours,
					showing_count: room.works.length
				}),
				directions: geo ? directionsUrl(geo.lat, geo.lng) : null
			};
		});
	});

	function buildDeck(artworks: DiscoverFeedCard[]): DiscoverFeedCard[] {
		const showing = artworks.filter((work) => work.placement?.placement === 'showing');
		const rest = artworks.filter((work) => work.placement?.placement !== 'showing');
		return [...showing, ...rest];
	}

	function bumpTaste(style: string | null | undefined): void {
		if (!style || !isArtStyle(style)) return;
		const current = get(tastePreferences);
		if (current.includes(style)) return;
		setTastePreferences([...current, style].slice(0, 8));
	}

	function handleSwipe(detail: SwipeEventDetail): void {
		if (detail.direction === 'right') {
			loveArtwork(detail.card.id);
			bumpTaste(detail.card.style);
		}
		cards = cards.filter((card) => card.id !== detail.card.id);
		if (cards.length === 0) finished = true;
	}

	function discoverStyle(): void {
		finished = true;
	}

	function keepMatching(): void {
		finished = false;
	}

	onMount(() => {
		void (async () => {
			await hydrateNetworkFromSupabase();
			cards = buildDeck(get(discoverFeed).artworks);
			deckReady = true;
			if (cards.length === 0) finished = true;

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
				/* Directions remain optional */
			}
		})();
	});
</script>

<main class="buyer-swipe">
	{#if !deckReady}
		<section class="buyer-swipe__loading">
			<p class="buyer-swipe__eyebrow">Discover</p>
			<h1 class="buyer-swipe__title">Taste Match</h1>
			<p class="buyer-swipe__lede">Loading works for you…</p>
		</section>
	{:else if finished}
		<section class="shortlist" aria-labelledby="shortlist-title">
			<p class="buyer-swipe__eyebrow">Your taste</p>
			<h1 id="shortlist-title" class="buyer-swipe__title">Rooms matched to what you loved</h1>
			<p class="buyer-swipe__lede">
				Go see the hanging works in person - enter the room, get directions, or open the map.
			</p>

			{#if shortlist.length === 0}
				<p class="shortlist__empty">
					{#if loves.length === 0}
						No loves yet. Swipe right on work you like, then come back to Discover your style.
					{:else}
						You loved some pieces, but none are hanging in a room yet. Check Discover for studio
						works, or open the map when they go live.
					{/if}
				</p>
				<div class="shortlist__actions">
					{#if cards.length > 0}
						<button class="shortlist__cta" type="button" onclick={keepMatching}>Keep matching</button>
					{/if}
					<a class="shortlist__cta shortlist__cta--ghost" href={ROUTES.discover}>Back to Discover</a>
					<a class="shortlist__cta shortlist__cta--ghost" href={ROUTES.map}>Open map</a>
				</div>
			{:else}
				<ul class="shortlist__list">
					{#each shortlist as room (room.venue_id)}
						<li class="shortlist__room">
							<div class="shortlist__copy">
								<p class="shortlist__place">Now showing</p>
								<h2 class="shortlist__name">
									<a href={roomRoute(room.venue_id)}>{room.venue_name}</a>
								</h2>
								{#if room.cue}
									<p class="shortlist__cue">{room.cue}</p>
								{/if}
								<p class="shortlist__works">
									{room.works.length}
									{room.works.length === 1 ? 'loved work' : 'loved works'} here
									-
									{room.works.map((w) => w.title).join(', ')}
								</p>
							</div>
							<div class="shortlist__links">
								<a href={roomRoute(room.venue_id)}>Enter room</a>
								{#if room.directions}
									<a href={room.directions} target="_blank" rel="noopener noreferrer">Directions</a>
								{/if}
								<a href={ROUTES.map}>Open map</a>
							</div>
						</li>
					{/each}
				</ul>
				<div class="shortlist__actions">
					{#if cards.length > 0}
						<button class="shortlist__cta" type="button" onclick={keepMatching}>Keep matching</button>
					{/if}
					<a class="shortlist__cta shortlist__cta--ghost" href={ROUTES.discover}>Back to Discover</a>
					<a class="shortlist__cta shortlist__cta--ghost" href={ROUTES.map}>Open map</a>
				</div>
			{/if}
		</section>
	{:else}
		<p class="buyer-swipe__back">
			<a href={ROUTES.discover}>← Discover</a>
		</p>
		<SwipeStack
			{cards}
			onswipe={handleSwipe}
			eyebrow="Discover"
			title="Taste Match"
			description="Swipe left to reject and right to select the art you love. When you’re ready - even before the stack is finished - tap Discover your style below to see where your picks are hanging so you can visit them for real."
			acceptLabel="Love"
			emptyTitle="That’s the stack"
			emptyCopy="Tap Discover your style to see your rooms."
		>
			<button class="discover-style" type="button" onclick={discoverStyle}>
				Discover your style
				{#if loves.length > 0}
					<span class="discover-style__count">{loves.length} loved</span>
				{/if}
			</button>
		</SwipeStack>
	{/if}
</main>

<style>
	.buyer-swipe {
		min-height: 100dvh;
		background:
			radial-gradient(ellipse 55% 40% at 100% 0%, rgb(201 101 46 / 0.12), transparent 55%),
			radial-gradient(ellipse 45% 35% at 0% 40%, rgb(47 79 64 / 0.1), transparent 50%),
			var(--color-wall, #f3efe6);
		color: var(--color-ink, #0e181f);
	}

	.buyer-swipe__loading,
	.shortlist {
		width: min(100%, 36rem);
		margin: 0 auto;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
	}

	.buyer-swipe__eyebrow {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-ember, #c9652e);
	}

	.buyer-swipe__title {
		margin: 0.75rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	.buyer-swipe__lede {
		margin: 0.85rem 0 0;
		max-width: 40ch;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.7);
	}

	.buyer-swipe__back {
		width: min(100%, 28rem);
		margin: 0 auto;
		padding: max(1rem, env(safe-area-inset-top)) 1.25rem 0;
		position: relative;
		z-index: 2;
	}

	.buyer-swipe__back a {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.55);
		text-decoration: none;
	}

	.buyer-swipe :global(.swipe-stack) {
		min-height: auto;
		padding-top: 0.5rem;
		background: transparent;
	}

	.discover-style {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0.45rem 0.75rem;
		width: 100%;
		border: none;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #fff;
		background: var(--color-ember, #c9652e);
		padding: 0.85rem 1.15rem;
	}

	.discover-style__count {
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		opacity: 0.88;
		text-transform: none;
		font-weight: 600;
	}

	.shortlist__empty {
		margin: 1.5rem 0 0;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.72);
	}

	.shortlist__list {
		list-style: none;
		margin: 1.75rem 0 0;
		padding: 0;
		display: grid;
		gap: 1.25rem;
	}

	.shortlist__room {
		padding: 1.15rem 0;
		border-top: 1px solid rgb(14 24 31 / 0.12);
	}

	.shortlist__place {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-ember, #c9652e);
	}

	.shortlist__name {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.5rem;
		font-weight: 500;
	}

	.shortlist__name a {
		color: inherit;
		text-decoration: none;
	}

	.shortlist__cue {
		margin: 0.4rem 0 0;
		font-size: 0.875rem;
		color: var(--color-moss, #2f4f40);
	}

	.shortlist__works {
		margin: 0.55rem 0 0;
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(14 24 31 / 0.65);
	}

	.shortlist__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem 1.25rem;
		margin-top: 0.85rem;
	}

	.shortlist__links a {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-moss, #2f4f40);
		text-decoration: none;
		border-bottom: 1px solid rgb(47 79 64 / 0.35);
		padding-bottom: 0.1rem;
	}

	.shortlist__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem 1rem;
		margin-top: 2rem;
	}

	.shortlist__cta {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		color: #fff;
		background: var(--color-ember, #c9652e);
		border: none;
		cursor: pointer;
		padding: 0.7rem 1.1rem;
		font-family: inherit;
	}

	.shortlist__cta--ghost {
		color: var(--color-ember, #c9652e);
		background: transparent;
		border-bottom: 1px solid rgb(201 101 46 / 0.4);
		padding: 0.7rem 0;
	}
</style>
