<script lang="ts">
	import { artworkRoute, ROUTES } from '$lib/constants/routes';
	import { currentUser } from '$lib/stores/network';
	import { formatPrice } from '$lib/utils/format';
	import type { AwaitingCollectionRow } from '$lib/types/purchases';

	let { data } = $props();
	const isVenue = $derived($currentUser.role === 'venue');

	let code = $state('');
	let busyId = $state<string | null>(null);
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let awaiting = $state<AwaitingCollectionRow[]>(data.awaiting ?? []);

	const digits = $derived(code.replace(/\D/g, '').slice(0, 6));
	const manualBusy = $derived(busyId === 'manual');

	function onCodeInput(event: Event): void {
		const raw = (event.currentTarget as HTMLInputElement).value;
		code = raw.replace(/\D/g, '').slice(0, 6);
	}

	function formatPaidAt(iso: string | null): string {
		if (!iso) return 'Paid - time unknown';
		return new Intl.DateTimeFormat('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));
	}

	async function release(body: { purchase_id?: string; code?: string }, label: string): Promise<void> {
		if (busyId) return;
		busyId = body.purchase_id ?? 'manual';
		errorMessage = null;
		message = null;
		try {
			const response = await fetch('/api/purchases/collect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				purchase?: { id: string; artwork_id: string };
			} | null;
			if (!response.ok) {
				errorMessage = payload?.message ?? 'Could not confirm collection';
				return;
			}
			const released = awaiting.find((row) => row.id === payload?.purchase?.id);
			message = `Released - ${released?.artwork_title ?? label} can leave with the buyer.`;
			code = '';
			awaiting = awaiting.filter((row) => row.id !== payload?.purchase?.id);
		} catch {
			errorMessage = 'Network error while confirming.';
		} finally {
			busyId = null;
		}
	}

	async function confirmFromList(row: AwaitingCollectionRow): Promise<void> {
		await release({ purchase_id: row.id }, row.artwork_title);
	}

	async function confirmManual(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (digits.length !== 6) return;
		await release({ code: digits }, 'Artwork');
	}
</script>

<section class="collect min-h-dvh bg-cream">
	<div class="collect__inner">
		<div class="collect__rule" aria-hidden="true"></div>
		<p class="collect__eyebrow">Venue · Handover</p>
		<h1 class="collect__title">Confirm collection</h1>

		{#if !isVenue}
			<p class="collect__guard">Sign in as a venue to confirm paid pickups.</p>
			<a class="collect__link" href={ROUTES.venue}>Venue hub</a>
		{:else}
			<p class="collect__intro">
				Paid works waiting for pickup. Staff can check the buyer's QR (no login). You confirm
				here to close the handover - match from this list or enter their 6-digit code.
			</p>

			{#if errorMessage}
				<p class="collect__error" role="alert">{errorMessage}</p>
			{/if}
			{#if message}
				<p class="collect__ok" role="status">{message}</p>
			{/if}

			<section class="lane" aria-label="Awaiting collection">
				<header class="lane__header">
					<h2 class="lane__title">Ready to release</h2>
					<p class="lane__copy">
						{awaiting.length === 0
							? 'No paid pickups waiting right now.'
							: `${awaiting.length} ${awaiting.length === 1 ? 'work' : 'works'} paid and waiting.`}
					</p>
				</header>

				{#if awaiting.length > 0}
					<ul class="awaiting">
						{#each awaiting as row (row.id)}
							<li>
								{#if row.artwork_image_url}
									<img src={row.artwork_image_url} alt="" />
								{:else}
									<div class="awaiting__ph" aria-hidden="true"></div>
								{/if}
								<div class="awaiting__body">
									<p class="awaiting__title">{row.artwork_title}</p>
									<p class="awaiting__artist">by {row.artist_name}</p>
									<p class="awaiting__meta">
										<span class="awaiting__when">{formatPaidAt(row.paid_at)}</span>
										<span aria-hidden="true">·</span>
										<span>{formatPrice(row.amount_pence)}</span>
									</p>
									{#if row.buyer_email}
										<p class="awaiting__buyer">Buyer · {row.buyer_email}</p>
									{/if}
									<p class="awaiting__code">
										Code <span>{row.pickup_code}</span>
									</p>
									<div class="awaiting__actions">
										<button
											type="button"
											class="awaiting__release"
											disabled={busyId !== null}
											onclick={() => confirmFromList(row)}
										>
											{busyId === row.id ? 'Releasing…' : 'Confirm painting & release'}
										</button>
										<a href={artworkRoute(row.artwork_id)}>Open door</a>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<details class="manual">
				<summary>Enter a code instead</summary>
				<form class="collect__form" onsubmit={confirmManual}>
					<label>
						<span>Pickup code</span>
						<input
							value={code}
							oninput={onCodeInput}
							inputmode="numeric"
							autocomplete="one-time-code"
							placeholder="000000"
							aria-describedby="collect-code-hint"
							required
						/>
					</label>
					<p id="collect-code-hint" class="collect__hint">
						Six digits from the buyer’s phone - if the list above is empty or out of date.
					</p>
					<button type="submit" disabled={manualBusy || digits.length !== 6}>
						{manualBusy ? 'Checking…' : 'Confirm & release'}
					</button>
				</form>
			</details>

			<nav class="collect__nav">
				<a href={ROUTES.venuePulse}>Scan pulse</a>
				<a href={ROUTES.venue}>Venue hub</a>
			</nav>
		{/if}
	</div>
</section>

<style>
	.collect {
		color: var(--color-indigo);
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3.5rem;
	}

	.collect__inner {
		width: min(100%, 34rem);
		margin: 0 auto;
	}

	.collect__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.collect__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.collect__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 2.6rem);
		font-weight: 500;
	}

	.collect__intro,
	.collect__guard {
		margin: 0.85rem 0 0;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.7);
	}

	.collect__form {
		display: grid;
		gap: 0.85rem;
		margin-top: 1rem;
	}

	.collect__form label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.collect__form input {
		font: inherit;
		font-size: 1.75rem;
		font-family: var(--font-display);
		font-weight: 500;
		letter-spacing: 0.35em;
		text-align: center;
		padding: 0.85rem 1rem;
		border: 1px solid rgb(30 41 59 / 0.16);
		background: white;
		color: var(--color-indigo);
	}

	.collect__form button,
	.awaiting__release {
		appearance: none;
		border: none;
		padding: 0.9rem 1.1rem;
		background: var(--color-burnt);
		color: var(--color-cream);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.collect__form button:disabled,
	.awaiting__release:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.collect__hint {
		margin: -0.35rem 0 0;
		font-size: 0.8rem;
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
		color: rgb(30 41 59 / 0.55);
	}

	.collect__error {
		margin: 1rem 0 0;
		color: #9a3412;
	}

	.collect__ok {
		margin: 1rem 0 0;
		color: rgb(30 41 59 / 0.75);
	}

	.lane {
		margin-top: 1.75rem;
	}

	.lane__title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 500;
	}

	.lane__copy {
		margin: 0.35rem 0 0;
		font-size: 0.9rem;
		color: rgb(30 41 59 / 0.55);
	}

	.awaiting {
		list-style: none;
		margin: 1.15rem 0 0;
		padding: 0;
		display: grid;
		gap: 1.25rem;
	}

	.awaiting li {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid rgb(30 41 59 / 0.12);
		background: rgb(250 249 246 / 0.85);
	}

	.awaiting img,
	.awaiting__ph {
		width: 5.5rem;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		background: var(--color-indigo);
	}

	.awaiting__title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 500;
		line-height: 1.2;
	}

	.awaiting__artist {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.65);
	}

	.awaiting__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.5rem;
		margin: 0.55rem 0 0;
		font-size: 0.8125rem;
		color: rgb(30 41 59 / 0.58);
	}

	.awaiting__when {
		font-weight: 600;
		color: rgb(30 41 59 / 0.75);
	}

	.awaiting__buyer {
		margin: 0.3rem 0 0;
		font-size: 0.75rem;
		color: rgb(30 41 59 / 0.5);
	}

	.awaiting__code {
		margin: 0.55rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		color: rgb(30 41 59 / 0.5);
	}

	.awaiting__code span {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		color: var(--color-ink, #0e181f);
	}

	.awaiting__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem 1.1rem;
		margin-top: 0.85rem;
	}

	.manual {
		margin-top: 2rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}

	.manual summary {
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.awaiting a,
	.collect__link,
	.collect__nav a {
		color: var(--color-burnt);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: none;
	}

	.collect__nav {
		display: flex;
		gap: 1.25rem;
		margin-top: 2.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}
</style>
