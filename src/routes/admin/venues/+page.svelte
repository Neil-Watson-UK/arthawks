<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let editing = $state<string | null>(null);
	let draft = $state({
		name: '',
		slug: '',
		bio: '',
		city_id: '',
		owner_id: '',
		postcode: '',
		district: '',
		image_url: '',
		is_active: true
	});
	let message = $state<string | null>(null);

	function startEdit(venue: (typeof data.venues)[number]): void {
		editing = venue.id;
		draft = {
			name: venue.name,
			slug: venue.slug,
			bio: venue.bio ?? '',
			city_id: venue.city_id ?? '',
			owner_id: venue.owner_id,
			postcode: venue.postcode ?? '',
			district: venue.district ?? '',
			image_url: venue.image_url ?? '',
			is_active: venue.is_active
		};
	}

	async function save(): Promise<void> {
		if (!editing) return;
		const response = await fetch(`/api/admin/venues/${editing}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(draft)
		});
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		message = response.ok ? 'Saved.' : payload?.message ?? 'Save failed';
		editing = null;
		await invalidateAll();
	}
</script>

<section class="venues">
	<p class="venues__eyebrow">Spaces</p>
	<h2 class="venues__title">Partner venues</h2>
	<p>
		<a href="/admin/venues/prospects">Prospects &amp; OSM import</a>
		·
		<a href="/admin/venues/claims">Claim queue</a>
	</p>
	{#if message}<p class="venues__msg">{message}</p>{/if}

	<div class="venues__list">
		{#each data.venues as venue (venue.id)}
			<article class="venues__card">
				{#if editing === venue.id}
					<label>Name <input bind:value={draft.name} /></label>
					<label>Slug <input bind:value={draft.slug} /></label>
					<label>Bio <textarea bind:value={draft.bio} rows="3"></textarea></label>
					<label>Image URL <input bind:value={draft.image_url} /></label>
					<label>Postcode <input bind:value={draft.postcode} placeholder="BS1 4ST" /></label>
					<label>District (legacy) <input bind:value={draft.district} /></label>
					<label>
						City
						<select bind:value={draft.city_id}>
							<option value="">-</option>
							{#each data.cities as city}
								<option value={city.id}>{city.name}</option>
							{/each}
						</select>
					</label>
					<label>
						Owner
						<select bind:value={draft.owner_id}>
							{#each data.owners as owner}
								<option value={owner.id}>{owner.full_name ?? owner.username}</option>
							{/each}
						</select>
					</label>
					<label class="venues__check">
						<input type="checkbox" bind:checked={draft.is_active} /> Active
					</label>
					<div class="venues__btns">
						<button type="button" onclick={save}>Save</button>
						<button type="button" onclick={() => (editing = null)}>Cancel</button>
					</div>
				{:else}
					<strong>{venue.name}</strong>
					<span>{venue.slug} · {venue.is_active ? 'active' : 'off'}</span>
					<button type="button" onclick={() => startEdit(venue)}>Edit</button>
				{/if}
			</article>
		{/each}
	</div>
</section>

<style>
	.venues__eyebrow { margin: 0; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.55; }
	.venues__title { margin: 0.35rem 0 0; font-family: var(--font-display); font-size: 2rem; font-weight: 500; }
	.venues__msg { font-size: 0.85rem; }
	.venues__list { display: grid; gap: 0.65rem; margin-top: 1.25rem; }
	.venues__card {
		display: grid; gap: 0.45rem; padding: 1rem; border: 1px solid rgb(30 41 59 / 0.1);
		border-radius: 0.4rem; background: rgb(250 249 246 / 0.9);
	}
	.venues__card strong { font-size: 1.05rem; }
	.venues__card span { font-size: 0.8rem; opacity: 0.7; }
	.venues__card label { display: grid; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; }
	.venues__card input, .venues__card textarea, .venues__card select {
		padding: 0.45rem 0.55rem; border: 1px solid rgb(30 41 59 / 0.18); border-radius: 0.3rem; font: inherit; font-weight: 400;
	}
	.venues__check { display: flex !important; align-items: center; gap: 0.4rem; }
	.venues__btns { display: flex; gap: 0.4rem; }
	.venues__card button {
		justify-self: start; padding: 0.4rem 0.7rem; border: 1px solid rgb(30 41 59 / 0.15);
		border-radius: 0.3rem; background: transparent; font-size: 0.8rem; cursor: pointer;
	}
</style>
