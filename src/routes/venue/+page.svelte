<script lang="ts">
	import { goto } from '$app/navigation';
	import { artworkRoute, ROUTES, roomRoute } from '$lib/constants/routes';
	import ArtworkQr from '$lib/components/qr/ArtworkQr.svelte';
	import { currentUser, venueActiveMatches } from '$lib/stores/network';
	import type { SimulatedVenueProfile } from '$lib/data/simulated-users';
	import { formatBalance } from '$lib/utils/format';

	let { data } = $props();

	const isVenue = $derived($currentUser.role === 'venue');
	const venue = $derived(isVenue ? ($currentUser as SimulatedVenueProfile) : null);
	const onMap = $derived(Boolean(data.venueIdentity?.on_map));
	const partnerStatus = $derived(data.partnerStatus as string | null);
	const needsActivation = $derived(partnerStatus === 'verified');
	let activateMsg = $state<string | null>(null);
	let activateBusy = $state(false);

	async function activatePartner(): Promise<void> {
		if (activateBusy) return;
		activateBusy = true;
		activateMsg = null;
		try {
			const response = await fetch('/api/venue/activate', { method: 'POST' });
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				activateMsg = payload?.message ?? 'Could not activate';
				return;
			}
			activateMsg = 'You’re live as an Art Hawks partner venue.';
			await goto(ROUTES.venue, { invalidateAll: true });
		} catch {
			activateMsg = 'Network error';
		} finally {
			activateBusy = false;
		}
	}
</script>

