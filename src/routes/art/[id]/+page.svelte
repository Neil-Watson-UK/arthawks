<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import ArtHawksLogo from '$lib/components/brand/ArtHawksLogo.svelte';
	import ArtworkQr from '$lib/components/qr/ArtworkQr.svelte';
	import ShareActions from '$lib/components/share/ShareActions.svelte';
	import { artworkRoute, artistRoute } from '$lib/constants/routes';
	import { currentUser } from '$lib/stores/network';
	import { artistInbox, logQrScan } from '$lib/stores/rotations';
	import type { ScanCondition, ScanInterest } from '$lib/types/rotations';
	import { formatArtistName, formatDimensions, formatPrice } from '$lib/utils/format';

	let { data } = $props();

	const artwork = $derived(data.artwork);
	const artistName = $derived(
		formatArtistName(artwork.artist_full_name, artwork.artist_username)
	);
	const dimensions = $derived(formatDimensions(artwork.height_cm, artwork.width_cm));
	const price = $derived(formatPrice(artwork.price));
	const hasStory = $derived(Boolean(artwork.description?.trim()));
	const signedIn = $derived(Boolean($page.data.session || $page.data.sessionIdentity));
	/* Guests open the door to meet the work - QR printing is for walls, not visitors */
	const showWallQr = $derived(signedIn && $currentUser.role !== 'buyer');
	const showShare = $derived(!signedIn || $currentUser.role === 'buyer');
	const isOwnerArtist = $derived(
		$currentUser.role === 'artist' && $currentUser.id === artwork.artist_id
	);
	const ownerPulse = $derived(
		isOwnerArtist
			? $artistInbox.wallPulse.find((row) => row.artwork?.id === artwork.id) ?? null
			: null
	);
	const canBuy = $derived(
		artwork.status !== 'sold' &&
			artwork.price >= 100 &&
			!isOwnerArtist &&
			$currentUser.role !== 'venue'
	);
	const isSold = $derived(artwork.status === 'sold');
	const worksSold = $derived($page.data.worksSold ?? 0);
	const finderVenueId = $derived(
		$page.url.searchParams.get('from') === 'past'
			? $page.url.searchParams.get('venue')
			: null
	);

	let pulseNote = $state<string | null>(null);
	let lastLoggedId = $state<string | null>(null);
	let buying = $state(false);
	let buyError = $state<string | null>(null);

	$effect(() => {
		if (!browser) return;
		const cancelled = $page.url.searchParams.get('cancelled');
		if (cancelled) {
			buyError = 'Checkout cancelled - the work is still available.';
		}
	});

	$effect(() => {
		if (!browser) return;
		const id = artwork.id;
		if (lastLoggedId === id) return;
		lastLoggedId = id;
		void logQrScan({
			artwork_id: id,
			source: 'wall_qr',
			interest_level: 'browse',
			user_id: $currentUser.id
		});
	});

	async function markInterest(level: ScanInterest): Promise<void> {
		await logQrScan({
			artwork_id: artwork.id,
			source: 'wall_qr',
			interest_level: level,
			user_id: $currentUser.id
		});
		pulseNote =
			level === 'love'
				? 'Logged - love noted for the artist and the venue pulse.'
				: level === 'buy_ask'
					? 'Logged - buy interest passed to the artist and the venue pulse.'
					: 'Logged.';
	}

	async function markCondition(condition: ScanCondition): Promise<void> {
		await logQrScan({
			artwork_id: artwork.id,
			source: 'wall_qr',
			condition,
			interest_level: 'browse',
			user_id: $currentUser.id,
			content: `Condition: ${condition}`
		});
		pulseNote = 'Condition noted - thank you for looking after the walls.';
	}

	async function buyNow(): Promise<void> {
		if (buying) return;
		buying = true;
		buyError = null;
		try {
			const response = await fetch('/api/purchases/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					artwork_id: artwork.id,
					...(finderVenueId ? { finder_venue_id: finderVenueId } : {})
				})
			});
			const payload = (await response.json().catch(() => null)) as {
				url?: string;
				message?: string;
			} | null;
			if (!response.ok || !payload?.url) {
				buyError = payload?.message ?? 'Could not start checkout';
				return;
			}
			window.location.href = payload.url;
		} catch {
			buyError = 'Network error while starting checkout.';
		} finally {
			buying = false;
		}
	}

	function printLabel(): void {
		window.print();
	}
</script>

<svelte:head>
	<title>{artwork.title} - {artistName} | ArtHawks</title>
	<meta
		name="description"
		content={artwork.description?.slice(0, 160) ||
			`Original artwork by ${artistName} on the ArtHawks compass.`}
	/>
