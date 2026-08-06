<script lang="ts">
	import { claimSpaceRoute, ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	const p = $derived(data.prospect);
</script>

<section class="space">
	<p class="space__eyebrow">Potential Art Hawks space</p>
	<h1 class="space__title">{p.name}</h1>
	<p class="space__lead">
		Could this space become part of Bristol’s living gallery? This is not an Art Hawks partner venue
		and is not currently hosting artwork.
	</p>

	<dl class="space__facts">
		{#if p.category}
			<div><dt>Category</dt><dd>{p.category}</dd></div>
		{/if}
		{#if p.address || p.locality || p.postcode}
			<div>
				<dt>Location</dt>
				<dd>{[p.address, p.locality, p.postcode].filter(Boolean).join(', ')}</dd>
			</div>
		{/if}
		{#if p.website}
			<div>
				<dt>Website</dt>
				<dd><a href={p.website} rel="noopener noreferrer" target="_blank">{p.website}</a></dd>
			</div>
		{/if}
		{#if p.lifecycle_status === 'claim_pending'}
			<div>
				<dt>Status</dt>
				<dd>A claim is under review</dd>
			</div>
		{/if}
	</dl>

	<p class="space__ask">Do you represent this venue? Claim this profile and explore Art Hawks.</p>

	{#if p.lifecycle_status === 'unclaimed'}
		<a class="space__cta" href={claimSpaceRoute(p.id)}>Claim this venue</a>
	{:else}
		<p class="space__pending">Claim pending admin review.</p>
	{/if}

	<p class="space__back"><a href={ROUTES.spaces}>← All potential spaces</a></p>
</section>

<style>
	.space {
		max-width: 36rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}
	.space__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.space__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.5rem);
		font-weight: 500;
	}
	.space__lead {
		line-height: 1.5;
		opacity: 0.85;
	}
	.space__facts {
		display: grid;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}
	.space__facts dt {
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.space__facts dd {
		margin: 0.15rem 0 0;
	}
	.space__ask {
		font-weight: 600;
	}
	.space__cta {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.7rem 1.1rem;
		background: #1e293b;
		color: #faf9f6;
		text-decoration: none;
		font-weight: 600;
	}
	.space__pending {
		opacity: 0.75;
	}
	.space__back {
		margin-top: 2rem;
		font-size: 0.9rem;
	}
</style>
