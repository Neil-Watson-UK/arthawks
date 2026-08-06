<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	let message = $state<string | null>(null);
	let importBusy = $state(false);
	let lastReport = $state<string | null>(null);
	let searchDraft = $state(data.q ?? '');
	let addBusy = $state(false);
	let showAdd = $state(false);

	let addName = $state('');
	let addCategory = $state('cafe');
	let addAddress = $state('');
	let addLocality = $state('Bristol');
	let addPostcode = $state('');
	let addLat = $state('51.4545');
	let addLng = $state('-2.5879');
	let addWebsite = $state('');
	let addPublish = $state(false);

	const statuses = ['draft', 'unclaimed', 'claim_pending', 'verified', 'inactive'] as const;
	const letters = [
		...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
		'#'
	] as const;

	$effect(() => {
		searchDraft = data.q ?? '';
	});

	function hrefFor(opts: {
		status?: string;
		letter?: string | null;
		q?: string | null;
		page?: number;
	}): string {
		const params = new URLSearchParams();
		params.set('status', opts.status ?? data.status);
		const letter = opts.letter === undefined ? data.letter : opts.letter;
		if (letter) params.set('letter', letter);
		const q = opts.q === undefined ? data.q : opts.q;
		if (q) params.set('q', q);
		const page = opts.page ?? 1;
		if (page > 1) params.set('page', String(page));
		return `${ROUTES.adminProspects}?${params}`;
	}

	function submitSearch(event: SubmitEvent): void {
		event.preventDefault();
		void goto(hrefFor({ q: searchDraft.trim() || null, letter: data.letter || null, page: 1 }));
	}

	async function runImport(dryRun: boolean, preferCache = false): Promise<void> {
		importBusy = true;
		message = preferCache
			? 'Running from cache…'
			: 'Talking to Overpass (30-90s, small category queries)…';
		lastReport = null;
		try {
			const params = new URLSearchParams({
				dry_run: dryRun ? '1' : '0',
				...(preferCache ? { cache: '1' } : {})
			});
			const response = await fetch(`/api/admin/venues/import?${params}`, {
				method: 'POST'
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				message = payload?.message ?? 'Import failed';
				return;
			}
			lastReport = JSON.stringify(payload, null, 2);
			const cacheNote = payload.from_cache ? ' (from cache)' : '';
			message = dryRun
				? `Dry-run${cacheNote}: ${payload.fetched} fetched, ${payload.inserted} would insert, ${payload.updated} would update, ${payload.skipped} skip, ${payload.protected} protected.`
				: `Imported${cacheNote}: ${payload.inserted} inserted, ${payload.updated} updated.`;
			if (!dryRun) await invalidateAll();
		} catch {
			message =
				'Network error / timeout. Prefer: npm run import:venues:fetch in a terminal, then “Dry-run from cache”.';
		} finally {
			importBusy = false;
		}
	}

	async function act(id: string, action: string, extra: Record<string, unknown> = {}): Promise<void> {
		message = null;
		const response = await fetch('/api/admin/venues/prospects', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, action, ...extra })
		});
		const payload = await response.json().catch(() => null);
		message = response.ok ? `OK - ${action}` : payload?.message ?? 'Failed';
		await invalidateAll();
	}

	async function addProspect(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (addBusy) return;
		addBusy = true;
		message = null;
		try {
			const response = await fetch('/api/admin/venues/prospects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: addName,
					category: addCategory || null,
					address: addAddress || null,
					locality: addLocality || null,
					postcode: addPostcode || null,
					latitude: Number(addLat),
					longitude: Number(addLng),
					website: addWebsite || null,
					publish: addPublish
				})
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				message = payload?.message ?? 'Could not add prospect';
				return;
			}
			const published = addPublish;
			const createdName = payload.prospect?.name as string | undefined;
			message = published
				? `Published unclaimed: ${createdName}`
				: `Draft added: ${createdName}`;
			addName = '';
			addAddress = '';
			addPostcode = '';
			addWebsite = '';
			addPublish = false;
			showAdd = false;
			await invalidateAll();
			void goto(
				hrefFor({
					status: published ? 'unclaimed' : 'draft',
					q: createdName ?? null,
					letter: null
				})
			);
		} catch {
			message = 'Network error while adding';
		} finally {
			addBusy = false;
		}
	}

	const from = $derived(data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1);
	const to = $derived(Math.min(data.page * data.pageSize, data.total));
</script>