</svelte:head>

<article class="art-door min-h-dvh bg-cream">
	<div class="art-door__inner">
		<header class="art-door__header">
			<div class="art-door__brand">
				<ArtHawksLogo variant="mark" class="art-door__mark" />
				<p class="art-door__eyebrow">Art Hawks</p>
			</div>
			<p class="art-door__kicker">You’ve opened the door.</p>
		</header>

		<figure class="art-door__frame">
			<img class="art-door__image" src={artwork.image_url} alt={artwork.title} />
		</figure>

		<div class="art-door__content">
			<h1 class="art-door__title">{artwork.title}</h1>
			<a class="art-door__artist" href={artistRoute(artwork.artist_username || artwork.artist_id)}
				>{artistName}</a
			>

			{#if ownerPulse}
				<p class="art-door__owner-pulse" role="status">
					{#if ownerPulse.live}<span>Live</span><span aria-hidden="true">·</span>{/if}
					{ownerPulse.scansWeek} scans this week
					<span aria-hidden="true">·</span>
					{ownerPulse.scanCount} all
					<span aria-hidden="true">·</span>
					{ownerPulse.loves} loves
					<span aria-hidden="true">·</span>
					{ownerPulse.buyAsks} buy asks
				</p>
			{/if}

			{#if hasStory}
				<figure class="art-door__story">
					<p class="art-door__story-eyebrow">From the artist</p>
					<blockquote class="art-door__story-body">{artwork.description}</blockquote>
				</figure>
			{/if}

			<dl class="art-door__meta">
				<div>
					<dt>Medium</dt>
					<dd>{artwork.medium ?? 'Unspecified'}</dd>
				</div>
				<div>
					<dt>Dimensions</dt>
					<dd>{dimensions}</dd>
				</div>
				<div>
					<dt>Price</dt>
					<dd class="art-door__price">{price}</dd>
				</div>
			</dl>

			{#if isSold}
				<p class="art-door__sold" role="status">
					Sold through Art Hawks - this work found a home, and still belongs to the story of the
					walls that held it.
				</p>
			{:else if canBuy}
				<section class="art-door__buy" aria-label="Buy this work">
					<p class="art-door__buy-intro">
						Pay securely, then show your pickup code at the venue to take the work home.
						{#if finderVenueId}
							You’re buying from a past hang - if it’s within 30 days and not at another venue,
							that room earns a 5% finder’s thanks.
						{/if}
					</p>
					<button
						type="button"
						class="art-door__buy-btn"
						disabled={buying}
						onclick={buyNow}
					>
						{buying ? 'Opening checkout…' : `Buy for ${price}`}
					</button>
					{#if buyError}
						<p class="art-door__buy-error" role="alert">{buyError}</p>
					{/if}
				</section>
			{/if}

			{#if worksSold > 0}
				<p class="art-door__proof">
					{worksSold}
					{worksSold === 1 ? 'work has' : 'works have'} already found a home through Art Hawks.
				</p>
			{/if}

			{#if showWallQr}
				<section class="art-door__qr-panel" aria-label="Wall QR code">
					<p class="art-door__qr-intro">
						Print this code for the wall. A visitor scans it, meets the work, and finds the person
						behind it.
					</p>
					<ArtworkQr artworkId={artwork.id} size={168} caption="Scan on site" />
					<button type="button" class="art-door__print" onclick={printLabel}>
						Print wall label
					</button>
				</section>
			{/if}

			<section class="art-door__pulse" aria-label="Log interest">
				<p class="art-door__pulse-intro">
					Your scan is already on the pulse. Add a gentle note of interest - or flag the wall if
					something needs care.
				</p>
				<div class="art-door__pulse-actions">
					<button type="button" class="art-door__pulse-btn" onclick={() => markInterest('love')}>
						I love this
					</button>
					<button type="button" class="art-door__pulse-btn" onclick={() => markInterest('buy_ask')}>
						Ask about buying
					</button>
					<button
						type="button"
						class="art-door__pulse-btn art-door__pulse-btn--quiet"
						onclick={() => markCondition('needs_attention')}
					>
						Needs attention
					</button>
				</div>
				{#if pulseNote}
					<p class="art-door__pulse-note" role="status">{pulseNote}</p>
				{/if}
			</section>

			{#if showShare}
				<section class="art-door__share" aria-label="Share this work">
					<p class="art-door__share-intro">
						Loved it? Pass the door along - appreciation travels further than attention.
					</p>
					<ShareActions
						path={artworkRoute(artwork.id)}
						title={artwork.title}
						text={`I opened the door to “${artwork.title}” by ${artistName} on Art Hawks.`}
					/>
				</section>
			{/if}

			<a class="art-door__back" href="/">Back to Art Hawks</a>
		</div>
	</div>
</article>

<style>
	.art-door {
		padding: max(1.75rem, env(safe-area-inset-top)) 1.25rem 3rem;
		color: #1e293b;
	}

	.art-door__inner {
		width: min(100%, 40rem);
		margin: 0 auto;
	}

	.art-door__brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 0.55rem;
	}

	.art-door__brand :global(.art-door__mark) {
		width: 4.5rem;
		height: auto;
	}

	.art-door__eyebrow {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 30pt;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.01em;
		color: var(--color-indigo);
	}

	.art-door__kicker {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.art-door__frame {
		margin: 1.75rem 0 0;
		border: 1px solid rgb(30 41 59 / 0.1);
		overflow: hidden;
		aspect-ratio: 4 / 5;
		background: #1e293b;
	}

	.art-door__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.art-door__content {
		margin-top: 1.75rem;
	}

	.art-door__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.6rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.08;
	}

	.art-door__artist {
		margin: 0.45rem 0 0;
		display: inline-block;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		color: var(--color-burnt, #c2410c);
		text-decoration: none;
	}

	.art-door__artist:hover {
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.art-door__owner-pulse {
		margin: 0.9rem 0 0;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
	}

	.art-door__owner-pulse span:first-child {
		color: var(--color-burnt);
	}

	.art-door__story {
		margin: 1.75rem 0 0;
		padding: 0;
	}

	.art-door__story-eyebrow {
		margin: 0 0 0.55rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.art-door__story-body {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.1rem, 3.5vw, 1.3rem);
		font-style: italic;
		line-height: 1.55;
		color: #1e293b;
	}

	.art-door__meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin: 1.75rem 0 0;
		padding: 1.15rem 0 0;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.art-door__meta dt {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.42);
	}

	.art-door__meta dd {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1rem;
	}

	.art-door__price {
		color: var(--color-burnt);
	}

	.art-door__sold {
		margin: 1.5rem 0 0;
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		line-height: 1.5;
		text-transform: none;
		color: rgb(30 41 59 / 0.68);
	}

	.art-door__proof {
		margin: 1.15rem 0 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.55);
	}

	.art-door__buy {
		margin-top: 1.75rem;
	}

	.art-door__buy-intro {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.68);
	}

	.art-door__buy-btn {
		appearance: none;
		margin-top: 1rem;
		padding: 0.9rem 1.25rem;
		border: none;
		background: var(--color-burnt);
		color: var(--color-cream);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.art-door__buy-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.art-door__buy-error {
		margin: 0.75rem 0 0;
		color: #9a3412;
		font-size: 0.875rem;
	}

	.art-door__qr-panel {
		display: grid;
		justify-items: start;
		gap: 1rem;
		margin-top: 2.25rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.art-door__qr-intro {
		margin: 0;
		max-width: 36ch;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.875rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.art-door__print {
		min-height: 2.65rem;
		padding: 0 1.2rem;
		border: 1px solid rgb(30 41 59 / 0.16);
		background: transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #1e293b;
		cursor: pointer;
	}

	.art-door__pulse {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.art-door__pulse-intro {
		margin: 0;
		max-width: 36ch;
		font-size: 0.9rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.art-door__pulse-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 0.9rem;
	}

	.art-door__pulse-btn {
		appearance: none;
		min-height: 2.5rem;
		padding: 0 0.95rem;
		border: none;
		background: var(--color-indigo);
		color: var(--color-cream);
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.art-door__pulse-btn--quiet {
		background: transparent;
		color: var(--color-indigo);
		border: 1px solid rgb(30 41 59 / 0.18);
	}

	.art-door__pulse-note {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
		color: var(--color-burnt);
	}

	.art-door__share {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.art-door__share-intro {
		margin: 0 0 0.85rem;
		max-width: 34ch;
		font-size: 0.9rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.art-door__back {
		display: inline-block;
		margin-top: 2rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
		text-decoration: none;
	}

	@media (max-width: 520px) {
		.art-door__meta {
			grid-template-columns: 1fr;
		}
	}

	@media print {
		.art-door {
			padding: 0;
			background: white;
		}

		.art-door__kicker,
		.art-door__qr-intro,
		.art-door__print,
		.art-door__back {
			display: none !important;
		}

		.art-door__frame {
			max-height: 55vh;
			aspect-ratio: auto;
		}

		.art-door__qr-panel {
			border: none;
			margin-top: 1.5rem;
			padding-top: 0;
		}
	}
</style>
