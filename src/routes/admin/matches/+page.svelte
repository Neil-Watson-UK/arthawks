<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let busy = $state<string | null>(null);

	async function setStatus(id: string, status: 'accepted' | 'declined' | 'pending'): Promise<void> {
		busy = id;
		await fetch(`/api/admin/matches/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status })
		});
		busy = null;
		await invalidateAll();
	}
</script>

<section class="matches">
	<p class="matches__eyebrow">Rotations</p>
	<h2 class="matches__title">Matches</h2>

	<div class="matches__list">
		{#each data.matches as match (match.id)}
			<article class="matches__row">
				<div>
					<strong>{match.artwork_title}</strong>
					<span>@ {match.venue_name} · {match.status}</span>
				</div>
				<div class="matches__actions">
					<button type="button" disabled={busy === match.id} onclick={() => setStatus(match.id, 'accepted')}>
						Approve
					</button>
					<button type="button" disabled={busy === match.id} onclick={() => setStatus(match.id, 'declined')}>
						Decline
					</button>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.matches__eyebrow { margin: 0; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.55; }
	.matches__title { margin: 0.35rem 0 1rem; font-family: var(--font-display); font-size: 2rem; font-weight: 500; }
	.matches__list { display: grid; gap: 0.5rem; }
	.matches__row {
		display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.75rem;
		padding: 0.85rem 1rem; border: 1px solid rgb(30 41 59 / 0.1); border-radius: 0.35rem; background: rgb(250 249 246 / 0.9);
	}
	.matches__row strong { display: block; }
	.matches__row span { font-size: 0.8rem; opacity: 0.7; }
	.matches__actions { display: flex; gap: 0.4rem; }
	.matches__actions button {
		padding: 0.35rem 0.6rem; border: 1px solid rgb(30 41 59 / 0.15); border-radius: 0.25rem;
		background: transparent; font-size: 0.75rem; cursor: pointer;
	}
</style>
