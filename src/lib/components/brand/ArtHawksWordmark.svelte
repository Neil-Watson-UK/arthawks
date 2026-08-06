<script lang="ts">
	import { ROUTES } from '$lib/constants/routes';

	let {
		href = ROUTES.home,
		size = 'nav',
		showLink = true
	}: {
		href?: string;
		/** `nav` = compact chrome; `body` = 30pt title-case brand in page text */
		size?: 'nav' | 'body';
		showLink?: boolean;
	} = $props();

	const className = $derived(`wordmark wordmark--${size}`);
</script>

{#if showLink}
	<a class={className} {href} aria-label="Art Hawks home">
		<span class="wordmark__art">Art</span>
		<span class="wordmark__hawks">Hawks</span>
	</a>
{:else}
	<span class={className}>
		<span class="wordmark__art">Art</span>
		<span class="wordmark__hawks">Hawks</span>
	</span>
{/if}

<style>
	.wordmark {
		display: inline-flex;
		align-items: baseline;
		gap: 0.28em;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-weight: 600;
		letter-spacing: 0.01em;
		text-decoration: none;
		color: inherit;
		line-height: 1;
	}

	.wordmark--nav {
		font-size: 1.05rem;
	}

	.wordmark--body {
		font-size: 30pt;
	}

	.wordmark__art {
		color: var(--color-ink, #0e181f);
	}

	.wordmark__hawks {
		color: var(--color-ember, #c9652e);
	}
</style>
