<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';

	interface Props {
		/** Absolute or site-relative path to share */
		path: string;
		title: string;
		text?: string;
		primaryLabel?: string;
		class?: string;
	}

	let {
		path,
		title,
		text = '',
		primaryLabel = 'Share this work',
		class: className = ''
	}: Props = $props();

	let copied = $state(false);
	let status = $state<string | null>(null);

	const absoluteUrl = $derived(
		browser ? new URL(path, $page.url.origin).href : path
	);

	const shareBody = $derived(
		text.trim() || `I opened the door to “${title}” on Art Hawks.`
	);

	async function shareNative(): Promise<void> {
		if (!browser) return;

		if (navigator.share) {
			try {
				await navigator.share({
					title: `${title} · Art Hawks`,
					text: shareBody,
					url: absoluteUrl
				});
				status = null;
				return;
			} catch (err) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
			}
		}

		await copyLink();
	}

	async function copyLink(): Promise<void> {
		if (!browser) return;

		try {
			await navigator.clipboard.writeText(absoluteUrl);
			copied = true;
			status = 'Link copied';
			window.setTimeout(() => {
				copied = false;
				status = null;
			}, 2000);
		} catch {
			status = 'Could not copy link';
		}
	}
</script>

<div class="share {className}">
	<button type="button" class="share__btn" onclick={shareNative}>
		{primaryLabel}
	</button>
	<button type="button" class="share__btn share__btn--quiet" onclick={copyLink}>
		{copied ? 'Copied' : 'Copy link'}
	</button>
	{#if status}
		<p class="share__status" role="status">{status}</p>
	{/if}
</div>

<style>
	.share {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem 1rem;
	}

	.share__btn {
		padding: 0;
		border: none;
		background: transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-burnt);
		cursor: pointer;
	}

	.share__btn--quiet {
		color: rgb(30 41 59 / 0.45);
	}

	.share__btn:hover {
		color: var(--color-indigo);
	}

	.share__status {
		margin: 0;
		width: 100%;
		font-size: 0.75rem;
		color: rgb(30 41 59 / 0.5);
	}
</style>
