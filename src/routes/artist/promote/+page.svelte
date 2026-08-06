<script lang="ts">
	import PromoSheet from '$lib/components/promote/PromoSheet.svelte';
	import { ROUTES } from '$lib/constants/routes';
	import { artistVenuePacks, currentUser } from '$lib/stores/network';

	const isArtist = $derived($currentUser.role === 'artist');
	const packData = $derived($artistVenuePacks);
	const hasContent = $derived(packData.packs.length > 0 || packData.unplaced.length > 0);

	function printPack(): void {
		window.print();
	}
</script>

<section class="promote min-h-dvh bg-cream">
	<div class="promote__inner">
		<header class="promote__header no-print">
			<div class="promote__rule" aria-hidden="true"></div>
			<p class="promote__eyebrow">Artist · Promotion pack</p>
			<h1 class="promote__title">Output promotion pack</h1>
			<p class="promote__intro">
				Printable wall sheets - descriptors, story, and QR - grouped by venue so you can walk in
				ready to hang.
			</p>

			{#if isArtist}
				<div class="promote__actions">
					<button type="button" class="btn btn--primary" onclick={printPack} disabled={!hasContent}>
						Print / save as PDF
					</button>
					<a class="btn btn--ghost" href={ROUTES.artist}>Back to studio</a>
				</div>
			{/if}
		</header>

		{#if !isArtist}
			<p class="promote__guard">
				Switch to an artist identity to output your promotion pack.
			</p>
			<a class="promote__back" href={ROUTES.artist}>Back to studio</a>
		{:else if !hasContent}
			<p class="promote__empty">
				Upload works in your studio first - then return here to print packs for each venue.
			</p>
			<a class="promote__back" href={ROUTES.artist}>Back to studio</a>
		{:else}
			<div class="pack-brand print-only" aria-hidden="true">
				<p class="pack-brand__mark">Art Hawks</p>
				<p class="pack-brand__by">{$currentUser.full_name}</p>
			</div>

			{#each packData.packs as pack (pack.venue_id)}
				<section class="venue-block">
					<header class="venue-block__header">
						<p class="venue-block__eyebrow">For the walls at</p>
						<h2 class="venue-block__title">{pack.venue_name}</h2>
						<p class="venue-block__meta">{pack.venue_location}</p>
					</header>

					{#each pack.pieces as piece (piece.artwork.id)}
						<PromoSheet {piece} venueLine={`Display pack · ${pack.venue_name}`} />
					{/each}
				</section>
			{/each}

			{#if packData.unplaced.length > 0}
				<section class="venue-block">
					<header class="venue-block__header">
						<p class="venue-block__eyebrow">Ready for walls</p>
						<h2 class="venue-block__title">Unplaced catalogue</h2>
						<p class="venue-block__meta">
							Take these sheets when you visit a new room in the city.
						</p>
					</header>

					{#each packData.unplaced as piece (piece.artwork.id)}
						<PromoSheet {piece} venueLine="Ready for a venue" />
					{/each}
				</section>
			{/if}
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
		max-width: 40ch;
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

	.venue-block {
		margin-top: 2.75rem;
	}

	.venue-block__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.venue-block__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.65rem;
		font-weight: 500;
	}

	.venue-block__meta {
		margin: 0.4rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.pack-brand {
		display: none;
	}

	.print-only {
		display: none;
	}

	@media print {
		.no-print {
			display: none !important;
		}

		.print-only,
		.pack-brand {
			display: block;
		}

		.promote {
			padding: 0;
			background: white;
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

		.pack-brand__by {
			margin: 0.25rem 0 1rem;
			font-family: var(--font-display, 'Fraunces', Georgia, serif);
			font-size: 1.25rem;
		}

		.venue-block {
			break-before: page;
		}

		.venue-block:first-of-type {
			break-before: auto;
		}
	}
</style>
