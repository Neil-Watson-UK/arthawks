<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import QRCode from 'qrcode';
	import { artworkPath } from '$lib/data/public-artwork';

	interface Props {
		artworkId: string;
		/** Pixel size of the rendered square */
		size?: number;
		/** Quiet caption under the code */
		caption?: string;
		/** Compact for catalogue rows */
		compact?: boolean;
	}

	let { artworkId, size = 148, caption = 'Scan to meet the work', compact = false }: Props =
		$props();

	let dataUrl = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const absoluteUrl = $derived(
		browser ? new URL(artworkPath(artworkId), $page.url.origin).href : artworkPath(artworkId)
	);

	$effect(() => {
		if (!browser) return;

		const target = absoluteUrl;
		let cancelled = false;

		void QRCode.toDataURL(target, {
			errorCorrectionLevel: 'M',
			margin: 1,
			width: size * 2,
			color: {
				dark: '#1E293B',
				light: '#FAF9F6'
			}
		})
			.then((url) => {
				if (!cancelled) {
					dataUrl = url;
					errorMessage = null;
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					errorMessage = err instanceof Error ? err.message : 'Unable to create QR';
					dataUrl = null;
				}
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<figure class="artwork-qr" class:artwork-qr--compact={compact}>
	{#if dataUrl}
		<img
			class="artwork-qr__image"
			src={dataUrl}
			alt="QR code linking to this artwork"
			width={size}
			height={size}
		/>
	{:else if errorMessage}
		<p class="artwork-qr__error">{errorMessage}</p>
	{:else}
		<div class="artwork-qr__skeleton" style:width="{size}px" style:height="{size}px" aria-hidden="true"></div>
	{/if}

	{#if caption}
		<figcaption class="artwork-qr__caption">{caption}</figcaption>
	{/if}

	<p class="artwork-qr__url">
		<a href={artworkPath(artworkId)}>{artworkPath(artworkId)}</a>
	</p>
</figure>

<style>
	.artwork-qr {
		display: grid;
		justify-items: center;
		gap: 0.55rem;
		margin: 0;
		padding: 0.85rem 0.9rem 0.95rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		background: rgb(251 237 224 / 0.65);
		width: fit-content;
	}

	.artwork-qr--compact {
		padding: 0.55rem 0.6rem 0.65rem;
		gap: 0.35rem;
	}

	.artwork-qr__image {
		display: block;
		image-rendering: pixelated;
	}

	.artwork-qr__skeleton {
		background:
			linear-gradient(135deg, rgb(30 41 59 / 0.06), rgb(30 41 59 / 0.02)),
			repeating-linear-gradient(
				-45deg,
				rgb(30 41 59 / 0.04) 0,
				rgb(30 41 59 / 0.04) 1px,
				transparent 1px,
				transparent 8px
			);
	}

	.artwork-qr__caption {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-align: center;
	}

	.artwork-qr__url {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.6875rem;
		color: rgb(30 41 59 / 0.45);
		text-align: center;
		word-break: break-all;
	}

	.artwork-qr__url a {
		color: inherit;
		text-decoration: none;
	}

	.artwork-qr__url a:hover {
		color: var(--color-burnt);
	}

	.artwork-qr__error {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		color: #b45309;
	}

	@media print {
		.artwork-qr {
			border: none;
			background: transparent;
			padding: 0;
		}

		.artwork-qr__url {
			display: none;
		}
	}
</style>
