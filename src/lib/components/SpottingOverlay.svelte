<script lang="ts">
	import type { ArtworkSpotting } from '$lib/types/swipe';

	interface Props {
		spottings?: ArtworkSpotting[];
	}

	let { spottings = [] }: Props = $props();

	let activeIndex = $state(0);

	const hasSpottings = $derived(spottings.length > 0);
	const activeSpotting = $derived(spottings[activeIndex] ?? null);

	$effect(() => {
		if (spottings.length <= 1) return;

		const timer = window.setInterval(() => {
			activeIndex = (activeIndex + 1) % spottings.length;
		}, 4200);

		return () => window.clearInterval(timer);
	});

	$effect(() => {
		spottings.length;
		activeIndex = 0;
	});
</script>

{#if hasSpottings && activeSpotting}
	<aside class="spotting" aria-label="Recent artwork spotting">
		<div class="spotting-rule" aria-hidden="true"></div>
		<p class="spotting-copy">
			<span class="spotting-kicker">Spotted</span>
			by <strong>@{activeSpotting.username}</strong>
			at <em>{activeSpotting.venue_name}</em>, {activeSpotting.location}
		</p>
		{#if spottings.length > 1}
			<div class="spotting-dots" aria-hidden="true">
				{#each spottings as _, index (index)}
					<span class="spotting-dot" class:spotting-dot--active={index === activeIndex}></span>
				{/each}
			</div>
		{/if}
	</aside>
{/if}

<style>
	.spotting {
		position: absolute;
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		padding: 0.85rem 1rem 0.75rem;
		border: 1px solid rgb(250 249 246 / 0.28);
		background: rgb(30 41 59 / 0.78);
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 24px rgb(30 41 59 / 0.22);
	}

	.spotting-rule {
		width: 2.5rem;
		height: 2px;
		margin-bottom: 0.55rem;
		background: var(--color-burnt);
	}

	.spotting-copy {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.8125rem;
		line-height: 1.5;
		color: rgb(250 249 246 / 0.9);
	}

	.spotting-kicker {
		display: inline-block;
		margin-right: 0.3rem;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.spotting-copy strong {
		font-weight: 600;
		color: #faf9f6;
	}

	.spotting-copy em {
		font-style: normal;
		font-weight: 500;
		color: rgb(250 249 246 / 0.95);
	}

	.spotting-dots {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.65rem;
	}

	.spotting-dot {
		width: 0.35rem;
		height: 0.35rem;
		border-radius: 999px;
		background: rgb(250 249 246 / 0.28);
		transition: background-color 240ms ease, transform 240ms ease;
	}

	.spotting-dot--active {
		background: var(--color-burnt);
		transform: scale(1.15);
	}
</style>
