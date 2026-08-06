<script lang="ts">
	import type { SwipeCard } from '$lib/types/swipe';
	import { formatArtistName, formatDimensions, formatPrice } from '$lib/utils/format';

	interface Props {
		card: SwipeCard;
		visible?: boolean;
	}

	let { card, visible = true }: Props = $props();

	const artistName = $derived(formatArtistName(card.artist_full_name, card.artist_username));
	const dimensions = $derived(formatDimensions(card.height_cm, card.width_cm));
	const price = $derived(formatPrice(card.price));
	const hasStory = $derived(Boolean(card.description?.trim()));
</script>

<section class="detail-sheet" class:detail-sheet--visible={visible} aria-label="Artwork details">
	<div class="detail-rule" aria-hidden="true"></div>

	{#if hasStory}
		<figure class="story">
			<p class="story__eyebrow">From the artist</p>
			<blockquote class="story__body">{card.description}</blockquote>
			<figcaption class="story__byline">- {artistName}</figcaption>
		</figure>
	{/if}

	<div class="detail-grid">
		<div class="detail-item">
			<span class="detail-label">Artist</span>
			<span class="detail-value">{artistName}</span>
		</div>

		<div class="detail-item">
			<span class="detail-label">Medium</span>
			<span class="detail-value">{card.medium ?? 'Unspecified'}</span>
		</div>

		<div class="detail-item">
			<span class="detail-label">Dimensions</span>
			<span class="detail-value">{dimensions}</span>
		</div>

		<div class="detail-item detail-item--price">
			<span class="detail-label">Price</span>
			<span class="detail-value detail-value--price">{price}</span>
		</div>
	</div>
</section>

<style>
	.detail-sheet {
		margin-top: 1.35rem;
		padding: 0 0.35rem 0.25rem;
		opacity: 0;
		transform: translateY(10px);
		transition:
			opacity 320ms ease,
			transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.detail-sheet--visible {
		opacity: 1;
		transform: translateY(0);
	}

	.detail-rule {
		width: 100%;
		height: 1px;
		margin-bottom: 1.15rem;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgb(30 41 59 / 0.14) 12%,
			rgb(30 41 59 / 0.14) 88%,
			transparent 100%
		);
	}

	.story {
		margin: 0 0 1.35rem;
		padding: 0;
	}

	.story__eyebrow {
		margin: 0 0 0.55rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.story__body {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.05rem, 3.4vw, 1.2rem);
		font-weight: 400;
		font-style: italic;
		line-height: 1.55;
		letter-spacing: -0.01em;
		color: #1e293b;
		quotes: none;
	}

	.story__byline {
		margin: 0.7rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		color: rgb(30 41 59 / 0.5);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.1rem 1.75rem;
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.detail-item--price {
		grid-column: 1 / -1;
		padding-top: 0.35rem;
		border-top: 1px solid rgb(30 41 59 / 0.06);
	}

	.detail-label {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.42);
	}

	.detail-value {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
		line-height: 1.35;
		color: #1e293b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail-value--price {
		font-size: 1.5rem;
		font-weight: 500;
		letter-spacing: -0.02em;
		color: var(--color-burnt);
	}

	@media (min-width: 480px) {
		.detail-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.detail-item--price {
			grid-column: auto;
			padding-top: 0;
			border-top: none;
		}
	}
</style>
