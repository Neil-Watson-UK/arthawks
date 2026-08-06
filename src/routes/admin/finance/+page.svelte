<script lang="ts">
	import { formatBalance } from '$lib/utils/format';

	let { data } = $props();

	function downloadCsv(): void {
		const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `arthawks-purchases-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<section class="fin">
	<p class="fin__eyebrow">Audit</p>
	<h2 class="fin__title">Finance</h2>
	<p class="fin__intro">
		Paid sales, ledger credits, and party balances. Payouts are manual off-platform against this
		ledger until Stripe Connect ships. Pilot split: 70% artist · 15% wall venue (or 5% finder) ·
		remainder platform.
	</p>

	{#if data.error}
		<p class="fin__error" role="alert">{data.error}</p>
	{/if}

	<div class="fin__stats">
		<div class="fin__stat">
			<span>GMV (paid + collected)</span>
			<strong>{formatBalance(data.gmv_pence)}</strong>
		</div>
		<div class="fin__stat">
			<span>Purchases</span>
			<strong>{data.purchases.length}</strong>
		</div>
		<div class="fin__stat">
			<span>Ledger rows</span>
			<strong>{data.ledger.length}</strong>
		</div>
	</div>

	<div class="fin__toolbar">
		<button type="button" class="fin__csv" onclick={downloadCsv}>Export purchases CSV</button>
	</div>

	<h3 class="fin__h">Purchases</h3>
	<div class="fin__table-wrap">
		<table class="fin__table">
			<thead>
				<tr>
					<th>When</th>
					<th>Status</th>
					<th>Work</th>
					<th>Artist</th>
					<th>Venue</th>
					<th>Amount</th>
					<th>Artist 70%</th>
					<th>Venue</th>
					<th>Finder</th>
					<th>Platform</th>
					<th>Ledger</th>
				</tr>
			</thead>
			<tbody>
				{#each data.purchases as row}
					<tr>
						<td>{new Date(row.created_at).toLocaleString('en-GB')}</td>
						<td>{row.status}</td>
						<td>{row.artwork_title}</td>
						<td>{row.artist_name}</td>
						<td>{row.venue_name}</td>
						<td>{formatBalance(row.amount_pence)}</td>
						<td>{row.artist_share_pence != null ? formatBalance(row.artist_share_pence) : '-'}</td>
						<td>{row.venue_share_pence != null ? formatBalance(row.venue_share_pence) : '-'}</td>
						<td>{row.finder_share_pence != null ? formatBalance(row.finder_share_pence) : '-'}</td>
						<td
							>{row.platform_share_pence != null ? formatBalance(row.platform_share_pence) : '-'}</td
						>
						<td>{row.ledger_posted_at ? 'posted' : 'pending'}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="11">No purchases yet.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h3 class="fin__h">Balances</h3>
	<div class="fin__table-wrap">
		<table class="fin__table">
			<thead>
				<tr>
					<th>Party</th>
					<th>Type</th>
					<th>Available</th>
					<th>Lifetime</th>
					<th>Updated</th>
				</tr>
			</thead>
			<tbody>
				{#each data.balances as row}
					<tr>
						<td>{row.party_name}</td>
						<td>{row.party_type}</td>
						<td>{formatBalance(row.available_pence)}</td>
						<td>{formatBalance(row.lifetime_pence)}</td>
						<td>{new Date(row.updated_at).toLocaleString('en-GB')}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5">No balances yet.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h3 class="fin__h">Recent ledger</h3>
	<div class="fin__table-wrap">
		<table class="fin__table">
			<thead>
				<tr>
					<th>When</th>
					<th>Purchase</th>
					<th>Party</th>
					<th>Kind</th>
					<th>Amount</th>
				</tr>
			</thead>
			<tbody>
				{#each data.ledger as row}
					<tr>
						<td>{new Date(row.created_at).toLocaleString('en-GB')}</td>
						<td class="fin__mono">{row.purchase_id.slice(0, 8)}…</td>
						<td>{row.party_name} · {row.party_type}</td>
						<td>{row.kind}</td>
						<td>{formatBalance(row.amount_pence)}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5">No ledger entries yet.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.fin__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.fin__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 500;
	}
	.fin__intro {
		margin: 0.5rem 0 0;
		max-width: 40rem;
		opacity: 0.75;
		font-size: 0.95rem;
		line-height: 1.5;
	}
	.fin__error {
		margin-top: 1rem;
		color: #9a3412;
		font-weight: 600;
	}
	.fin__stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.75rem;
		margin-top: 1.5rem;
	}
	.fin__stat {
		padding: 1rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		border-radius: 0.4rem;
		background: rgb(250 249 246 / 0.85);
	}
	.fin__stat span {
		display: block;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.fin__stat strong {
		display: block;
		margin-top: 0.35rem;
		font-size: 1.25rem;
	}
	.fin__toolbar {
		margin-top: 1.25rem;
	}
	.fin__csv {
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.55rem 0.9rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		border-radius: 0.3rem;
		background: #0e181f;
		color: #f3f0e8;
		cursor: pointer;
	}
	.fin__h {
		margin: 2rem 0 0.75rem;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 500;
	}
	.fin__table-wrap {
		overflow-x: auto;
		border: 1px solid rgb(30 41 59 / 0.1);
		border-radius: 0.35rem;
		background: rgb(250 249 246 / 0.9);
	}
	.fin__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}
	.fin__table th,
	.fin__table td {
		padding: 0.55rem 0.65rem;
		text-align: left;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
		white-space: nowrap;
	}
	.fin__table th {
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	.fin__mono {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}
</style>
