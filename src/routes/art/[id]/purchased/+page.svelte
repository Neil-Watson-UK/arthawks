<script lang="ts">
	import { page } from '$app/stores';
	import UrlQr from '$lib/components/qr/UrlQr.svelte';
	import ShareActions from '$lib/components/share/ShareActions.svelte';
	import { artworkRoute, ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	const purchase = $derived(data.purchase);
	const artwork = $derived(data.artwork);
	const worksSold = $derived($page.data.worksSold ?? 0);
	const verifyHref = $derived(
		purchase.verify_path ? new URL(purchase.verify_path, $page.url.origin).href : null
	);
</script>

<svelte:head>
	<title>Thank you · {artwork.title}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="bought min-h-dvh">
	<div class="bought__inner">
		<p class="bought__eyebrow">A work found its person</p>
		<h1 class="bought__title">Thank you</h1>
		<p class="bought__lede">
			You've brought <strong>{artwork.title}</strong> by {artwork.artist_name} into your life.
			That matters - to the artist who made it, to the room that held it, and to the city that
			let you meet it.
		</p>

		{#if artwork.image_url}
			<img class="bought__thumb" src={artwork.image_url} alt="" />
		{/if}

		{#if worksSold > 0}
			<p class="bought__proof">
				You're part of
				<strong
					>{worksSold}
					{worksSold === 1 ? 'work' : 'works'} sold through Art Hawks</strong
				>
				- original art leaving walls for homes, one door at a time.
			</p>
		{/if}

		<section class="bought__share" aria-label="Share your purchase">
			<p class="bought__share-intro">
				If it feels right, tell someone. A shared door is how the next work finds its person.
			</p>
			<ShareActions
				path={artworkRoute(artwork.id)}
				title={artwork.title}
				text={`I just brought home “${artwork.title}” by ${artwork.artist_name} through Art Hawks.`}
				primaryLabel="Share your find"
			/>
		</section>

		<section class="bought__collect" aria-label="Pickup">
			<p class="bought__collect-eyebrow">When you're ready to collect</p>
			<h2 class="bought__collect-title">Show this to the venue</h2>
			<p class="bought__collect-lede">
				{#if data.venue_name}
					Collect from <strong>{data.venue_name}</strong>. Staff can scan the QR to confirm
					payment - no login needed.
				{:else}
					Staff can scan the QR to confirm payment - no login needed.
				{/if}
			</p>

			{#if verifyHref}
				<UrlQr href={verifyHref} size={168} caption="Scan to verify payment" />
				<p class="bought__verify-link">
					<a href={purchase.verify_path}>Open verify page</a>
				</p>
			{/if}

			<p class="bought__code-label">Backup code for the venue owner</p>
			<p class="bought__code" aria-label="Pickup code">{purchase.pickup_code}</p>
			<p class="bought__meta">
				{purchase.amount_label}
				{#if purchase.buyer_email}
					<span aria-hidden="true">·</span>
					Receipt to {purchase.buyer_email}
				{/if}
			</p>
			{#if purchase.code_expires_at}
				<p class="bought__expiry">
					Valid until
					{new Intl.DateTimeFormat('en-GB', {
						day: 'numeric',
						month: 'short',
						year: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					}).format(new Date(purchase.code_expires_at))}
				</p>
			{/if}

			<p class="bought__hint">
				Keep this screen or the email. Staff verify with the QR; the venue owner later confirms
				collection in Art Hawks to close the handover.
			</p>
		</section>

		<nav class="bought__nav">
			<a href={artworkRoute(artwork.id)}>Back to the door</a>
			<a href={ROUTES.map}>City map</a>
			<a href={ROUTES.discover}>Discover more</a>
		</nav>
	</div>
</article>

<style>
	.bought {
		background:
			radial-gradient(ellipse 55% 40% at 80% 0%, rgb(201 101 46 / 0.16), transparent 55%),
			radial-gradient(ellipse 45% 35% at 10% 90%, rgb(74 92 74 / 0.1), transparent 50%),
			var(--color-wall);
		color: var(--color-ink);
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3.5rem;
	}

	.bought__inner {
		width: min(100%, 28rem);
		margin: 0 auto;
		text-align: center;
	}

	.bought__eyebrow,
	.bought__collect-eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-ember);
	}

	.bought__title {
		margin: 0.55rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 8vw, 3.1rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.bought__lede {
		margin: 1rem 0 0;
		line-height: 1.6;
		color: rgb(14 24 31 / 0.78);
	}

	.bought__thumb {
		display: block;
		width: min(100%, 14rem);
		aspect-ratio: 4 / 5;
		object-fit: cover;
		margin: 1.75rem auto 0;
		background: var(--color-ink);
		animation: bought-in 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.bought__proof {
		margin: 1.5rem 0 0;
		padding: 0.95rem 1rem;
		border: 1px solid rgb(201 101 46 / 0.22);
		background: rgb(255 247 237 / 0.65);
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.72);
	}

	.bought__share {
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgb(14 24 31 / 0.08);
	}

	.bought__share-intro {
		margin: 0 0 0.85rem;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.62);
	}

	.bought__collect {
		margin-top: 2rem;
		padding: 1.35rem 1.1rem 1.5rem;
		border: 1px solid rgb(14 24 31 / 0.1);
		background: rgb(250 249 246 / 0.72);
		text-align: center;
	}

	.bought__collect-title {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 4vw, 1.7rem);
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.bought__collect-lede {
		margin: 0.65rem 0 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.65);
	}

	.bought__verify-link {
		margin: 0.65rem 0 0;
		font-size: 0.8rem;
	}

	.bought__verify-link a {
		color: var(--color-ember);
		text-decoration: none;
		font-weight: 600;
	}

	.bought__code-label {
		margin: 1.35rem 0 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.45);
	}

	.bought__code {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 9vw, 2.75rem);
		font-weight: 500;
		letter-spacing: 0.28em;
		line-height: 1;
		color: var(--color-ink);
	}

	.bought__meta,
	.bought__expiry,
	.bought__hint {
		margin: 0.85rem 0 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.55);
	}

	.bought__hint {
		margin-top: 1.15rem;
		max-width: 36ch;
		margin-inline: auto;
	}

	.bought__nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.25rem;
		margin-top: 2rem;
	}

	.bought__nav a {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-ember);
		text-decoration: none;
	}

	@keyframes bought-in {
		from {
			opacity: 0;
			transform: translateY(0.6rem) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
