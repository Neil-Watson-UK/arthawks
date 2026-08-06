<script lang="ts">
	import AutoAmorBadge from '$lib/components/auto-amor/AutoAmorBadge.svelte';
	import SpottingOverlay from './SpottingOverlay.svelte';
	import type { SwipeCard } from '$lib/types/swipe';
	import { formatDistance } from '$lib/utils/format';

	interface Props {
		card: SwipeCard;
		style?: string;
		isTop?: boolean;
		animating?: boolean;
		acceptOpacity?: number;
		declineOpacity?: number;
		stackDepth?: number;
	}

	let {
		card,
		style = '',
		isTop = false,
		animating = false,
		acceptOpacity = 0,
		declineOpacity = 0,
		stackDepth = 0
	}: Props = $props();

	let imageFailed = $state(false);

	const distanceLabel = $derived(formatDistance(card.distance_meters));
	const hasImageUrl = $derived(Boolean(card.image_url?.trim()));
	const showPlaceholder = $derived(!hasImageUrl || imageFailed);

	function handleImageError(): void {
		imageFailed = true;
	}

	$effect(() => {
		card.image_url;
		imageFailed = false;
	});
</script>

<article
	class="artwork-card"
	class:artwork-card--top={isTop}
	class:artwork-card--animating={animating}
	class:artwork-card--back={!isTop}
	class:artwork-card--accepting={isTop && acceptOpacity > 0.08}
	class:artwork-card--declining={isTop && declineOpacity > 0.08}
	data-depth={stackDepth}
	style="{style}; --accept-tint: {acceptOpacity}; --decline-tint: {declineOpacity};"
	aria-hidden={!isTop}
