<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import AutoAmorBadge from '$lib/components/auto-amor/AutoAmorBadge.svelte';
	import { ART_STYLES, ART_STYLE_LABELS, isArtStyle, type ArtStyle } from '$lib/constants/art-styles';
	import { artworkRoute, ROUTES } from '$lib/constants/routes';
	import {
		acceptCuratedCollection,
		currentUser,
		getActiveVenueId
	} from '$lib/stores/network';
	import { formatArtistName, formatPrice } from '$lib/utils/format';
	import type { SwipeableArtwork } from '$lib/types/database';

	type CuratePhase = 'brief' | 'loading' | 'ready' | 'accepted' | 'error';

	type SizePreset = {
		id: string;
		label: string;
		hint: string;
		maxCm: number | null;
	};

	const SIZE_PRESETS: SizePreset[] = [
		{ id: 's', label: 'Up to 40 cm', hint: 'Narrow walls, shelves', maxCm: 40 },
		{ id: 'm', label: 'Up to 70 cm', hint: 'Most café walls', maxCm: 70 },
		{ id: 'l', label: 'Up to 100 cm', hint: 'Open rooms', maxCm: 100 },
		{ id: 'any', label: 'Any size', hint: 'No size filter', maxCm: null }
	];

	const BRIEF_KEY = 'arthawks_curate_brief';

	let phase = $state<CuratePhase>('brief');
	let cards = $state<SwipeableArtwork[]>([]);
	let venueName = $state('');
	let errorMessage = $state<string | null>(null);
	let isAccepting = $state(false);

	let count = $state(3);
	let sizeId = $state('m');
	let selectedStyles = $state<ArtStyle[]>([]);

	const isVenue = $derived($currentUser.role === 'venue');
	const sizePreset = $derived(SIZE_PRESETS.find((p) => p.id === sizeId) ?? SIZE_PRESETS[1]);

	function toggleStyle(style: ArtStyle): void {
		if (selectedStyles.includes(style)) {
			selectedStyles = selectedStyles.filter((s) => s !== style);
		} else {
			selectedStyles = [...selectedStyles, style];
		}
	}

	function rememberBrief(): void {
		if (!browser) return;
		try {
			localStorage.setItem(
				BRIEF_KEY,
				JSON.stringify({
					count,
					sizeId,
					styles: selectedStyles
				})
			);
		} catch {
			/* ignore quota */
		}
	}

	function restoreBrief(): void {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(BRIEF_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				count?: number;
				sizeId?: string;
				styles?: string[];
			};
			if (typeof parsed.count === 'number') {
				count = Math.min(5, Math.max(1, Math.round(parsed.count)));
			}
			if (parsed.sizeId && SIZE_PRESETS.some((p) => p.id === parsed.sizeId)) {
				sizeId = parsed.sizeId;
			}
			if (Array.isArray(parsed.styles)) {
				selectedStyles = parsed.styles.filter(isArtStyle);
			}
		} catch {
			/* ignore */
		}
	}

	function seedStylesFromVenue(): void {
		if (selectedStyles.length > 0) return;
		const tags = ($currentUser as { aesthetic_tags?: string[] }).aesthetic_tags ?? [];
		const fromVenue = tags.filter(isArtStyle);
		if (fromVenue.length) selectedStyles = fromVenue;
	}

	async function loadCollection(): Promise<void> {
		const venueId = getActiveVenueId();
		if (!venueId) {
			phase = 'error';
			errorMessage = 'Switch to a venue identity to curate for your walls.';
			return;
		}

		rememberBrief();
		phase = 'loading';
		errorMessage = null;

		const params = new URLSearchParams({
			venue_id: venueId,
			limit: String(count)
		});
		if (sizePreset.maxCm != null) params.set('max_cm', String(sizePreset.maxCm));
		if (selectedStyles.length) params.set('styles', selectedStyles.join(','));

		try {
			const response = await fetch(`/api/curate?${params}`);
			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { message?: string } | null;
				throw new Error(payload?.message ?? 'Could not assemble a collection');
			}

			const payload = (await response.json()) as {
				cards?: SwipeableArtwork[];
				venue_name?: string;
				empty_hint?: string | null;
			};

			cards = payload.cards ?? [];
			venueName = payload.venue_name ?? $currentUser.full_name;
			if (cards.length === 0) {
				phase = 'error';
				errorMessage =
					payload.empty_hint ??
					'Nothing matched that brief. Loosen size, add another type, or try self-curation.';
				return;
			}
			phase = 'ready';
		} catch (err) {
			phase = 'error';
			errorMessage = err instanceof Error ? err.message : 'Curation failed';
		}
	}

	async function acceptCollection(): Promise<void> {
		const venueId = getActiveVenueId();
		if (!venueId || cards.length === 0 || isAccepting) return;

		isAccepting = true;
		errorMessage = null;

		try {
			await acceptCuratedCollection(
				venueId,
				cards.map((card) => card.id)
			);
			phase = 'accepted';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not accept collection';
		} finally {
			isAccepting = false;
		}
	}

	function backToBrief(): void {
		phase = 'brief';
		errorMessage = null;
	}

	onMount(() => {
		if (!isVenue) {
			phase = 'error';
			errorMessage = 'Switch to a venue identity to curate for your walls.';
			return;
		}
		restoreBrief();
		seedStylesFromVenue();
		phase = 'brief';
	});
