<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let busy = $state<string | null>(null);
	let message = $state<string | null>(null);

	async function patch(id: string, body: Record<string, unknown>): Promise<void> {
		busy = id;
		const response = await fetch(`/api/admin/artworks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		message = response.ok ? 'Updated.' : 'Update failed';
		busy = null;
		await invalidateAll();
	}

	async function remove(id: string): Promise<void> {
		if (!confirm('Delete this artwork?')) return;
		busy = id;
		await fetch(`/api/admin/artworks/${id}`, { method: 'DELETE' });
		busy = null;
		await invalidateAll();
	}
</script>

<section class="arts">
	<p class="arts__eyebrow">Catalogue</p>
	<h2 class="arts__title">Artworks</h2>
	{#if message}<p>{message}</p>{/if}

	<div class="arts__list">
		{#each data.artworks as artwork (artwork.id)}
			<article class="arts__row">
				{#if artwork.image_url}
					<img src={artwork.image_url} alt="" width="64" height="64" />
				{/if}
				<div class="arts__meta">
					<strong>{artwork.title}</strong>
					<span>{artwork.artist_name} · {artwork.status} · £{(artwork.price_pence / 100).toFixed(0)}</span>
					{#if artwork.is_plug_and_play}<em>Auto Amor</em>{/if}
				</div>
				<div class="arts__actions">
					<select
						disabled={busy === artwork.id}
						value={artwork.status}
						onchange={(e) =>
							patch(artwork.id, { status: (e.currentTarget as HTMLSelectElement).value })}
					>
						<option value="available">available</option>
						<option value="matched">matched</option>
						<option value="sold">sold</option>
					</select>
					<button type="button" disabled={busy === artwork.id} onclick={() => remove(artwork.id)}>
						Delete
					</button>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.arts__eyebrow { margin: 0; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.55; }
	.arts__title { margin: 0.35rem 0 1rem; font-family: var(--font-display); font-size: 2rem; font-weight: 500; }
	.arts__list { display: grid; gap: 0.55rem; }
	.arts__row {
		display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
		padding: 0.75rem; border: 1px solid rgb(30 41 59 / 0.1); border-radius: 0.35rem; background: rgb(250 249 246 / 0.9);
	}
	.arts__row img { object-fit: cover; border-radius: 0.25rem; }
	.arts__meta { flex: 1; min-width: 10rem; }
	.arts__meta strong { display: block; }
	.arts__meta span { font-size: 0.8rem; opacity: 0.7; }
	.arts__meta em { font-size: 0.75rem; color: var(--color-burnt); font-style: normal; }
	.arts__actions { display: flex; gap: 0.4rem; }
	.arts__actions select, .arts__actions button {
		padding: 0.35rem 0.5rem; border: 1px solid rgb(30 41 59 / 0.15); border-radius: 0.25rem; font-size: 0.75rem; background: transparent;
	}
</style>
