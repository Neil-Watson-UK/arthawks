<script lang="ts">
	interface Props {
		variant?: 'venue' | 'verified';
		compact?: boolean;
	}

	let { variant = 'venue', compact = false }: Props = $props();

	const label = $derived(
		variant === 'verified' ? 'Verified Auto Amor Hardware' : 'Auto Amor Plug & Play'
	);
</script>

<p
	class="auto-amor-badge"
	class:auto-amor-badge--compact={compact}
	class:auto-amor-badge--verified={variant === 'verified'}
>
	<span class="auto-amor-badge__mark" aria-hidden="true"></span>
	<span>{label}</span>
</p>

<style>
	.auto-amor-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.auto-amor-badge--compact {
		font-size: 0.5625rem;
		letter-spacing: 0.1em;
	}

	.auto-amor-badge--verified {
		color: var(--color-indigo);
	}

	.auto-amor-badge__mark {
		width: 0.45rem;
		height: 0.45rem;
		background: var(--color-burnt);
		flex-shrink: 0;
	}

	.auto-amor-badge--verified .auto-amor-badge__mark {
		background: var(--color-indigo);
	}
</style>