</script>

<section class="curate min-h-dvh bg-cream">
	<div
		class="curate__inner"
		class:curate__inner--wide={phase === 'ready'}
		class:curate__inner--brief={phase === 'brief'}
	>
		<div class="curate__rule" aria-hidden="true"></div>
		<p class="curate__eyebrow">Curate for Me</p>
		<h1 class="curate__title">
			{#if phase === 'brief'}Your brief{:else}Compass collection{/if}
		</h1>

		{#if !isVenue}
			<p class="curate__copy">
				You are viewing as <strong>{$currentUser.full_name}</strong>. Switch to a venue identity
				in the header to assemble a local collection.
			</p>
			<a class="curate__link" href={ROUTES.venue}>Back to venue hub</a>
		{:else if phase === 'brief'}
			<p class="curate__copy">
				Tell us what the room can take. We’ll assemble available works that fit - then you accept
				the collection in one go.
			</p>

			<form
				class="brief"
				onsubmit={(event) => {
					event.preventDefault();
					void loadCollection();
				}}
			>
				<fieldset class="brief__field">
					<legend>How many works?</legend>
					<div class="brief__counts" role="group" aria-label="Number of works">
						{#each [1, 2, 3, 4, 5] as n (n)}
							<button
								type="button"
								class="chip"
								class:chip--on={count === n}
								aria-pressed={count === n}
								onclick={() => (count = n)}
							>
								{n}
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset class="brief__field">
					<legend>Largest you can hang?</legend>
					<p class="brief__hint">Longest side of the work.</p>
					<div class="brief__sizes" role="group" aria-label="Maximum size">
						{#each SIZE_PRESETS as preset (preset.id)}
							<button
								type="button"
								class="size"
								class:size--on={sizeId === preset.id}
								aria-pressed={sizeId === preset.id}
								onclick={() => (sizeId = preset.id)}
							>
								<span class="size__label">{preset.label}</span>
								<span class="size__hint">{preset.hint}</span>
							</button>
						{/each}
					</div>
				</fieldset>

				<fieldset class="brief__field">
					<legend>Types that fit the room</legend>
					<p class="brief__hint">Optional - leave empty to keep the pool open.</p>
					<div class="brief__styles" role="group" aria-label="Artwork types">
						{#each ART_STYLES as style (style)}
							<button
								type="button"
								class="chip"
								class:chip--on={selectedStyles.includes(style)}
								aria-pressed={selectedStyles.includes(style)}
								onclick={() => toggleStyle(style)}
							>
								{ART_STYLE_LABELS[style]}
							</button>
						{/each}
					</div>
				</fieldset>

				<div class="curate__actions">
					<button type="submit" class="btn btn--primary">Assemble collection</button>
					<a class="btn btn--ghost" href={ROUTES.venueSwipe}>Self-curate instead</a>
					<a class="btn btn--ghost" href={ROUTES.venue}>Back</a>
				</div>
			</form>
		{:else if phase === 'loading'}
			<div class="loading" aria-live="polite" aria-busy="true">
				<div class="loading__pulse" aria-hidden="true"></div>
				<p class="loading__text">Consulting the compass...</p>
			</div>
		{:else if phase === 'accepted'}
			<div class="accepted" role="status">
				<h2 class="accepted__heading">Collection accepted.</h2>
				<p class="accepted__copy">
					Interest logged for {cards.length} works. Artists will confirm delivery from their studio.
				</p>
				<a class="btn btn--primary" href={ROUTES.venue}>Return to venue hub</a>
			</div>
		{:else if phase === 'error'}
			<p class="curate__error" role="alert">{errorMessage}</p>
			<div class="curate__actions">
				<button type="button" class="btn btn--secondary" onclick={backToBrief}>Edit brief</button>
				<button type="button" class="btn btn--ghost" onclick={loadCollection}>Try again</button>
				<a class="btn btn--ghost" href={ROUTES.venueSwipe}>Open self-curation</a>
			</div>
		{:else}
			<p class="curate__copy">
				{cards.length} work{cards.length === 1 ? '' : 's'} for <strong>{venueName}</strong>
				{#if sizePreset.maxCm != null}
					· up to {sizePreset.maxCm} cm
				{/if}
				{#if selectedStyles.length}
					· {selectedStyles.map((s) => ART_STYLE_LABELS[s]).join(', ')}
				{/if}
			</p>
			<button type="button" class="curate__edit" onclick={backToBrief}>Edit brief</button>

			<div class="curate__grid" aria-label="Curated artworks">
				{#each cards as artwork (artwork.id)}
					<article class="card">
						<div class="card__frame">
							<img class="card__image" src={artwork.image_url} alt={artwork.title} loading="lazy" />
						</div>
						<div class="card__body">
							{#if artwork.is_plug_and_play}
								<div class="card__badge">
									<AutoAmorBadge />
								</div>
							{/if}
							<p class="card__distance">{Math.round(artwork.distance_meters / 100) / 10} km away</p>
							<h2 class="card__title">{artwork.title}</h2>
							<p class="card__artist">
								{formatArtistName(artwork.artist_full_name, artwork.artist_username)}
							</p>
							{#if artwork.height_cm || artwork.width_cm}
								<p class="card__meta">
									{[artwork.height_cm, artwork.width_cm].filter(Boolean).join(' × ')} cm
									{#if artwork.style}
										· {ART_STYLE_LABELS[artwork.style as ArtStyle] ?? artwork.style}
									{/if}
								</p>
							{:else if artwork.style}
								<p class="card__meta">
									{ART_STYLE_LABELS[artwork.style as ArtStyle] ?? artwork.style}
								</p>
							{/if}
							{#if artwork.description}
								<p class="card__story">{artwork.description}</p>
							{/if}
							<p class="card__price">{formatPrice(artwork.price)}</p>
							<a class="card__link" href={artworkRoute(artwork.id)}>Open the door</a>
						</div>
					</article>
				{/each}
			</div>

			{#if errorMessage}
				<p class="curate__error" role="alert">{errorMessage}</p>
			{/if}

			<div class="curate__actions">
				<button
					type="button"
					class="btn btn--primary"
					disabled={isAccepting}
					onclick={acceptCollection}
				>
					{isAccepting ? 'Accepting...' : 'Accept Collection'}
				</button>
				<button type="button" class="btn btn--ghost" onclick={loadCollection}>Refresh</button>
				<button type="button" class="btn btn--ghost" onclick={backToBrief}>Edit brief</button>
				<a class="btn btn--ghost" href={ROUTES.venue}>Back</a>
			</div>
		{/if}
	</div>
</section>

<style>
	.curate {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 2.5rem;
		color: var(--color-indigo);
	}

	.curate__inner {
		width: min(100%, 36rem);
		margin: 0 auto;
	}

	.curate__inner--wide {
		width: min(100%, 64rem);
	}

	.curate__inner--brief {
		width: min(100%, 32rem);
	}

	.curate__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.curate__eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.curate__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.curate__copy {
		margin: 1rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
		max-width: 42ch;
	}

	.curate__edit {
		margin: 0.65rem 0 0;
		padding: 0;
		border: 0;
		background: none;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-burnt);
		cursor: pointer;
	}

	.curate__error {
		margin: 1.25rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.875rem;
		color: #9a3412;
	}

	.curate__link {
		display: inline-block;
		margin-top: 1.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
		text-decoration: none;
	}

	.brief {
		margin-top: 1.75rem;
		display: grid;
		gap: 1.65rem;
	}

	.brief__field {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.brief__field legend {
		padding: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
		font-weight: 500;
	}

	.brief__hint {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		color: rgb(30 41 59 / 0.5);
	}

	.brief__counts,
	.brief__styles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.75rem;
	}

	.brief__sizes {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.chip,
	.size {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		cursor: pointer;
		border: 1px solid rgb(30 41 59 / 0.16);
		background: rgb(250 249 246 / 0.8);
		color: var(--color-indigo);
	}

	.chip {
		min-height: 2.35rem;
		min-width: 2.35rem;
		padding: 0 0.85rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.chip--on,
	.size--on {
		border-color: var(--color-burnt);
		background: rgb(201 101 46 / 0.12);
		color: #8a3d12;
	}

	.size {
		display: grid;
		gap: 0.15rem;
		padding: 0.75rem 0.9rem;
		text-align: left;
	}

	.size__label {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.size__hint {
		font-size: 0.75rem;
		color: rgb(30 41 59 / 0.5);
	}

	.loading {
		display: grid;
		justify-items: center;
		gap: 1rem;
		margin-top: 3rem;
		padding: 2rem 0;
	}

	.loading__pulse {
		width: 2.5rem;
		height: 2.5rem;
		border: 2px solid rgb(30 41 59 / 0.12);
		border-top-color: var(--color-burnt);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}

	.loading__text {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.accepted {
		margin-top: 2rem;
	}

	.accepted__heading {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.75rem;
		font-weight: 500;
	}

	.accepted__copy {
		margin: 0.85rem 0 1.5rem;
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
		max-width: 36ch;
	}

	.curate__grid {
		display: grid;
		gap: 1.5rem;
		margin-top: 1.25rem;
	}

	@media (min-width: 720px) {
		.curate__grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.curate__grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.card__frame {
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--color-indigo);
	}

	.card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card__body {
		padding: 1rem 0 0;
	}

	.card__badge {
		margin: 0 0 0.45rem;
	}

	.card__distance {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.card__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.25rem;
		font-weight: 500;
	}

	.card__artist,
	.card__story,
	.card__price,
	.card__meta {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.62);
	}

	.card__story {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card__price {
		color: var(--color-indigo);
		font-weight: 600;
	}

	.card__link {
		display: inline-block;
		margin-top: 0.75rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.curate__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 2rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0 1.2rem;
		border: 1px solid transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn--primary {
		background: var(--color-burnt);
		border-color: var(--color-burnt);
		color: var(--color-cream);
	}

	.btn--secondary {
		background: transparent;
		border-color: rgb(30 41 59 / 0.2);
		color: var(--color-indigo);
	}

	.btn--ghost {
		background: transparent;
		color: rgb(30 41 59 / 0.55);
	}
</style>
