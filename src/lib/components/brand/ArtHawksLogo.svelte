<script lang="ts">
	interface Props {
		/** `full` = hero size; `nav` = header; `mark` = compact */
		variant?: 'full' | 'nav' | 'mark' | 'compact';
		/** Use dark-background logo artwork */
		onDark?: boolean;
		class?: string;
	}

	let { variant = 'full', onDark = false, class: className = '' }: Props = $props();

	const resolved = $derived(variant === 'compact' ? 'mark' : variant);
	const src = $derived(onDark ? '/arthawks-dark.svg' : '/arthawks-normal.svg');
	const toneClass = $derived(onDark ? 'arthawks-logo--on-dark' : '');
</script>

<img
	{src}
	alt="Art Hawks"
	width="681"
	height="472"
	class="arthawks-logo arthawks-logo--{resolved} {toneClass} {className}"
	decoding="async"
/>

<style>
	.arthawks-logo {
		display: block;
		height: auto;
		flex-shrink: 0;
		object-fit: contain;
	}

	.arthawks-logo--full {
		width: min(100%, 14.5rem);
		margin: 0 auto;
	}

	.arthawks-logo--nav {
		width: 11rem;
	}

	.arthawks-logo--mark {
		width: 6.5rem;
	}

	.arthawks-logo--on-dark.arthawks-logo--nav,
	.arthawks-logo--on-dark.arthawks-logo--mark {
		width: min(100%, 11rem);
	}
</style>
