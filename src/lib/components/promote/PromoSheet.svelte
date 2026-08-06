<script lang="ts">
	import ArtworkQr from '$lib/components/qr/ArtworkQr.svelte';
	import type { PromotionPiece } from '$lib/stores/network';
	import { formatArtistName, formatDimensions, formatPrice } from '$lib/utils/format';
	import { artworkImageUrl } from '$lib/data/mock-artists';

	interface Props {
		piece: PromotionPiece;
		/** Show artist bio block (venue packs) */
		showArtist?: boolean;
		/** Show venue line (artist packs) */
		venueLine?: string | null;
	}

	let { piece, showArtist = false, venueLine = null }: Props = $props();

	const imageSrc = $derived(
		piece.artwork.image_url ?? artworkImageUrl(piece.artwork.image_filename)
	);
	const dims = $derived(
		formatDimensions(piece.artwork.height_cm, piece.artwork.width_cm)
	);
</script>

<article class="sheet">
	<div class="sheet__visual">
		<img class="sheet__image" src={imageSrc} alt={piece.artwork.title} />
	</div>

	<div class="sheet__copy">
		{#if venueLine}
			<p class="sheet__eyebrow">{venueLine}</p>
		{/if}

		<h3 class="sheet__title">{piece.artwork.title}</h3>
		<p class="sheet__artist">
			{formatArtistName(piece.artist.full_name, piece.artist.username)}
		</p>

		{#if piece.artwork.description}
			<p class="sheet__story">{piece.artwork.description}</p>
		{/if}

		<dl class="sheet__meta">
			<div>
				<dt>Medium</dt>
				<dd>{piece.artwork.medium || '-'}</dd>
			</div>
			<div>
				<dt>Size</dt>
				<dd>{dims}</dd>
			</div>
			<div>
				<dt>Price</dt>
				<dd>{formatPrice(piece.artwork.price)}</dd>
			</div>
		</dl>

		{#if showArtist && piece.artist.bio}
			<figure class="sheet__bio">
				<p class="sheet__bio-eyebrow">The artist</p>
				<blockquote>{piece.artist.bio}</blockquote>
				{#if piece.artist.instagram || piece.artist.website}
					<p class="sheet__bio-links">
						{#if piece.artist.instagram}
							<span>{piece.artist.instagram}</span>
						{/if}
						{#if piece.artist.website}
							<span>{piece.artist.website}</span>
						{/if}
					</p>
				{/if}
			</figure>
		{/if}
	</div>

	<div class="sheet__qr">
		<ArtworkQr artworkId={piece.artwork.id} size={132} caption="Scan to open the door" />
	</div>
</article>

<style>
	.sheet {
		display: grid;
		gap: 1.25rem;
		padding: 1.5rem 0;
		border-bottom: 1px solid rgb(30 41 59 / 0.1);
		break-inside: avoid;
		page-break-inside: avoid;
	}

	@media (min-width: 720px) {
		.sheet {
			grid-template-columns: 10rem 1fr 9rem;
			align-items: start;
			gap: 1.5rem;
		}
	}

	.sheet__visual {
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--color-indigo);
	}

	.sheet__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.sheet__eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.sheet__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.35rem;
		font-weight: 500;
	}

	.sheet__artist {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.sheet__story {
		margin: 0.75rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 0.95rem;
		font-style: italic;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.72);
	}

	.sheet__meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0 0;
	}

	.sheet__meta dt {
		margin: 0;
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.42);
	}

	.sheet__meta dd {
		margin: 0.25rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 0.9rem;
	}

	.sheet__bio {
		margin: 1.1rem 0 0;
		padding: 0;
	}

	.sheet__bio-eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.sheet__bio blockquote {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.7);
	}

	.sheet__bio-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		color: rgb(30 41 59 / 0.5);
	}

	.sheet__qr {
		justify-self: start;
	}

	@media print {
		.sheet {
			padding: 0.85rem 0;
		}

		.sheet__visual {
			max-height: 11rem;
		}
	}
</style>
