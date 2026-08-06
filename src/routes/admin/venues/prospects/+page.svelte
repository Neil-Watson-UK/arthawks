<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	let message = $state<string | null>(null);
	let importBusy = $state(false);
	let lastReport = $state<string | null>(null);

	const statuses = ['draft', 'unclaimed', 'claim_pending', 'verified', 'inactive'] as const;

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
</script>

<section class="prospects">
	<p class="prospects__eyebrow">Acquisition</p>
	<h2 class="prospects__title">Venue prospects</h2>
	<p class="prospects__lead">
		OSM candidates stay in draft until you publish them as unclaimed. They are never Art Hawks
		partners.
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
		<a href={ROUTES.adminClaims}>Claims queue ({data.pendingClaimCount})</a>
		<a href={ROUTES.adminVenues}>Partner venues</a>
	</div>
	<p class="prospects__hint">
		If the live dry-run hangs or 429s, run <code>npm run import:venues:fetch</code> in a terminal,
		then use <strong>Dry-run from cache</strong>. Do not apply until you have reviewed the report.
	</p>

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
				onclick={() => goto(`${ROUTES.adminProspects}?status=${s}`)}
			>
				{s}
			</button>
		{/each}
	</nav>

	<div class="prospects__list">
		{#each data.prospects as p (p.id)}
			<article class="prospects__card">
				<strong>{p.name}</strong>
				<span>{p.category ?? '-'} · {p.postcode ?? p.locality ?? p.address ?? 'no address'}</span>
				<span class="prospects__meta">
					{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)} · {p.source_record_id}
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
			<p class="prospects__empty">No prospects in “{data.status}”.</p>
		{/each}
	</div>
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
	.prospects__btns button {
		font: inherit;
		padding: 0.45rem 0.75rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		background: #fff;
		cursor: pointer;
		border-radius: 0.25rem;
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
	.prospects__tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 1rem 0;
	}
	.prospects__tabs button {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.35rem 0.65rem;
		border: none;
		background: transparent;
		opacity: 0.55;
		cursor: pointer;
		border-radius: 0.25rem;
	}
	.prospects__tabs button.active,
	.prospects__tabs button:hover {
		opacity: 1;
		background: rgb(30 41 59 / 0.08);
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
</style>
