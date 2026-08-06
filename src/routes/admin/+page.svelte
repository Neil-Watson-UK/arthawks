<script lang="ts">
	import { formatBalance } from '$lib/utils/format';

	let { data } = $props();
	const s = $derived(data.stats);
</script>

<section class="dash">
	<p class="dash__eyebrow">Overview</p>
	<h2 class="dash__title">Dashboard</h2>
	<p class="dash__intro">Counts across accounts, catalogue, and the living wall network.</p>

	<div class="dash__grid">
		<div class="dash__stat dash__stat--money">
			<span>Art Hawks · 15%</span>
			<strong>{formatBalance(s.platform_available_pence)}</strong>
		</div>
		<div class="dash__stat dash__stat--money">
			<span>GMV (paid)</span>
			<strong>{formatBalance(s.gmv_pence)}</strong>
		</div>
		<div class="dash__stat"><span>Artists</span><strong>{s.artists}</strong></div>
		<div class="dash__stat"><span>Venue accounts</span><strong>{s.venueUsers}</strong></div>
		<div class="dash__stat"><span>Buyers</span><strong>{s.buyers}</strong></div>
		<div class="dash__stat"><span>Admins</span><strong>{s.admins}</strong></div>
		<div class="dash__stat"><span>Venue spaces</span><strong>{s.venues}</strong></div>
		<div class="dash__stat"><span>Artworks</span><strong>{s.artworks}</strong></div>
		<div class="dash__stat"><span>Open matches</span><strong>{s.openMatches}</strong></div>
		<div class="dash__stat"><span>QR scans</span><strong>{s.recentScans}</strong></div>
	</div>
</section>

<style>
	.dash__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.dash__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.4rem);
		font-weight: 500;
	}
	.dash__intro {
		margin: 0.5rem 0 0;
		max-width: 36rem;
		opacity: 0.75;
		font-size: 0.95rem;
	}
	.dash__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.75rem;
		margin-top: 1.75rem;
	}
	.dash__stat {
		padding: 1rem 1.1rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		border-radius: 0.4rem;
		background: rgb(250 249 246 / 0.85);
	}
	.dash__stat--money {
		grid-column: span 1;
		min-width: 0;
		border-color: rgb(194 65 12 / 0.25);
		background: linear-gradient(165deg, rgb(255 247 237 / 0.95), rgb(250 249 246 / 0.9));
	}
	.dash__stat span {
		display: block;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.dash__stat strong {
		display: block;
		margin-top: 0.35rem;
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 500;
	}
	.dash__stat--money strong {
		font-size: 1.45rem;
	}
</style>
