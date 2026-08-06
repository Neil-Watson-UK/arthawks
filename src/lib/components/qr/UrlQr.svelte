<script lang="ts">
	import { browser } from '$app/environment';
	import QRCode from 'qrcode';

	interface Props {
		href: string;
		size?: number;
		caption?: string;
		alt?: string;
	}

	let {
		href,
		size = 168,
		caption = 'Show this to venue staff',
		alt = 'QR code for pickup verification'
	}: Props = $props();

	let dataUrl = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		if (!browser || !href) return;
		const target = href;
		let cancelled = false;
		void QRCode.toDataURL(target, {
			errorCorrectionLevel: 'M',
			margin: 1,
			width: size * 2,
			color: { dark: '#0e181f', light: '#faf9f6' }
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

<figure class="url-qr">
	{#if dataUrl}
		<img class="url-qr__image" src={dataUrl} {alt} width={size} height={size} />
	{:else if errorMessage}
		<p class="url-qr__error">{errorMessage}</p>
	{:else}
		<div class="url-qr__skeleton" style:width="{size}px" style:height="{size}px" aria-hidden="true"></div>
	{/if}
	{#if caption}
		<figcaption class="url-qr__caption">{caption}</figcaption>
	{/if}
</figure>

<style>
	.url-qr {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		margin: 1.25rem auto 0;
		padding: 0;
	}

	.url-qr__image {
		display: block;
		image-rendering: pixelated;
		border: 1px solid rgb(14 24 31 / 0.1);
		background: #faf9f6;
	}

	.url-qr__skeleton {
		background: rgb(14 24 31 / 0.06);
	}

	.url-qr__caption {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.5);
	}

	.url-qr__error {
		margin: 0;
		font-size: 0.75rem;
		color: #b45309;
	}
</style>