<section class="prospects">
	<p class="prospects__eyebrow">Acquisition</p>
	<h2 class="prospects__title">Venue prospects</h2>
	<p class="prospects__lead">
		OSM candidates stay in draft until you publish them as unclaimed. They are never Art Hawks
		partners. Browse by letter or search - the list used to stop at the first 300 names.
	</p>

	{#if message}<p class="prospects__msg">{message}</p>{/if}

	<div class="prospects__actions">
		<button type="button" disabled={importBusy} onclick={() => runImport(true, false)}>
			{importBusy ? 'Working…' : 'Dry-run Overpass import'}
		</button>
		<button type="button" disabled={importBusy} onclick={() => runImport(true, true)}>
			Dry-run from cache
		</button>
		<button type="button" disabled={importBusy} onclick={() => runImport(false, true)}>
			Apply import from cache (draft only)
		</button>
		<button type="button" onclick={() => (showAdd = !showAdd)}>
			{showAdd ? 'Hide add form' : 'Add venue manually'}
		</button>
		<a href={ROUTES.adminClaims}>Claims queue ({data.pendingClaimCount})</a>
		<a href={ROUTES.adminVenues}>Partner venues</a>
	</div>
	<p class="prospects__hint">
		If the live dry-run hangs or 429s, run <code>npm run import:venues:fetch</code> in a terminal,
		then use <strong>Dry-run from cache</strong>. Do not apply until you have reviewed the report.
	</p>

	{#if showAdd}
		<form class="prospects__add" onsubmit={addProspect}>
			<h3>Add a venue</h3>
			<p>For places Overpass missed. Defaults pin near central Bristol - adjust lat/lng.</p>
			<label>
				Name
				<input required bind:value={addName} placeholder="Café name" />
			</label>
			<label>
				Category
				<input bind:value={addCategory} placeholder="cafe / pub / gallery" />
			</label>
			<label>
				Address
				<input bind:value={addAddress} />
			</label>
			<label>
				Locality
				<input bind:value={addLocality} />
			</label>
			<label>
				Postcode
				<input bind:value={addPostcode} placeholder="BS1 …" />
			</label>
			<label>
				Latitude
				<input required inputmode="decimal" bind:value={addLat} />
			</label>
			<label>
				Longitude
				<input required inputmode="decimal" bind:value={addLng} />
			</label>
			<label>
				Website
				<input type="url" bind:value={addWebsite} placeholder="https://" />
			</label>
			<label class="prospects__check">
				<input type="checkbox" bind:checked={addPublish} />
				Publish as unclaimed immediately
			</label>
			<button type="submit" disabled={addBusy}>{addBusy ? 'Saving…' : 'Save prospect'}</button>
		</form>
	{/if}

	{#if lastReport}
		<details class="prospects__report">
			<summary>Last import report</summary>
			<pre>{lastReport}</pre>
		</details>
	{/if}

	<nav class="prospects__tabs" aria-label="Lifecycle filter">
		{#each statuses as s}
			<button
				type="button"
				class:active={data.status === s}
				onclick={() => goto(hrefFor({ status: s, page: 1 }))}
			>
				{s}
			</button>
		{/each}
	</nav>

	<form class="prospects__search" onsubmit={submitSearch}>
		<label class="visually-hidden" for="prospect-q">Search prospects</label>
		<input
			id="prospect-q"
			type="search"
			placeholder="Search name, postcode, address…"
			bind:value={searchDraft}
		/>
		<button type="submit">Search</button>
		{#if data.q}
			<button type="button" onclick={() => goto(hrefFor({ q: null, page: 1 }))}>Clear</button>
		{/if}
	</form>

	<nav class="prospects__letters" aria-label="Name letter">
		<button
			type="button"
			class:active={!data.letter}
			onclick={() => goto(hrefFor({ letter: null, page: 1 }))}
		>
			All
		</button>
		{#each letters as L}
			<button
				type="button"
				class:active={data.letter === L}
				onclick={() => goto(hrefFor({ letter: L, page: 1 }))}
			>
				{L}
			</button>
		{/each}
	</nav>

	<p class="prospects__count">
		Showing {from}-{to} of {data.total} · {data.status}
		{#if data.letter}· {data.letter}{/if}
		{#if data.q}· “{data.q}”{/if}
	</p>

	<div class="prospects__list">
		{#each data.prospects as p (p.id)}
			<article class="prospects__card">
				<strong>{p.name}</strong>
				<span>{p.category ?? '-'} · {p.postcode ?? p.locality ?? p.address ?? 'no address'}</span>
				<span class="prospects__meta">
					{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)} · {p.source} · {p.source_record_id}
				</span>
				{#if p.source_url}
					<a href={p.source_url} target="_blank" rel="noopener noreferrer">OSM source</a>
				{/if}
				<div class="prospects__btns">
					{#if p.lifecycle_status === 'draft' || p.lifecycle_status === 'inactive'}
						<button type="button" onclick={() => act(p.id, 'publish')}>Publish unclaimed</button>
					{/if}
					{#if p.lifecycle_status !== 'inactive' && p.lifecycle_status !== 'verified'}
						<button
							type="button"
							onclick={() => act(p.id, 'reject', { reason: 'Rejected in review' })}
						>
							Reject
						</button>
					{/if}
				</div>
			</article>
		{:else}
			<p class="prospects__empty">No prospects match this filter.</p>
		{/each}
	</div>

	{#if data.totalPages > 1}
		<nav class="prospects__pager" aria-label="Pages">
			{#if data.page > 1}
				<a href={hrefFor({ page: data.page - 1 })}>Previous</a>
			{/if}
			<span>Page {data.page} of {data.totalPages}</span>
			{#if data.page < data.totalPages}
				<a href={hrefFor({ page: data.page + 1 })}>Next</a>
			{/if}
		</nav>
	{/if}
</section>

<style>
	.prospects__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.prospects__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 500;
	}
	.prospects__lead {
		max-width: 40rem;
		opacity: 0.8;
	}
	.prospects__msg {
		font-size: 0.9rem;
		font-weight: 600;
	}
	.prospects__hint {
		font-size: 0.85rem;
		opacity: 0.75;
		max-width: 40rem;
	}
	.prospects__hint code {
		font-size: 0.8rem;
	}
	.prospects__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin: 1rem 0;
	}
	.prospects__actions button,
	.prospects__btns button,
	.prospects__search button,
	.prospects__add button {
		font: inherit;
		padding: 0.45rem 0.75rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		background: #fff;
		cursor: pointer;
		border-radius: 0.25rem;
	}
	.prospects__add {
		display: grid;
		gap: 0.65rem;
		max-width: 28rem;
		margin: 1rem 0;
		padding: 1rem;
		border: 1px solid rgb(30 41 59 / 0.12);
		background: rgb(250 249 246 / 0.9);
	}
	.prospects__add h3 {
		margin: 0;
		font-size: 1.05rem;
	}
	.prospects__add p {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.75;
	}
	.prospects__add label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.prospects__add input:not([type='checkbox']) {
		font: inherit;
		font-weight: 400;
		padding: 0.4rem 0.55rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		border-radius: 0.25rem;
	}
	.prospects__check {
		display: flex !important;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500 !important;
	}
	.prospects__report {
		margin: 1rem 0;
		font-size: 0.75rem;
	}
	.prospects__report pre {
		max-height: 20rem;
		overflow: auto;
		background: #1e293b;
		color: #e2e8f0;
		padding: 0.75rem;
	}
	.prospects__tabs,
	.prospects__letters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 1rem 0 0.5rem;
	}
	.prospects__tabs button,
	.prospects__letters button {
		font: inherit;
		font-size: 0.75rem;
		padding: 0.3rem 0.5rem;
		border: none;
		background: transparent;
		opacity: 0.55;
		cursor: pointer;
		border-radius: 0.25rem;
		min-width: 1.75rem;
	}
	.prospects__tabs button.active,
	.prospects__tabs button:hover,
	.prospects__letters button.active,
	.prospects__letters button:hover {
		opacity: 1;
		background: rgb(30 41 59 / 0.08);
	}
	.prospects__search {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}
	.prospects__search input {
		flex: 1 1 14rem;
		font: inherit;
		padding: 0.45rem 0.65rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		border-radius: 0.25rem;
	}
	.prospects__count {
		font-size: 0.85rem;
		opacity: 0.7;
		margin: 0.5rem 0 0.75rem;
	}
	.prospects__list {
		display: grid;
		gap: 0.75rem;
	}
	.prospects__card {
		display: grid;
		gap: 0.25rem;
		padding: 0.85rem 1rem;
		background: #fff;
		border: 1px solid rgb(30 41 59 / 0.08);
	}
	.prospects__meta {
		font-size: 0.8rem;
		opacity: 0.65;
	}
	.prospects__btns {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}
	.prospects__empty {
		opacity: 0.6;
	}
	.prospects__pager {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		margin-top: 1.25rem;
		font-size: 0.9rem;
	}
	.prospects__pager a {
		color: inherit;
		font-weight: 600;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
