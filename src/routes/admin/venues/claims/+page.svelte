<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	let message = $state<string | null>(null);

	async function act(id: string, action: 'approve' | 'reject'): Promise<void> {
		message = null;
		const response = await fetch('/api/admin/venues/claims', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, action })
		});
		const payload = await response.json().catch(() => null);
		message = response.ok
			? action === 'approve'
				? `Approved - venue verified (${payload?.venue_id ?? ''})`
				: 'Claim rejected'
			: payload?.message ?? 'Failed';
		await invalidateAll();
	}
</script>

<section class="claims">
	<p class="claims__eyebrow">Acquisition</p>
	<h2 class="claims__title">Claim queue</h2>
	<p class="claims__lead">
		Approve only after verifying the claimant represents the space. Approval creates a verified
		partner venue (not yet active).
	</p>
	<p><a href={ROUTES.adminProspects}>← Prospects</a></p>
	{#if message}<p class="claims__msg">{message}</p>{/if}

	<div class="claims__list">
		{#each data.claims as claim (claim.id)}
			<article class="claims__card">
				<strong>{claim.prospect?.name ?? 'Unknown space'}</strong>
				<span>
					{claim.full_name} · {claim.role_at_venue} · {claim.work_email}
				</span>
				<span class="claims__meta">
					Account: {claim.claimant?.username ?? claim.claimant_user_id}
					({claim.claimant?.user_type ?? '?'})
				</span>
				<p>{claim.verification_info}</p>
				{#if claim.message}<p class="claims__note">{claim.message}</p>{/if}
				{#if claim.prospect?.source_url}
					<a href={claim.prospect.source_url} target="_blank" rel="noopener noreferrer">OSM</a>
				{/if}
				<div class="claims__btns">
					<button type="button" onclick={() => act(claim.id, 'approve')}>Approve</button>
					<button type="button" onclick={() => act(claim.id, 'reject')}>Reject</button>
				</div>
			</article>
		{:else}
			<p class="claims__empty">No pending claims.</p>
		{/each}
	</div>
</section>

<style>
	.claims__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.claims__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 500;
	}
	.claims__lead {
		max-width: 40rem;
		opacity: 0.8;
	}
	.claims__msg {
		font-weight: 600;
	}
	.claims__list {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.claims__card {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem 1rem;
		background: #fff;
		border: 1px solid rgb(30 41 59 / 0.08);
	}
	.claims__meta {
		font-size: 0.8rem;
		opacity: 0.65;
	}
	.claims__note {
		font-style: italic;
		opacity: 0.85;
	}
	.claims__btns {
		display: flex;
		gap: 0.5rem;
	}
	.claims__btns button {
		font: inherit;
		padding: 0.45rem 0.75rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		background: #fff;
		cursor: pointer;
		border-radius: 0.25rem;
	}
	.claims__empty {
		opacity: 0.6;
	}
</style>
