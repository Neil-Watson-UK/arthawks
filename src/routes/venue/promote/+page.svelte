<script lang="ts">
	import PromoSheet from '$lib/components/promote/PromoSheet.svelte';
	import { ROUTES } from '$lib/constants/routes';
	import { currentUser, venuePromotionPack } from '$lib/stores/network';
	import type { SimulatedVenueProfile } from '$lib/data/simulated-users';

	const isVenue = $derived($currentUser.role === 'venue');
	const venue = $derived(isVenue ? ($currentUser as SimulatedVenueProfile) : null);
	const pieces = $derived($venuePromotionPack);

	function printPack(): void {
		window.print();
	}
</script>

<section class="promote min-h-dvh bg-cream">
	<div class="promote__inner">
		<header class="promote__header no-print">
			<div class="promote__rule" aria-hidden="true"></div>
			<p class="promote__eyebrow">Venue · Promotion pack</p>
			<h1 class="promote__title">Output promotion pack</h1>
			<p class="promote__intro">
				Wall labels with QR codes, artwork stories, and artist profiles - ready to print for your
				space and share with guests.
			</p>

			{#if isVenue}
				<div class="promote__actions">
					<button
						type="button"
						class="btn btn--primary"
						onclick={printPack}
						disabled={pieces.length === 0}
					>
						Print / save as PDF
					</button>
					<a class="btn btn--ghost" href={ROUTES.venue}>Back to venue hub</a>
				</div>
			{/if}
		</header>

		{#if !isVenue}
			<p class="promote__guard">
				Switch to a venue identity to output a promotion pack for your walls.
			</p>
			<a class="promote__back" href={ROUTES.venue}>Back to venue hub</a>
		{:else if pieces.length === 0}
			<p class="promote__empty">
				Show interest in works via self-curation or Curate for Me - then return here to print your
				pack.
			</p>
			<a class="promote__back" href={ROUTES.venue}>Back to venue hub</a>
		{:else}
			<div class="pack-brand">
				<p class="pack-brand__mark">Art Hawks · Room of the city</p>
				<h2 class="pack-brand__title">{venue?.full_name}</h2>
				{#if venue?.bio}
					<p class="pack-brand__bio">{venue.bio}</p>
				{/if}
				{#if venue?.location}
					<p class="pack-brand__meta">{venue.location}</p>
				{/if}
				{#if venue?.instagram || venue?.website}
					<p class="pack-brand__links">
						{#if venue.instagram}<span>{venue.instagram}</span>{/if}
						{#if venue.website}<span>{venue.website}</span>{/if}
					</p>
				{/if}
			</div>

			<section class="pieces" aria-label="Works for your walls">
				{#each pieces as piece (piece.artwork.id)}
					<PromoSheet {piece} showArtist={true} venueLine="On the walls here" />
				{/each}
			</section>
		{/if}
	</div>
</section>

<style>
	.promote {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
		color: var(--color-indigo);
	}

	.promote__inner {
		width: min(100%, 48rem);
		margin: 0 auto;
	}

	.promote__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.promote__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.promote__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.promote__intro,
	.promote__guard,
	.promote__empty {
		margin: 1rem 0 0;
		max-width: 42ch;
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.promote__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1.5rem;
	}

	.promote__back {
		display: inline-block;
		margin-top: 1.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1.2rem;
		border: 1px solid transparent;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn--primary {
		background: var(--color-burnt);
		border-color: var(--color-burnt);
		color: var(--color-cream);
	}

	.btn--ghost {
		background: transparent;
		color: rgb(30 41 59 / 0.55);
	}

	.pack-brand {
		margin-top: 2rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.1);
	}

	.pack-brand__mark {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 30pt;
		font-weight: 600;
		letter-spacing: 0.01em;
		text-transform: none;
		line-height: 1;
		color: var(--color-indigo);
	}

	.pack-brand__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.85rem;
		font-weight: 500;
	}

	.pack-brand__bio {
		margin: 0.75rem 0 0;
		max-width: 40ch;
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.68);
	}

	.pack-brand__meta,
	.pack-brand__links {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: rgb(30 41 59 / 0.5);
	}

	.pack-brand__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	@media print {
		.no-print {
			display: none !important;
		}

		.promote {
			padding: 0;
			background: white;
		}
	}
</style>
