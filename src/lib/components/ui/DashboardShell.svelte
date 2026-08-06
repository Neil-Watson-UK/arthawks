<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		eyebrow: string;
		title: string;
		children?: Snippet;
	}

	let { eyebrow, title, children }: Props = $props();
</script>

<section class="dashboard min-h-dvh bg-cream">
	<div class="dashboard__inner">
		<div class="dashboard__rule" aria-hidden="true"></div>
		<p class="dashboard__eyebrow">{eyebrow}</p>
		<h1 class="dashboard__title">{title}</h1>
		{#if children}
			<div class="dashboard__body">
				{@render children()}
			</div>
		{/if}
	</div>
</section>

<style>
	.dashboard {
		display: grid;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 2rem;
		color: #1e293b;
	}

	.dashboard__inner {
		width: min(100%, 34rem);
		margin: 0 auto;
		align-self: center;
	}

	.dashboard__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.dashboard__eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.dashboard__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.03em;
	}

	.dashboard__body {
		margin-top: 1rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}
</style>
