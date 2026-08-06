<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { artworkRoute, claimSpaceRoute, roomRoute, ROUTES, spaceRoute } from '$lib/constants/routes';
	import type { CityMapPin, CityMapResponse, ProspectMapPin } from '$lib/types/map';
	import { directionsUrl, visitCueLine } from '$lib/visit-cue';

	let mapEl = $state<HTMLDivElement | null>(null);
	let map: import('maplibre-gl').Map | null = null;
	let markers: import('maplibre-gl').Marker[] = [];

	let pins = $state<CityMapPin[]>([]);
	let prospectPins = $state<ProspectMapPin[]>([]);
	let selected = $state<CityMapPin | null>(null);
	let selectedProspect = $state<ProspectMapPin | null>(null);
	let loadError = $state<string | null>(null);
	let isLoading = $state(true);
	let cityLabel = $state('Nearby');

	const signedIn = $derived(Boolean($page.data.session || $page.data.sessionIdentity));

	const selectedVisitCue = $derived(
		selected
			? visitCueLine({
					opening_hours: selected.opening_hours,
					showing_count: selected.showing_count
				})
			: null
	);

	async function loadPins(): Promise<CityMapResponse> {
		const response = await fetch('/api/map');
		if (!response.ok) {
			const payload = (await response.json().catch(() => null)) as { message?: string } | null;
			throw new Error(payload?.message ?? 'Could not load the map');
		}
		return (await response.json()) as CityMapResponse;
	}

	function readVisitorLocation(): Promise<{ lat: number; lng: number } | null> {
		if (!browser || !navigator.geolocation) return Promise.resolve(null);
		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
				() => resolve(null),
				{ enableHighAccuracy: false, timeout: 4000, maximumAge: 120_000 }
			);
		});
	}

	function clearMarkers(): void {
		for (const marker of markers) marker.remove();
		markers = [];
	}

	function selectPin(pin: CityMapPin): void {
		selectedProspect = null;
		selected = pin;
		if (map) {
			map.flyTo({
				center: [pin.lng, pin.lat],
				zoom: Math.max(map.getZoom(), 14),
				essential: true
			});
		}
	}

	function selectProspect(pin: ProspectMapPin): void {
		selected = null;
		selectedProspect = pin;
		if (map) {
			map.flyTo({
				center: [pin.lng, pin.lat],
				zoom: Math.max(map.getZoom(), 14),
				essential: true
			});
		}
	}

	function closeSheet(): void {
		selected = null;
		selectedProspect = null;
	}

	function createMarkerElement(pin: CityMapPin): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'map-pin';
		button.setAttribute('aria-label', `${pin.venue_name}, ${pin.works.length} works`);

		const total = pin.showing_count + pin.transit_count;
		button.innerHTML = `
			<span class="map-pin__dot"></span>
			<span class="map-pin__label">${pin.venue_name}</span>
			${total > 0 ? `<span class="map-pin__count">${total}</span>` : ''}
		`;

		button.addEventListener('click', (event) => {
			event.stopPropagation();
			selectPin(pin);
		});

		return button;
	}

	function createProspectMarkerElement(pin: ProspectMapPin): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'map-pin map-pin--prospect';
		button.setAttribute('aria-label', `${pin.name}, potential Art Hawks space`);
		button.innerHTML = `
			<span class="map-pin__dot map-pin__dot--prospect"></span>
			<span class="map-pin__label">${pin.name}</span>
		`;
		button.addEventListener('click', (event) => {
			event.stopPropagation();
			selectProspect(pin);
		});
		return button;
	}

	async function mountMap(): Promise<void> {
		if (!browser || !mapEl) return;

		const maplibregl = await import('maplibre-gl');
		await import('maplibre-gl/dist/maplibre-gl.css');

		const [payload, visitor] = await Promise.all([loadPins(), readVisitorLocation()]);
		pins = payload.pins;
		prospectPins = payload.prospect_pins ?? [];
		cityLabel = visitor ? 'Near you' : payload.city;
		isLoading = false;

		const startCenter = visitor
			? [visitor.lng, visitor.lat]
			: [payload.center.lng, payload.center.lat];

		map = new maplibregl.Map({
			container: mapEl,
			style: 'https://tiles.openfreemap.org/styles/positron',
			center: startCenter as [number, number],
			zoom: visitor ? 11.5 : 11,
			attributionControl: { compact: true }
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

		map.on('click', () => {
			closeSheet();
		});

		clearMarkers();

		for (const pin of payload.pins) {
			const marker = new maplibregl.Marker({ element: createMarkerElement(pin), anchor: 'bottom' })
				.setLngLat([pin.lng, pin.lat])
				.addTo(map);
			markers.push(marker);
		}

		for (const pin of prospectPins) {
			const marker = new maplibregl.Marker({
				element: createProspectMarkerElement(pin),
				anchor: 'bottom'
			})
				.setLngLat([pin.lng, pin.lat])
				.addTo(map);
			markers.push(marker);
		}

		const allPins = [...payload.pins, ...prospectPins];
		if (allPins.length > 0) {
			const bounds = new maplibregl.LngLatBounds();
			for (const pin of allPins) bounds.extend([pin.lng, pin.lat]);
			if (visitor) bounds.extend([visitor.lng, visitor.lat]);
			map.fitBounds(bounds, { padding: 72, maxZoom: 13.5, duration: 800 });
		}
	}

	onMount(() => {
		void mountMap().catch((err: unknown) => {
			isLoading = false;
			loadError = err instanceof Error ? err.message : 'Map failed to load';
		});
	});

	onDestroy(() => {
		clearMarkers();
		map?.remove();
		map = null;
	});
</script>

<section class="city-map">
	<header class="city-map__header">
		<div class="city-map__rule" aria-hidden="true"></div>
		<p class="city-map__eyebrow">{cityLabel}</p>
		<h1 class="city-map__title">Rooms nearby</h1>
		<p class="city-map__intro">
			Partner venues show hung work. Hollow pins are potential Art Hawks spaces - not partners -
			you can claim them if you represent the venue.
			<a href={ROUTES.spaces}>Browse potential spaces</a>.
		</p>
		{#if !signedIn}
			<p class="city-map__nudge" role="note">
				No account needed to explore.
				<a href={ROUTES.onboardBuyer}>Create an account</a>
				to save taste preferences, or
				<a href={ROUTES.login}>sign in</a>.
			</p>
		{/if}
	</header>

	<div class="city-map__stage">
		{#if isLoading}
			<p class="city-map__status">Unfolding the city…</p>
		{/if}
		{#if loadError}
			<p class="city-map__error" role="alert">{loadError}</p>
		{/if}
		<div class="city-map__canvas" bind:this={mapEl} role="presentation"></div>
	</div>

	{#if selectedProspect}
		<aside class="sheet sheet--prospect" aria-label={selectedProspect.name}>
			<button type="button" class="sheet__close" onclick={closeSheet}>Close</button>
			<p class="sheet__eyebrow">Potential Art Hawks space</p>
			<h2 class="sheet__title">
				<a class="sheet__title-link" href={spaceRoute(selectedProspect.prospect_id)}
					>{selectedProspect.name}</a
				>
			</h2>
			<p class="sheet__bio">
				Could this space become part of Bristol’s living gallery? This is not an Art Hawks partner
				and is not currently hosting artwork.
			</p>
			{#if selectedProspect.category}
				<p class="sheet__census">{selectedProspect.category}</p>
			{/if}
			<div class="sheet__actions">
				<a
					class="sheet__go"
					href={directionsUrl(selectedProspect.lat, selectedProspect.lng)}
					target="_blank"
					rel="noopener noreferrer"
				>
					Go there now
				</a>
				{#if selectedProspect.lifecycle_status === 'unclaimed'}
					<a class="sheet__room" href={claimSpaceRoute(selectedProspect.prospect_id)}
						>Claim this venue</a
					>
				{:else}
					<a class="sheet__room" href={spaceRoute(selectedProspect.prospect_id)}>View status</a>
				{/if}
			</div>
		</aside>
	{:else if selected}
		<aside class="sheet" aria-label={selected.venue_name}>
			<button type="button" class="sheet__close" onclick={closeSheet}>Close</button>
			<p class="sheet__eyebrow">Room of the city</p>
			<h2 class="sheet__title">
				<a class="sheet__title-link" href={roomRoute(selected.venue_id)}>{selected.venue_name}</a>
			</h2>
			{#if selected.venue_bio}
				<p class="sheet__bio">{selected.venue_bio}</p>
			{/if}

			<p class="sheet__census">
				<span>{selected.showing_count} showing</span>
				<span aria-hidden="true">·</span>
				<span>{selected.transit_count} heading here</span>
			</p>

			{#if selectedVisitCue}
				<p class="sheet__visit">{selectedVisitCue}</p>
			{/if}

			{#if selected.works.length === 0}
				<p class="sheet__empty">Walls waiting - no works placed here yet.</p>
			{:else}
				<ul class="sheet__works">
					{#each selected.works as work (work.id)}
						<li class="sheet__work">
							<a class="sheet__work-link" href={artworkRoute(work.id)}>
								{#if work.image_url}
									<img class="sheet__thumb" src={work.image_url} alt="" loading="lazy" />
								{/if}
								<span class="sheet__work-copy">
									<span
										class="sheet__placement sheet__placement--{work.placement}"
									>
										{work.placement === 'showing' ? 'Now showing' : 'Heading here'}
									</span>
									<span class="sheet__work-title">{work.title}</span>
									<span class="sheet__work-artist">{work.artist_name}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="sheet__actions">
				<a
					class="sheet__go"
					href={directionsUrl(selected.lat, selected.lng)}
					target="_blank"
					rel="noopener noreferrer"
				>
					Go there now
				</a>
				<a class="sheet__room" href={roomRoute(selected.venue_id)}>Open the room</a>
			</div>
		</aside>
	{/if}

	{#if !selected && pins.length > 0}
		<ul class="city-map__list" aria-label="Venue rooms">
			{#each pins as pin (pin.venue_id)}
				<li class="city-map__list-row">
					<button type="button" class="city-map__list-item" onclick={() => selectPin(pin)}>
						<span class="city-map__list-name">{pin.venue_name}</span>
						<span class="city-map__list-meta">
							{pin.showing_count + pin.transit_count}
							{pin.showing_count + pin.transit_count === 1 ? 'work' : 'works'}
						</span>
					</button>
					<a class="city-map__list-room" href={roomRoute(pin.venue_id)}>Open room page</a>
				</li>
			{/each}
		</ul>
	{/if}

	<a class="city-map__back" href={ROUTES.discover}>Back to Discover</a>
</section>

<style>
	.city-map {
		display: grid;
		gap: 1.25rem;
		padding: max(1.5rem, env(safe-area-inset-top)) 1.25rem 2.5rem;
		color: var(--color-indigo);
		background: var(--color-cream);
		min-height: 100dvh;
	}

	.city-map__header {
		width: min(100%, 36rem);
	}

	.city-map__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.85rem;
		background: var(--color-burnt);
	}

	.city-map__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.city-map__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.city-map__intro {
		margin: 0.85rem 0 0;
		max-width: 38ch;
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.city-map__nudge {
		margin: 0.85rem 0 0;
		max-width: 42ch;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.55);
	}

	.city-map__nudge a {
		color: var(--color-burnt);
		font-weight: 600;
		text-decoration: none;
	}

	.city-map__stage {
		position: relative;
		min-height: min(62dvh, 36rem);
		border: 1px solid rgb(30 41 59 / 0.1);
		background: rgb(30 41 59 / 0.03);
		overflow: hidden;
	}

	.city-map__canvas {
		width: 100%;
		height: min(62dvh, 36rem);
	}

	.city-map__status,
	.city-map__error {
		position: absolute;
		z-index: 2;
		left: 1rem;
		top: 1rem;
		margin: 0;
		padding: 0.55rem 0.75rem;
		background: rgb(250 249 246 / 0.92);
		font-size: 0.8125rem;
	}

	.city-map__error {
		color: #9a3412;
	}

	.city-map__list {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
		width: min(100%, 36rem);
	}

	.city-map__list-item {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding: 0.75rem 0;
		border: none;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
		background: transparent;
		text-align: left;
		cursor: pointer;
		color: inherit;
	}

	.city-map__list-name {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
	}

	.city-map__list-meta {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.city-map__back {
		justify-self: start;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.sheet {
		position: relative;
		width: min(100%, 28rem);
		padding: 1.35rem 1.25rem 1.5rem;
		border: 1px solid rgb(30 41 59 / 0.12);
		background: rgb(250 249 246 / 0.98);
		box-shadow: 0 16px 40px rgb(30 41 59 / 0.08);
	}

	.sheet__close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		border: none;
		background: transparent;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
		cursor: pointer;
	}

	.sheet__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.sheet__title {
		margin: 0.4rem 0 0;
		padding-right: 3rem;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.65rem;
		font-weight: 500;
	}

	.sheet__title-link {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid transparent;
	}

	.sheet__title-link:hover {
		border-bottom-color: rgb(194 65 12 / 0.45);
	}

	.sheet__bio {
		margin: 0.75rem 0 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.65);
	}

	.sheet__census {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 1rem 0 0;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.sheet__visit {
		margin: 0.75rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
		font-weight: 500;
		line-height: 1.35;
		color: var(--color-indigo);
	}

	.sheet__empty {
		margin: 1rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.sheet__works {
		display: grid;
		gap: 0.85rem;
		margin: 1.15rem 0 0;
		padding: 0;
		list-style: none;
	}

	.sheet__work-link {
		display: grid;
		grid-template-columns: 3.5rem 1fr;
		gap: 0.75rem;
		align-items: center;
		text-decoration: none;
		color: inherit;
	}

	.sheet__thumb {
		width: 3.5rem;
		height: 4.4rem;
		object-fit: cover;
		background: var(--color-indigo);
	}

	.sheet__work-copy {
		display: grid;
		gap: 0.2rem;
	}

	.sheet__placement {
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.sheet__placement--showing {
		color: var(--color-burnt);
	}

	.sheet__placement--transit {
		color: rgb(30 41 59 / 0.45);
	}

	.sheet__work-title {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
	}

	.sheet__work-artist {
		font-size: 0.8125rem;
		color: rgb(30 41 59 / 0.55);
	}

	.sheet__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem 1.1rem;
		margin-top: 1.25rem;
	}

	.sheet__go,
	.sheet__room {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.sheet__go {
		padding: 0.7rem 1.05rem;
		border-radius: 0.2rem;
		background: var(--color-burnt);
		color: var(--color-cream);
	}

	.sheet__go:hover {
		filter: brightness(1.05);
	}

	.sheet__room {
		color: rgb(30 41 59 / 0.55);
	}

	.sheet__room:hover {
		color: var(--color-burnt);
	}

	.city-map__list-row {
		display: grid;
		gap: 0.2rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.city-map__list-item {
		border-bottom: none;
		padding-bottom: 0.35rem;
	}

	.city-map__list-room {
		justify-self: start;
		margin: 0 0 0.45rem;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-burnt);
		text-decoration: none;
	}

	/* Marker DOM is created in JS - style via :global */
	:global(.map-pin) {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		transform: translateY(0);
		transition: transform 180ms ease;
	}

	:global(.map-pin:hover) {
		transform: translateY(-2px);
	}

	:global(.map-pin__dot) {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		background: var(--color-burnt);
		border: 2px solid #faf9f6;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.2);
	}

	:global(.map-pin__dot--prospect) {
		background: transparent;
		border: 2px solid #64748b;
		box-shadow: none;
	}

	:global(.map-pin__label) {
		max-width: 9rem;
		padding: 0.2rem 0.45rem;
		background: rgb(250 249 246 / 0.94);
		font-family: 'DM Sans', system-ui, sans-serif;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: #1e293b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.map-pin__count) {
		min-width: 1.1rem;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: #1e293b;
		color: #faf9f6;
		font-size: 0.5625rem;
		font-weight: 700;
	}

	@media (min-width: 900px) {
		.city-map {
			grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
			grid-template-rows: auto 1fr auto;
			align-items: start;
			gap: 1.25rem 1.5rem;
		}

		.city-map__header {
			grid-column: 1 / -1;
		}

		.city-map__stage {
			grid-column: 1;
			grid-row: 2;
		}

		.sheet {
			grid-column: 2;
			grid-row: 2;
			align-self: stretch;
		}

		.city-map__list {
			grid-column: 2;
			grid-row: 2;
			align-self: start;
		}

		.city-map__back {
			grid-column: 1 / -1;
		}
	}
</style>
