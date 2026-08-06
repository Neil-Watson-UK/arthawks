<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { ROUTES } from '$lib/constants/routes';

	let { data } = $props();
	let message = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	async function setStatus(id: string, status: 'new' | 'read' | 'archived'): Promise<void> {
		busyId = id;
		message = null;
		try {
			const response = await fetch('/api/admin/inbox', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, status })
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				message = payload?.message ?? 'Update failed';
				return;
			}
			await invalidateAll();
		} finally {
			busyId = null;
		}
	}

	function filterHref(status: string, topic = data.topicFilter): string {
		const params = new URLSearchParams();
		if (status !== 'new') params.set('status', status);
		if (topic) params.set('topic', topic);
		const qs = params.toString();
		return qs ? `${ROUTES.adminInbox}?${qs}` : ROUTES.adminInbox;
	}
</script>

<section class="inbox">
	<p class="inbox__eyebrow">Mail</p>
	<h2 class="inbox__title">Contact inbox</h2>
	<p class="inbox__lead">Website form submissions. Email still goes to the role inboxes.</p>

	<nav class="inbox__filters" aria-label="Status">
		{#each [
			{ id: 'new', label: `New (${data.counts.new})` },
			{ id: 'read', label: `Read (${data.counts.read})` },
			{ id: 'archived', label: `Archived (${data.counts.archived})` },
			{ id: 'all', label: 'All' }
		] as f}
			<a
				href={filterHref(f.id)}
				class:inbox__filters--active={data.filter === f.id}
				onclick={(e) => {
					e.preventDefault();
					goto(filterHref(f.id));
				}}>{f.label}</a
			>
		{/each}
	</nav>

	<nav class="inbox__topics" aria-label="Topic">
		{#each ['', 'hello', 'artists', 'venues', 'support'] as t}
			<a
				href={filterHref(data.filter, t)}
				class:inbox__topics--active={data.topicFilter === t}
				onclick={(e) => {
					e.preventDefault();
					goto(filterHref(data.filter, t));
				}}>{t || 'All topics'}</a
			>
		{/each}
	</nav>

	{#if message}<p class="inbox__msg">{message}</p>{/if}

	<div class="inbox__list">
		{#each data.submissions as item (item.id)}
			<article class="inbox__card" class:inbox__card--new={item.status === 'new'}>
				<header class="inbox__card-head">
					<strong>{item.name}</strong>
					<span class="inbox__topic">{item.topic}</span>
					<span class="inbox__time">{new Date(item.created_at).toLocaleString()}</span>
				</header>
				<p class="inbox__from">
					<a href={`mailto:${item.email}`}>{item.email}</a>
					{#if !item.email_sent}
						<span class="inbox__warn">email not sent</span>
					{/if}
				</p>
				<pre class="inbox__body">{item.message}</pre>
				<div class="inbox__btns">
					{#if item.status !== 'read'}
						<button
							type="button"
							disabled={busyId === item.id}
							onclick={() => setStatus(item.id, 'read')}>Mark read</button
						>
					{/if}
					{#if item.status !== 'new'}
						<button
							type="button"
							disabled={busyId === item.id}
							onclick={() => setStatus(item.id, 'new')}>Mark new</button
						>
					{/if}
					{#if item.status !== 'archived'}
						<button
							type="button"
							disabled={busyId === item.id}
							onclick={() => setStatus(item.id, 'archived')}>Archive</button
						>
					{/if}
				</div>
			</article>
		{:else}
			<p class="inbox__empty">No submissions in this view.</p>
		{/each}
	</div>
</section>

<style>
	.inbox__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.inbox__title {
		margin: 0.2rem 0 0.35rem;
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 500;
	}
	.inbox__lead {
		margin: 0 0 1rem;
		opacity: 0.75;
		max-width: 36rem;
	}
	.inbox__filters,
	.inbox__topics {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.85rem;
		margin-bottom: 0.75rem;
	}
	.inbox__filters a,
	.inbox__topics a {
		font-size: 0.85rem;
		text-decoration: none;
		opacity: 0.7;
	}
	.inbox__filters--active,
	.inbox__topics--active {
		opacity: 1;
		font-weight: 700;
		text-decoration: underline;
	}
	.inbox__msg {
		color: #9a3412;
	}
	.inbox__list {
		display: grid;
		gap: 0.85rem;
	}
	.inbox__card {
		padding: 0.85rem 1rem;
		border: 1px solid rgb(30 41 59 / 0.15);
		background: #fff;
	}
	.inbox__card--new {
		border-color: rgb(30 41 59 / 0.35);
	}
	.inbox__card-head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		align-items: baseline;
	}
	.inbox__topic {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		opacity: 0.65;
	}
	.inbox__time {
		margin-left: auto;
		font-size: 0.8rem;
		opacity: 0.55;
	}
	.inbox__from {
		margin: 0.35rem 0;
		font-size: 0.9rem;
	}
	.inbox__warn {
		margin-left: 0.5rem;
		color: #9a3412;
		font-size: 0.8rem;
	}
	.inbox__body {
		margin: 0.5rem 0;
		white-space: pre-wrap;
		font: inherit;
		line-height: 1.45;
	}
	.inbox__btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.inbox__btns button {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.35rem 0.65rem;
		border: 1px solid rgb(30 41 59 / 0.25);
		background: #faf9f6;
		cursor: pointer;
	}
	.inbox__btns button:disabled {
		opacity: 0.5;
	}
	.inbox__empty {
		opacity: 0.7;
	}
</style>
