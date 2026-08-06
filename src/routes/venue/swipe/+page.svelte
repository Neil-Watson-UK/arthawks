<script lang="ts">
	import { onMount } from 'svelte';
	import SwipeStack from '$lib/components/SwipeStack.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { resolveSubstrateTier, type SubstrateTier } from '$lib/constants/auto-amor';
	import { ROUTES } from '$lib/constants/routes';
	import {
		currentUser,
		getActiveVenueId,
		upsertLocalMatch
	} from '$lib/stores/network';
	import type { ArtworkStatus, MatchStatus } from '$lib/types/database';
	import type { SwipeCard, SwipeEventDetail } from '$lib/types/swipe';

	let cards = $state<SwipeCard[]>([]);
	let loadError = $state<string | null>(null);
	let isLoading = $state(true);
	let lastSwipe = $state<SwipeEventDetail | null>(null);
	let toast = $state<string | null>(null);
	let isBusy = $state(false);

	const isVenue = $derived($currentUser.role === 'venue');

	function mapRpcCard(raw: Record<string, unknown>): SwipeCard {
		const substrate = resolveSubstrateTier(
			raw.substrate_tier as string | null | undefined,
			raw.height_cm as number | null | undefined,
			raw.width_cm as number | null | undefined
		);
		return {
			id: String(raw.id),
			artist_id: String(raw.artist_id),
			title: String(raw.title ?? 'Untitled'),
			medium: (raw.medium as string | null) ?? null,
			description: (raw.description as string | null) ?? null,
			style: (raw.style as SwipeCard['style']) ?? null,
			price: Number(raw.price ?? 0),
			height_cm: raw.height_cm == null ? null : Number(raw.height_cm),
			width_cm: raw.width_cm == null ? null : Number(raw.width_cm),
			image_url: String(raw.image_url ?? ''),
			status: (raw.status as ArtworkStatus) ?? 'available',
			created_at: String(raw.created_at ?? new Date().toISOString()),
			distance_meters: Number(raw.distance_meters ?? 0),
			artist_username: String(raw.artist_username ?? 'artist'),
			artist_full_name: (raw.artist_full_name as string | null) ?? null,
			substrate_tier: substrate.substrate_tier as SubstrateTier,
			is_plug_and_play: Boolean(raw.is_plug_and_play ?? substrate.is_plug_and_play),
			spottings: []
		};
	}

	async function loadDeck(): Promise<void> {
		const venueId = getActiveVenueId();
		if (!venueId) {
			loadError = 'No venue identity on this session.';
			isLoading = false;
			return;
		}

		isLoading = true;
		loadError = null;

		try {
			const response = await fetch(`/api/match?venue_id=${encodeURIComponent(venueId)}&limit=40`);
			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				cards?: Record<string, unknown>[];
			} | null;

			if (!response.ok) {
				loadError = payload?.message ?? 'Could not load the swipe deck';
				cards = [];
				return;
			}

			cards = (payload?.cards ?? []).map(mapRpcCard);
		} catch {
			loadError = 'Network error while loading nearby works.';
			cards = [];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (isVenue) void loadDeck();
		else isLoading = false;
	});

	async function persistSwipe(detail: SwipeEventDetail): Promise<void> {
		const venueId = getActiveVenueId();
		if (!venueId) return;

		const response = await fetch('/api/match', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				venue_id: venueId,
				artwork_id: detail.card.id,
				direction: detail.direction
			})
		});

		const payload = (await response.json().catch(() => null)) as {
			match?: boolean;
			status?: MatchStatus;
			message?: string;
			match_id?: string;
		} | null;

		if (!response.ok) {
			throw new Error(payload?.message ?? 'Could not save swipe');
		}

		if (payload?.match_id && payload.status) {
			upsertLocalMatch({
				id: payload.match_id,
				venue_id: venueId,
				artwork_id: detail.card.id,
				status: payload.status,
				created_at: new Date().toISOString()
			});
		}

		cards = cards.filter((card) => card.id !== detail.card.id);

		if (detail.direction === 'right') {
			toast = payload?.match
				? `Match! “${detail.card.title}” is coming to your walls.`
				: `Interested in “${detail.card.title}” - waiting on the artist.`;
		} else {
			toast = `Passed on “${detail.card.title}”`;
		}
	}

	async function handleSwipe(detail: SwipeEventDetail): Promise<void> {
		if (isBusy) return;
		isBusy = true;
		lastSwipe = detail;

		try {
			await persistSwipe(detail);
		} catch (err) {
			toast = err instanceof Error ? err.message : 'Swipe failed';
		} finally {
			isBusy = false;
			window.setTimeout(() => {
				toast = null;
			}, 2400);
		}
	}
</script>

<main class="min-h-dvh bg-cream">
	{#if isVenue}
		{#if isLoading}
			<section class="identity-guard">
				<p class="identity-guard__eyebrow">Self-Curation</p>
				<h1 class="identity-guard__title">Loading nearby works…</h1>
				<p class="identity-guard__copy">Ranking by Auto Amor plug-and-play, then PostGIS distance.</p>
			</section>
		{:else if loadError}
			<section class="identity-guard">
				<p class="identity-guard__eyebrow">Self-Curation</p>
				<h1 class="identity-guard__title">Deck unavailable</h1>
				<p class="identity-guard__copy">{loadError}</p>
				<p class="identity-guard__copy">
					Confirm your venue postcode under Settings so the map and swipe deck can locate you.
				</p>
				<a class="identity-guard__link" href={ROUTES.venueSettings}>Venue settings</a>
				<button class="identity-guard__link" type="button" onclick={() => loadDeck()}>Retry</button>
			</section>
		{:else}
			<SwipeStack cards={cards} onswipe={handleSwipe} />
		{/if}
	{:else}
		<section class="identity-guard">
			<p class="identity-guard__eyebrow">Self-Curation</p>
			<h1 class="identity-guard__title">Venue identity required</h1>
			<p class="identity-guard__copy">
				Sign in with a venue account to open the proximity-ranked swipe deck.
			</p>
			<a class="identity-guard__link" href={ROUTES.venue}>Back to venue dashboard</a>
		</section>
	{/if}

	{#if lastSwipe}
		<p class="sr-only" aria-live="polite">
			{lastSwipe.direction === 'right' ? 'Interested in' : 'Passed on'}
			{lastSwipe.card.title}
		</p>
	{/if}

	{#if toast}
		<Toast message={toast} />
	{/if}
</main>

<style>
	.identity-guard {
		width: min(100% - 2.5rem, 30rem);
		margin: 4rem auto 0;
		padding: 0 0.25rem;
		color: var(--color-indigo);
	}

	.identity-guard__eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.identity-guard__title {
		margin: 0.5rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.75rem;
		font-weight: 500;
	}

	.identity-guard__copy {
		margin: 0.85rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.identity-guard__link {
		display: inline-block;
		margin-top: 1.5rem;
		margin-right: 1rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