<section class="venue-dashboard min-h-dvh bg-cream">
	<div class="venue-dashboard__inner">
		<div class="venue-dashboard__rule" aria-hidden="true"></div>
		<p class="venue-dashboard__eyebrow">Venue</p>
		<h1 class="venue-dashboard__title">Your walls</h1>

		{#if !isVenue}
			<div class="identity-guard" role="status">
				<p class="identity-guard__copy">
					You are viewing as <strong>{$currentUser.full_name}</strong>. Switch to a venue identity
					in the header to manage your walls.
				</p>
				<a
					class="btn btn--secondary"
					href={$currentUser.role === 'buyer' ? ROUTES.discover : ROUTES.artist}
				>
					{$currentUser.role === 'buyer' ? 'Go to discover feed' : 'Go to artist studio'}
				</a>
			</div>
		{:else}
			<p class="venue-dashboard__intro">
				Welcome, <strong>{data.venueName ?? venue?.full_name}</strong>. Pin yourself on the map,
				match work that fits, hang it free, and earn 15% when a hung piece sells.
			</p>

			{#if needsActivation}
				<section class="map-callout" aria-label="Activate Art Hawks partnership">
					<p class="map-callout__eyebrow">Verified - not live yet</p>
					<h2 class="map-callout__title">Activate your Art Hawks venue</h2>
					<p class="map-callout__copy">
						Your profile is verified. When you’re ready to hang work and appear as a partner on the
						map, opt in below. Matching and hanging stay locked until then.
					</p>
					{#if !onMap}
						<p class="map-callout__copy">
							<a href={ROUTES.venueSettings}>Add your postcode</a> first so guests can find you.
						</p>
					{/if}
					<button
						type="button"
						class="btn btn--primary"
						disabled={activateBusy || !onMap}
						onclick={activatePartner}
					>
						{activateBusy ? 'Activating…' : 'Activate Art Hawks'}
					</button>
					{#if activateMsg}<p class="map-callout__copy">{activateMsg}</p>{/if}
				</section>
			{/if}

			<section class="venue-balance" aria-label="Venue sale balance">
				<p class="venue-balance__eyebrow">Wall earnings</p>
				<p class="venue-balance__value">{formatBalance(data.balance?.available_pence ?? 0)}</p>
				<p class="venue-balance__hint">
					Free to display. 15% when hung work sells on your walls. 5% finder’s fee for 30 days
					after a hang if the work isn’t at another venue. Lifetime
					{formatBalance(data.balance?.lifetime_pence ?? 0)}.
				</p>
			</section>

			{#if !onMap}
				<section class="map-callout" aria-label="Complete your venue identity">
					<p class="map-callout__eyebrow">Required for the city map</p>
					<h2 class="map-callout__title">Pin your venue</h2>
					<p class="map-callout__copy">
						Add your UK postcode and room details so artists and guests can find you on the map and
						open your public room.
					</p>
					<a class="btn btn--primary" href={ROUTES.venueSettings}>Set up venue identity</a>
				</section>
			{:else}
				<section class="map-status" aria-label="Map status">
					<p>
						On the map
						{#if data.venueIdentity?.postcode}
							· <strong>{data.venueIdentity.postcode}</strong>
						{/if}
					</p>
					<p class="map-status__links">
						<a href={ROUTES.venueSettings}>Edit identity & location</a>
						<span aria-hidden="true">·</span>
						<a href={roomRoute(data.venueId)}>Public room</a>
						<span aria-hidden="true">·</span>
						<a href={ROUTES.map}>City map</a>
					</p>
				</section>
			{/if}

			<nav class="venue-actions" aria-label="Venue curation modes">
				<a class="venue-action venue-action--primary" href={ROUTES.venueSettings}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Venue identity</span>
					<span class="venue-action__hint">Name, postcode, bio, and image for the map</span>
				</a>

				<a class="venue-action" href={ROUTES.venueCalendar}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Wall calendar</span>
					<span class="venue-action__hint">Rotations, busy periods, approvals</span>
				</a>

				<a class="venue-action" href={ROUTES.venueSwipe}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Browse & match</span>
					<span class="venue-action__hint">Swipe available local works</span>
				</a>

				<a class="venue-action" href={ROUTES.venueCurate}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Curate for me</span>
					<span class="venue-action__hint">Short brief: count, size, styles</span>
				</a>

				<a class="venue-action" href={ROUTES.venuePulse}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Wall activity</span>
					<span class="venue-action__hint">QR interest, condition, rotation nudges</span>
				</a>

				<a class="venue-action" href={ROUTES.venueCollect}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Confirm collection</span>
					<span class="venue-action__hint">Enter the buyer’s 6-digit pickup code</span>
				</a>

				<a class="venue-action" href={ROUTES.venuePromote}>
					<span class="venue-action__rule" aria-hidden="true"></span>
					<span class="venue-action__label">Print pack</span>
					<span class="venue-action__hint">QR codes and artist notes for the wall</span>
				</a>
			</nav>

			{#if $venueActiveMatches.length > 0}
				<section class="active-matches" aria-label="Our Active Matches">
					<h2 class="active-matches__title">Active interests</h2>
					<p class="active-matches__intro">
						Works you’ve shown interest in. Print a QR for each wall when delivery lands.
					</p>
					<ul class="active-matches__list">
						{#each $venueActiveMatches as row (row.match.id)}
							<li class="active-match">
								<div class="active-match__rule" aria-hidden="true"></div>
								<div class="active-match__copy">
									<p class="active-match__artwork">{row.artwork?.title}</p>
									<p class="active-match__artist">by {row.artistName}</p>
									<p class="active-match__status">
										{row.match.status === 'accepted'
											? 'Matched - awaiting delivery.'
											: 'Interested - awaiting artist confirmation.'}
									</p>
									{#if row.artwork}
										<a class="active-match__link" href={artworkRoute(row.artwork.id)}>
											Open public page
										</a>
									{/if}
								</div>
								{#if row.artwork}
									<div class="active-match__qr">
										<ArtworkQr
											artworkId={row.artwork.id}
											size={108}
											compact
											caption="Wall QR"
										/>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}

		<a class="venue-dashboard__back" href="/">Back to gateway</a>
	</div>
</section>

<style>
	.venue-dashboard {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 2.5rem;
		color: var(--color-indigo);
		background: var(--color-cream);
	}

	.venue-dashboard__inner {
		width: min(100%, 36rem);
		margin: 0 auto;
	}

	.venue-dashboard__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.venue-dashboard__eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.venue-dashboard__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.03em;
	}

	.venue-dashboard__intro {
		margin: 1rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.venue-balance {
		margin-top: 1.35rem;
		padding: 1.1rem 1.15rem;
		border: 1px solid rgb(194 65 12 / 0.22);
		background: linear-gradient(165deg, rgb(255 247 237 / 0.95), rgb(250 249 246 / 0.85));
	}

	.venue-balance__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.venue-balance__value {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.6rem, 4vw, 2rem);
		font-weight: 500;
		color: #1e293b;
	}

	.venue-balance__hint {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.55);
	}

	.map-callout {
		margin-top: 1.75rem;
		padding: 1.35rem 1.25rem;
		border: 1px solid rgb(194 65 12 / 0.35);
		background: rgb(194 65 12 / 0.07);
	}

	.map-callout__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.map-callout__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.45rem;
		font-weight: 500;
	}

	.map-callout__copy {
		margin: 0.65rem 0 1.1rem;
		max-width: 40ch;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.72);
	}

	.map-status {
		margin-top: 1.5rem;
		padding: 1rem 0;
		border-top: 1px solid rgb(30 41 59 / 0.08);
		font-size: 0.9rem;
		color: rgb(30 41 59 / 0.7);
	}

	.map-status p {
		margin: 0;
	}

	.map-status__links {
		margin-top: 0.45rem !important;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.65rem;
		font-size: 0.8rem;
	}

	.map-status__links a {
		color: var(--color-burnt);
		text-decoration: none;
		font-weight: 600;
	}

	.identity-guard {
		margin-top: 2rem;
		padding-top: 0.5rem;
	}

	.identity-guard__copy {
		margin: 0 0 1.25rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
		max-width: 36ch;
	}

	.venue-profile {
		margin-top: 2.25rem;
		padding-top: 1.75rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.venue-profile__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.venue-profile__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.35rem;
		font-weight: 500;
	}

	.venue-profile__form {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.field {
		display: grid;
		gap: 0.35rem;
	}

	.field__label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.field__input {
		width: 100%;
		padding: 0.7rem 0;
		border: none;
		border-bottom: 1px solid rgb(30 41 59 / 0.18);
		background: transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		color: var(--color-indigo);
	}

	.field__textarea {
		resize: vertical;
		min-height: 4.5rem;
	}

	.venue-profile__ok {
		margin: 0;
		font-size: 0.8125rem;
		color: #3f6212;
	}

	.venue-profile__error {
		margin: 0;
		font-size: 0.8125rem;
		color: #9a3412;
	}

	.venue-actions {
		display: grid;
		gap: 0.85rem;
		margin-top: 2rem;
	}

	.venue-action {
		display: grid;
		gap: 0.45rem;
		padding: 1.2rem 1.25rem;
		border: 1px solid rgb(30 41 59 / 0.12);
		background: rgb(250 249 246 / 0.7);
		text-decoration: none;
		color: inherit;
		text-align: left;
		transition:
			border-color 180ms ease,
			background-color 180ms ease;
	}

	.venue-action:hover {
		border-color: rgb(30 41 59 / 0.22);
		background: rgb(30 41 59 / 0.03);
	}

	.venue-action--primary {
		border-color: rgb(194 65 12 / 0.35);
	}

	.venue-action__rule {
		width: 1.75rem;
		height: 2px;
		background: var(--color-burnt);
	}

	.venue-action__label {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.2rem;
	}

	.venue-action__hint {
		font-size: 0.8125rem;
		color: rgb(30 41 59 / 0.55);
	}

	.active-matches {
		margin-top: 2.5rem;
		padding-top: 1.75rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.active-matches__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.35rem;
		font-weight: 500;
	}

	.active-matches__intro {
		margin: 0.65rem 0 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.58);
	}

	.active-matches__list {
		display: grid;
		gap: 1rem;
		margin: 1.25rem 0 0;
		padding: 0;
		list-style: none;
	}

	.active-match {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: start;
	}

	.active-match__rule {
		grid-column: 1 / -1;
		width: 1.75rem;
		height: 2px;
		background: var(--color-burnt);
	}

	.active-match__artwork {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
	}

	.active-match__artist,
	.active-match__status {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: rgb(30 41 59 / 0.55);
	}

	.active-match__link {
		display: inline-block;
		margin-top: 0.55rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.venue-dashboard__back {
		display: inline-block;
		margin-top: 2rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
		text-decoration: none;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0 1.2rem;
		border: 1px solid transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
		justify-self: start;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn--primary {
		background: var(--color-burnt);
		border-color: var(--color-burnt);
		color: var(--color-cream);
	}

	.btn--secondary {
		background: transparent;
		border-color: rgb(30 41 59 / 0.2);
		color: var(--color-indigo);
	}
</style>
