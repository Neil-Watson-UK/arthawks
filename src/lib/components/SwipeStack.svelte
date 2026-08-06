<script lang="ts">
	import ArtworkCard from './ArtworkCard.svelte';
	import ArtworkDetailSheet from './ArtworkDetailSheet.svelte';
	import type { SwipeAction, SwipeCard, SwipeEventDetail } from '$lib/types/swipe';
	import { computeExitVector, hapticSwipe, hapticTap, wait } from '$lib/utils/motion';

	interface Props {
		cards?: SwipeCard[];
		onswipe?: (detail: SwipeEventDetail) => void;
		eyebrow?: string;
		title?: string;
		description?: string;
		emptyTitle?: string;
		emptyCopy?: string;
		acceptLabel?: string;
		children?: import('svelte').Snippet;
	}

	let {
		cards = [],
		onswipe,
		eyebrow = 'Discover',
		title = 'Nearby Works',
		description,
		emptyTitle = 'No more artworks in this stack',
		emptyCopy = 'Check back soon - artists near you are always adding new work.',
		acceptLabel = 'Match',
		children
	}: Props = $props();

	const SWIPE_THRESHOLD = 88;
	const VELOCITY_THRESHOLD = 0.45;

	let currentIndex = $state(0);
	let dragX = $state(0);
	let dragY = $state(0);
	let isDragging = $state(false);
	let isAnimating = $state(false);
	let pointerId = $state<number | null>(null);
	let startX = $state(0);
	let startY = $state(0);
	let lastMoveX = $state(0);
	let lastMoveTime = $state(0);
	let velocityX = $state(0);
	let exitRotation = $state(0);

	let activeCard = $derived(cards[currentIndex] ?? null);
	let stackCards = $derived(cards.slice(currentIndex, currentIndex + 3));
	let isEmpty = $derived(currentIndex >= cards.length);
	let remainingCount = $derived(Math.max(cards.length - currentIndex, 0));

	let dragRotation = $derived(dragX * 0.055 + exitRotation);
	/* Ramp tint earlier so hue feedback reads before the commit threshold */
	let acceptOpacity = $derived(Math.min(Math.max(dragX / 72, 0), 1));
	let declineOpacity = $derived(Math.min(Math.max(-dragX / 72, 0), 1));

	let topCardTransform = $derived(
		`translate3d(${dragX}px, ${dragY * 0.12}px, 0) rotate(${dragRotation}deg)`
	);

	function getStackStyle(depth: number): string {
		const scale = depth === 1 ? 0.96 : 0.915;
		const translateY = depth === 1 ? 12 : 24;
		const opacity = depth === 1 ? 0.9 : 0.74;

		return `transform: translate3d(0, ${translateY}px, 0) scale(${scale}); opacity: ${opacity};`;
	}

	function resetDragState(): void {
		dragX = 0;
		dragY = 0;
		exitRotation = 0;
		isDragging = false;
		isAnimating = false;
		pointerId = null;
		velocityX = 0;
	}

	function handlePointerDown(event: PointerEvent): void {
		if (!activeCard || isAnimating) return;

		isDragging = true;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		lastMoveX = event.clientX;
		lastMoveTime = performance.now();
		velocityX = 0;
		exitRotation = 0;
		hapticTap();

		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!isDragging || pointerId !== event.pointerId || isAnimating) return;

		const now = performance.now();
		const deltaTime = now - lastMoveTime;

		if (deltaTime > 0) {
			velocityX = (event.clientX - lastMoveX) / deltaTime;
		}

		lastMoveX = event.clientX;
		lastMoveTime = now;
		dragX = event.clientX - startX;
		dragY = event.clientY - startY;
	}

	function shouldCommitSwipe(): SwipeAction | null {
		if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
			return dragX > 0 ? 'right' : 'left';
		}

		if (Math.abs(velocityX) >= VELOCITY_THRESHOLD) {
			return velocityX > 0 ? 'right' : 'left';
		}

		return null;
	}

	async function commitSwipe(direction: SwipeAction): Promise<void> {
		if (!activeCard || isAnimating) return;

		isAnimating = true;
		isDragging = false;

		const exit = computeExitVector(direction, velocityX);
		dragX = exit.x;
		dragY = exit.y;
		exitRotation = exit.rotation;

		hapticSwipe(direction);
		await wait(380);

		onswipe?.({ card: activeCard, direction });
		currentIndex += 1;
		resetDragState();
	}

	async function springBack(): Promise<void> {
		isAnimating = true;
		isDragging = false;
		dragX = 0;
		dragY = 0;
		exitRotation = 0;
		await wait(420);
		resetDragState();
	}

	async function handlePointerUp(event: PointerEvent): Promise<void> {
		if (!isDragging || pointerId !== event.pointerId || isAnimating) return;

		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);

		const direction = shouldCommitSwipe();
		if (direction) {
			await commitSwipe(direction);
			return;
		}

		await springBack();
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!activeCard || isAnimating) return;

		if (event.key === 'ArrowRight') {
			event.preventDefault();
			void commitSwipe('right');
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			void commitSwipe('left');
		}
	}

	$effect(() => {
		if (currentIndex > cards.length) {
			currentIndex = cards.length;
		}
	});

	/*
	 * When the parent removes a matched card from the queue, compensate for the
	 * index increment that already happened during commitSwipe.
	 */
	let previousCardCount = $state(cards.length);

	$effect(() => {
		if (cards.length < previousCardCount && currentIndex > 0) {
			currentIndex -= 1;
		}

		previousCardCount = cards.length;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="swipe-stack" aria-label="Artwork discovery stack">
	<header class="stack-header">
		<div class="stack-header__rule" aria-hidden="true"></div>
		<p class="stack-eyebrow">{eyebrow}</p>
		<h1 class="stack-title">{title}</h1>
		{#if description}
			<p class="stack-description">{description}</p>
		{/if}
		<p class="stack-meta">
			<span class="stack-meta__count">{remainingCount}</span> remaining
		</p>
	</header>

	<div class="stack-stage">
		{#if isEmpty}
			<div class="empty-state">
				<div class="empty-state__frame" aria-hidden="true"></div>
				<p class="empty-eyebrow">All caught up</p>
				<h2 class="empty-title">{emptyTitle}</h2>
				<p class="empty-copy">{emptyCopy}</p>
			</div>
		{:else}
			<div
				class="card-stack"
				role="group"
				aria-label="Swipeable artwork cards"
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				onpointercancel={handlePointerUp}
			>
				{#each stackCards as card, index (card.id)}
					{@const depth = index}
					{@const isTop = depth === 0}
					{@const zIndex = stackCards.length - index}
					<ArtworkCard
						{card}
						{isTop}
						stackDepth={depth}
						animating={isAnimating}
						acceptOpacity={isTop ? acceptOpacity : 0}
						declineOpacity={isTop ? declineOpacity : 0}
						style={isTop
							? `transform: ${topCardTransform}; z-index: ${zIndex};`
							: `${getStackStyle(depth)} z-index: ${zIndex};`}
					/>
				{/each}
			</div>

			{#if activeCard}
				<ArtworkDetailSheet card={activeCard} visible={!isAnimating} />
			{/if}
		{/if}
	</div>

	{#if !isEmpty}
		<nav class="action-bar" aria-label="Swipe actions">
			<button
				type="button"
				class="action-button action-button--decline"
				aria-label="Pass artwork"
				disabled={isAnimating}
				onclick={() => commitSwipe('left')}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="action-icon">
					<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.25" />
				</svg>
				<span>Pass</span>
			</button>

			<button
				type="button"
				class="action-button action-button--accept"
				aria-label={acceptLabel}
				disabled={isAnimating}
				onclick={() => commitSwipe('right')}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true" class="action-icon">
					<path
						d="M12 20.5s-6.5-4.2-6.5-9.2C5.5 8.1 8.1 5.5 12 5.5s6.5 2.6 6.5 5.8c0 5-6.5 9.2-6.5 9.2z"
						fill="currentColor"
					/>
				</svg>
				<span>{acceptLabel}</span>
			</button>
		</nav>
	{/if}

	{#if children}
		<div class="stack-footer">
			{@render children()}
		</div>
	{/if}
</section>

<style>
	.swipe-stack {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		padding: max(1.25rem, env(safe-area-inset-top)) 1rem max(1.5rem, env(safe-area-inset-bottom));
		background: var(--color-cream);
		color: #1e293b;
	}

	.stack-header {
		margin-bottom: 1.1rem;
		padding: 0 0.35rem;
	}

	.stack-header__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.85rem;
		background: var(--color-burnt);
	}

	.stack-eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.stack-title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 7vw, 2.5rem);
		font-weight: 500;
		line-height: 1.02;
		letter-spacing: -0.035em;
	}

	.stack-description {
		margin: 0.75rem 0 0;
		max-width: 36ch;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.72);
	}

	.stack-meta {
		margin: 0.5rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.52);
	}

	.stack-meta__count {
		font-weight: 600;
		color: #1e293b;
	}

	.stack-stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		max-width: 28rem;
		width: 100%;
		margin: 0 auto;
	}

	.card-stack {
		position: relative;
		width: min(100%, 22rem, calc(min(72dvh, 36rem) * 4 / 5));
		aspect-ratio: 4 / 5;
		margin-inline: auto;
		cursor: grab;
		touch-action: none;
	}

	.card-stack:active {
		cursor: grabbing;
	}

	.empty-state {
		position: relative;
		display: grid;
		place-content: center;
		min-height: 22rem;
		padding: 2.5rem 1.25rem;
		text-align: center;
		border: 1px dashed rgb(30 41 59 / 0.14);
		background: rgb(251 237 224 / 0.65);
	}

	.empty-state__frame {
		position: absolute;
		inset: 1rem;
		border: 1px solid rgb(30 41 59 / 0.06);
		pointer-events: none;
	}

	.empty-eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.empty-title {
		margin: 0.85rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.75rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.empty-copy {
		margin: 0.85rem auto 0;
		max-width: 19rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.6);
	}

	.action-bar {
		display: flex;
		justify-content: center;
		gap: 1.75rem;
		max-width: 28rem;
		width: 100%;
		margin: 1.5rem auto 0;
		padding: 0 0.35rem;
	}

	.stack-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		max-width: 28rem;
		margin: 1.15rem auto 0;
		padding: 0 0.35rem 0.35rem;
	}

	.action-button {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.3rem;
		width: 5rem;
		height: 5rem;
		padding: 0;
		border-radius: 999px;
		border: 2px solid rgb(30 41 59 / 0.16);
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		transition:
			transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
			background-color 180ms ease,
			border-color 180ms ease,
			box-shadow 180ms ease;
	}

	.action-button:active:not(:disabled) {
		transform: scale(0.92);
	}

	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-icon {
		display: block;
		width: 1.4rem;
		height: 1.4rem;
		flex-shrink: 0;
	}

	.action-button span {
		display: block;
		line-height: 1;
	}

	.action-button--decline {
		background: rgb(30 41 59 / 0.06);
		color: #1e293b;
		border-color: rgb(30 41 59 / 0.22);
		box-shadow:
			0 4px 14px rgb(30 41 59 / 0.08),
			inset 0 1px 0 rgb(251 237 224 / 0.65);
	}

	.action-button--decline:hover:not(:disabled) {
		border-color: rgb(30 41 59 / 0.32);
		background: rgb(30 41 59 / 0.1);
		box-shadow:
			0 6px 18px rgb(30 41 59 / 0.12),
			inset 0 1px 0 rgb(251 237 224 / 0.65);
	}

	.action-button--accept {
		border-color: var(--color-burnt);
		background: var(--color-burnt);
		color: var(--color-cream);
		box-shadow: 0 10px 28px rgb(180 83 42 / 0.28);
	}

	.action-button--accept:hover:not(:disabled) {
		background: #9a4524;
		border-color: #9a4524;
	}

	.action-button--accept .action-icon {
		width: 1.45rem;
		height: 1.45rem;
	}

	@media (min-width: 768px) {
		.swipe-stack {
			padding-inline: 1.75rem;
		}

		.stack-stage {
			max-width: 32rem;
		}

		.card-stack {
			width: min(100%, 24rem, calc(min(74dvh, 38rem) * 4 / 5));
		}

		.action-button {
			width: 5.25rem;
			height: 5.25rem;
		}
	}
</style>