>
	<div class="card-frame">
		<div class="card-corners" aria-hidden="true">
			<span class="card-corner card-corner--tl"></span>
			<span class="card-corner card-corner--tr"></span>
			<span class="card-corner card-corner--bl"></span>
			<span class="card-corner card-corner--br"></span>
		</div>

		<div class="card-media">
			{#if showPlaceholder}
				<div
					class="card-placeholder"
					role="img"
					aria-label="No preview available for {card.title}"
				>
					<div class="card-placeholder__frame" aria-hidden="true"></div>
					<p class="card-placeholder__label">No Preview Available</p>
				</div>
			{:else}
				<img
					class="card-image"
					src={card.image_url}
					alt=""
					draggable="false"
					loading="lazy"
					onerror={handleImageError}
				/>
			{/if}

			<div class="card-scrim card-scrim--top" aria-hidden="true"></div>
			<div class="card-scrim card-scrim--bottom" aria-hidden="true"></div>

			{#if isTop}
				<div
					class="swipe-tint swipe-tint--accept"
					style:opacity={acceptOpacity}
					aria-hidden="true"
				></div>
				<div
					class="swipe-tint swipe-tint--decline"
					style:opacity={declineOpacity}
					aria-hidden="true"
				></div>
			{/if}
		</div>

		{#if isTop}
			<div
				class="swipe-stamp swipe-stamp--accept"
				style:opacity={acceptOpacity}
				style:transform="scale({0.85 + acceptOpacity * 0.15}) rotate(-12deg)"
				aria-hidden="true"
			>
				<span>Match</span>
			</div>
			<div
				class="swipe-stamp swipe-stamp--decline"
				style:opacity={declineOpacity}
				style:transform="scale({0.85 + declineOpacity * 0.15}) rotate(12deg)"
				aria-hidden="true"
			>
				<span>Pass</span>
			</div>
		{/if}

		<header class="card-header">
			{#if card.is_plug_and_play}
				<div class="card-auto-amor">
					<AutoAmorBadge />
				</div>
			{/if}
			<p class="card-eyebrow">Artwork</p>
			<h2 class="card-title">{card.title}</h2>
			<p class="card-distance">{distanceLabel}</p>
		</header>

		<SpottingOverlay spottings={card.spottings} />
	</div>
</article>

<style>
	.card-auto-amor {
		margin: 0 0 0.45rem;
	}

	.artwork-card {
		position: absolute;
		inset: 0;
		touch-action: none;
		user-select: none;
		will-change: transform;
	}

	.artwork-card--animating.artwork-card--top {
		transition:
			transform 380ms cubic-bezier(0.22, 1, 0.36, 1),
			opacity 260ms ease;
	}

	.artwork-card--back {
		transition:
			transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 300ms ease;
	}

	.card-frame {
		--corner-inset: clamp(0.875rem, 3.2vw, 1.25rem);
		--corner-arm: clamp(0.95rem, 3.4vw, 1.35rem);

		position: relative;
		height: 100%;
		overflow: hidden;
		border: 1px solid rgb(30 41 59 / 0.14);
		background: #1e293b;
		box-shadow:
			0 1px 0 rgb(250 249 246 / 0.6) inset,
			0 20px 48px rgb(30 41 59 / 0.16);
		transition: box-shadow 120ms ease, border-color 120ms ease;
	}

	.artwork-card--accepting .card-frame {
		border-color: rgb(47 125 80 / calc(0.25 + var(--accept-tint) * 0.55));
		box-shadow:
			0 1px 0 rgb(250 249 246 / 0.45) inset,
			0 0 0 1px rgb(47 125 80 / calc(var(--accept-tint) * 0.35)),
			0 18px 42px rgb(47 125 80 / calc(0.08 + var(--accept-tint) * 0.22));
	}

	.artwork-card--declining .card-frame {
		border-color: rgb(185 68 58 / calc(0.25 + var(--decline-tint) * 0.55));
		box-shadow:
			0 1px 0 rgb(250 249 246 / 0.45) inset,
			0 0 0 1px rgb(185 68 58 / calc(var(--decline-tint) * 0.35)),
			0 18px 42px rgb(185 68 58 / calc(0.08 + var(--decline-tint) * 0.22));
	}

	.card-media {
		position: absolute;
		inset: 0;
	}

	.card-corners {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 4;
	}

	.card-corner {
		position: absolute;
		width: var(--corner-arm);
		height: var(--corner-arm);
		border-color: rgb(250 249 246 / 0.5);
		border-style: solid;
	}

	.card-corner--tl {
		top: var(--corner-inset);
		left: var(--corner-inset);
		border-width: 2px 0 0 2px;
	}

	.card-corner--tr {
		top: var(--corner-inset);
		right: var(--corner-inset);
		border-width: 2px 2px 0 0;
	}

	.card-corner--bl {
		bottom: var(--corner-inset);
		left: var(--corner-inset);
		border-width: 0 0 2px 2px;
	}

	.card-corner--br {
		bottom: var(--corner-inset);
		right: var(--corner-inset);
		border-width: 0 2px 2px 0;
	}

	.card-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		display: block;
	}

	.card-placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		background:
			linear-gradient(145deg, rgb(30 41 59 / 0.98) 0%, rgb(30 41 59 / 0.88) 100%),
			repeating-linear-gradient(
				-45deg,
				rgb(250 249 246 / 0.03) 0,
				rgb(250 249 246 / 0.03) 1px,
				transparent 1px,
				transparent 10px
			);
	}

	.card-placeholder__frame {
		position: absolute;
		inset: clamp(1rem, 4vw, 1.75rem);
		border: 1px solid rgb(250 249 246 / 0.12);
		pointer-events: none;
	}

	.card-placeholder__label {
		position: relative;
		z-index: 1;
		margin: 0;
		padding: 0 1.5rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: clamp(0.75rem, 2.8vw, 0.875rem);
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		text-align: center;
		color: rgb(250 249 246 / 0.72);
	}

	.card-scrim {
		position: absolute;
		left: 0;
		right: 0;
		pointer-events: none;
		z-index: 1;
	}

	.card-scrim--top {
		top: 0;
		height: 42%;
		background: linear-gradient(
			180deg,
			rgb(30 41 59 / 0.82) 0%,
			rgb(30 41 59 / 0.52) 38%,
			rgb(30 41 59 / 0.12) 72%,
			transparent 100%
		);
	}

	.card-scrim--bottom {
		bottom: 0;
		height: 48%;
		background: linear-gradient(
			0deg,
			rgb(30 41 59 / 0.88) 0%,
			rgb(30 41 59 / 0.58) 32%,
			rgb(30 41 59 / 0.16) 68%,
			transparent 100%
		);
	}

	.swipe-tint {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
		opacity: 0;
	}

	.swipe-tint--accept {
		background:
			linear-gradient(
				115deg,
				rgb(47 125 80 / 0.58) 0%,
				rgb(47 125 80 / 0.28) 42%,
				rgb(47 125 80 / 0.08) 72%,
				transparent 100%
			),
			radial-gradient(ellipse at 88% 30%, rgb(74 155 105 / 0.42), transparent 62%);
		box-shadow: inset -28px 0 48px rgb(47 125 80 / 0.18);
	}

	.swipe-tint--decline {
		background:
			linear-gradient(
				-115deg,
				rgb(185 68 58 / 0.58) 0%,
				rgb(185 68 58 / 0.28) 42%,
				rgb(185 68 58 / 0.08) 72%,
				transparent 100%
			),
			radial-gradient(ellipse at 12% 30%, rgb(200 90 78 / 0.42), transparent 62%);
		box-shadow: inset 28px 0 48px rgb(185 68 58 / 0.18);
	}

	.card-header {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		padding: clamp(1.15rem, 4vw, 1.45rem) clamp(1.15rem, 4vw, 1.45rem) 0;
		color: #faf9f6;
		z-index: 3;
	}

	.card-eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgb(250 249 246 / 0.88);
		text-shadow: 0 1px 8px rgb(30 41 59 / 0.45);
	}

	.card-title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.55rem, 5.5vw, 2.05rem);
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.025em;
		max-width: 14ch;
		text-shadow:
			0 2px 16px rgb(30 41 59 / 0.55),
			0 1px 3px rgb(30 41 59 / 0.35);
	}

	.card-distance {
		margin: 0.55rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(250 249 246 / 0.92);
		text-shadow: 0 1px 10px rgb(30 41 59 / 0.5);
	}

	.swipe-stamp {
		position: absolute;
		top: 4rem;
		z-index: 5;
		padding: 0.35rem 0.9rem;
		border: 3px solid currentColor;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		pointer-events: none;
		transition:
			opacity 100ms ease-out,
			transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.swipe-stamp span {
		display: block;
	}

	.swipe-stamp--accept {
		left: 1.15rem;
		color: var(--color-burnt);
	}

	.swipe-stamp--accept span {
		transform: rotate(-10deg);
	}

	.swipe-stamp--decline {
		right: 1.15rem;
		color: rgb(250 249 246 / 0.92);
	}

	.swipe-stamp--decline span {
		transform: rotate(10deg);
	}
</style>
