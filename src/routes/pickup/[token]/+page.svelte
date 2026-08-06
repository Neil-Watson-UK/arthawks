<script lang="ts">
	import { ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	const state = $derived(data.state);
</script>

<svelte:head>
	<title>Pickup verify · Art Hawks</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<article class="verify min-h-dvh">
	<div class="verify__inner">
		<p class="verify__eyebrow">Art Hawks · Pickup check</p>

		{#if state === 'paid'}
			<p class="verify__badge verify__badge--ok">Paid - ready to release</p>
			<h1 class="verify__title">This piece is paid for</h1>
			<p class="verify__lede">
				Staff can comfortably hand the work to the buyer. No Art Hawks login needed for this
				check.
			</p>
		{:else if state === 'collected'}
			<p class="verify__badge">Already collected</p>
			<h1 class="verify__title">This pickup is closed</h1>
			<p class="verify__lede">
				Collection was confirmed
				{#if data.collected_at_label}
					on <strong>{data.collected_at_label}</strong>{/if}. Do not release again.
			</p>
		{:else if state === 'expired'}
			<p class="verify__badge verify__badge--warn">Code window ended</p>
			<h1 class="verify__title">Ask the venue owner</h1>
			<p class="verify__lede">
				Payment is on record, but the pickup window has ended. The venue owner should confirm
				in Art Hawks before releasing.
			</p>
		{:else}
			<p class="verify__badge verify__badge--warn">Not ready</p>
			<h1 class="verify__title">Cannot verify release</h1>
			<p class="verify__lede">This link does not show a paid pickup ready for handover.</p>
		{/if}

		{#if data.artwork.image_url}
			<img class="verify__thumb" src={data.artwork.image_url} alt="" />
		{/if}

		<p class="verify__work">{data.artwork.title}</p>
		<p class="verify__artist">by {data.artwork.artist_name}</p>

		{#if data.venue_name}
			<p class="verify__venue">At <strong>{data.venue_name}</strong></p>
		{/if}

		<ul class="verify__facts">
			{#if data.paid_at_label}
				<li><span>Paid</span> {data.paid_at_label}</li>
			{/if}
			{#if data.collected_at_label}
				<li><span>Collected</span> {data.collected_at_label}</li>
			{/if}
			{#if data.expires_at_label && state === 'paid'}
				<li><span>Pickup window</span> until {data.expires_at_label}</li>
			{/if}
		</ul>

		{#if state === 'paid'}
			<p class="verify__hint">
				Owner follow-up: confirm collection in Art Hawks (Venue → Confirm collection) when
				convenient - that closes the handover on the ledger.
			</p>
		{/if}

		<nav class="verify__nav">
			<a href={ROUTES.home}>Art Hawks</a>
			<a href={ROUTES.venueCollect}>Venue collect</a>
		</nav>
	</div>
</article>

<style>
	.verify {
		background:
			radial-gradient(ellipse 50% 35% at 70% 0%, rgb(74 92 74 / 0.14), transparent 55%),
			var(--color-wall, #f4f1ea);
		color: var(--color-ink, #0e181f);
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
	}

	.verify__inner {
		width: min(100%, 26rem);
		margin: 0 auto;
		text-align: center;
	}

	.verify__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-ember, #c9652e);
	}

	.verify__badge {
		display: inline-block;
		margin: 1rem 0 0;
		padding: 0.35rem 0.7rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: rgb(14 24 31 / 0.08);
	}

	.verify__badge--ok {
		background: rgb(74 92 74 / 0.18);
		color: #2f3d2f;
	}

	.verify__badge--warn {
		background: rgb(201 101 46 / 0.16);
		color: #8a3d12;
	}

	.verify__title {
		margin: 0.85rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.7rem, 6vw, 2.2rem);
		font-weight: 500;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}

	.verify__lede {
		margin: 0.85rem 0 0;
		line-height: 1.55;
		color: rgb(14 24 31 / 0.72);
	}

	.verify__thumb {
		display: block;
		width: min(100%, 11rem);
		aspect-ratio: 4 / 5;
		object-fit: cover;
		margin: 1.5rem auto 0;
		background: var(--color-ink, #0e181f);
	}

	.verify__work {
		margin: 1.1rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.25rem;
		font-weight: 500;
	}

	.verify__artist,
	.verify__venue {
		margin: 0.35rem 0 0;
		font-size: 0.95rem;
		color: rgb(14 24 31 / 0.65);
	}

	.verify__facts {
		list-style: none;
		margin: 1.5rem 0 0;
		padding: 1rem 0 0;
		border-top: 1px solid rgb(14 24 31 / 0.1);
		text-align: left;
		display: grid;
		gap: 0.55rem;
	}

	.verify__facts li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.verify__facts span {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.45);
		flex-shrink: 0;
		padding-top: 0.15rem;
	}

	.verify__hint {
		margin: 1.35rem 0 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.55);
	}

	.verify__nav {
		display: flex;
		justify-content: center;
		gap: 1.25rem;
		margin-top: 2rem;
	}

	.verify__nav a {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-ember, #c9652e);
		text-decoration: none;
	}
</style>
