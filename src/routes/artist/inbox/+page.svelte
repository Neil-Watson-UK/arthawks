<script lang="ts">
	import { WALL_REQUEST_TEMPLATES } from '$lib/constants/wall-templates';
	import { artworkRoute, ROUTES } from '$lib/constants/routes';
	import { artworkImageUrl } from '$lib/data/mock-artists';
	import { currentUser } from '$lib/stores/network';
	import {
		artistConfirmInterest,
		artistDeclineInterest,
		artistInbox,
		createProposal,
		resolveProposal
	} from '$lib/stores/rotations';

	const isArtist = $derived($currentUser.role === 'artist');
	const inbox = $derived($artistInbox);

	let busyId = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let selectedTemplate = $state(WALL_REQUEST_TEMPLATES[0]?.id ?? '');
	let proposeForMatch = $state<string | null>(null);

	async function confirm(matchId: string): Promise<void> {
		busyId = matchId;
		errorMessage = null;
		try {
			await artistConfirmInterest(matchId);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not confirm';
		} finally {
			busyId = null;
		}
	}

	async function decline(matchId: string): Promise<void> {
		busyId = matchId;
		errorMessage = null;
		try {
			await artistDeclineInterest(matchId);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not decline';
		} finally {
			busyId = null;
		}
	}

	async function proposeSwap(matchId: string, venueId: string, artworkId: string): Promise<void> {
		if (!$currentUser || $currentUser.role !== 'artist') return;
		busyId = matchId;
		errorMessage = null;
		try {
			await createProposal({
				from_profile_id: $currentUser.id,
				to_profile_id: venueId,
				artwork_id: artworkId,
				match_id: matchId,
				proposal_type: 'swap',
				template_id: selectedTemplate,
				message: `Swap proposal: ${WALL_REQUEST_TEMPLATES.find((t) => t.id === selectedTemplate)?.message ?? ''}`
			});
			proposeForMatch = null;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not send proposal';
		} finally {
			busyId = null;
		}
	}

	function formatDay(iso: string | undefined): string {
		if (!iso) return 'TBC';
		return new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'short'
		}).format(new Date(`${iso}T12:00:00`));
	}
</script>

<section class="inbox min-h-dvh bg-cream">
	<div class="inbox__inner">
		<div class="inbox__rule" aria-hidden="true"></div>
		<p class="inbox__eyebrow">Artist · Co-ownership</p>
		<h1 class="inbox__title">Match inbox</h1>

		{#if !isArtist}
			<p class="inbox__guard">Switch to an artist identity to confirm venue interests and propose swaps.</p>
			<a class="inbox__link" href={ROUTES.artist}>Back to studio</a>
		{:else}
			<p class="inbox__intro">
				See door traffic on your walls - scans, loves, buy asks - and confirm venue interests.
			</p>

			{#if errorMessage}
				<p class="inbox__error" role="alert">{errorMessage}</p>
			{/if}

			<section class="lane" aria-label="Wall pulse">
				<header class="lane__header">
					<h2 class="lane__title">Wall pulse</h2>
					<p class="lane__copy">How often people open your work from the room QR.</p>
				</header>

				<div class="pulse-stats" aria-label="Scan totals">
					<div class="pulse-stats__item">
						<span class="pulse-stats__value">{inbox.totals.scansWeek}</span>
						<span class="pulse-stats__label">Scans · 7 days</span>
					</div>
					<div class="pulse-stats__item">
						<span class="pulse-stats__value">{inbox.totals.scans}</span>
						<span class="pulse-stats__label">Scans · all</span>
					</div>
					<div class="pulse-stats__item">
						<span class="pulse-stats__value">{inbox.totals.loves}</span>
						<span class="pulse-stats__label">Loves</span>
					</div>
					<div class="pulse-stats__item">
						<span class="pulse-stats__value">{inbox.totals.buyAsks}</span>
						<span class="pulse-stats__label">Buy asks</span>
					</div>
					<div class="pulse-stats__item">
						<span class="pulse-stats__value">{inbox.totals.live}</span>
						<span class="pulse-stats__label">Live now</span>
					</div>
				</div>

				{#if inbox.wallPulse.length === 0}
					<p class="lane__empty">No wall traffic yet - when a venue hangs your work, scans land here.</p>
				{:else}
					<ul class="cards">
						{#each inbox.wallPulse as row (row.artwork.id)}
							<li class="card">
								{#if row.artwork}
									<img
										class="card__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div class="card__body">
									<p class="card__title">{row.artwork?.title ?? 'Artwork'}</p>
									<p class="card__meta">
										{#if row.live}
											<span class="card__live">Live</span>
											<span aria-hidden="true">·</span>
										{/if}
										{row.scansWeek} this week
										<span aria-hidden="true">·</span>
										{row.scanCount} all
										<span aria-hidden="true">·</span>
										{row.loves} loves
										<span aria-hidden="true">·</span>
										{row.buyAsks} buy asks
										{#if row.venueName}
											<span aria-hidden="true">·</span>
											{row.venueName}
										{/if}
									</p>
									{#if row.artwork}
										<a href={artworkRoute(row.artwork.id)}>Open door</a>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Door interest">
				<header class="lane__header">
					<h2 class="lane__title">Door interest</h2>
					<p class="lane__copy">Loves and buy asks from people who opened your work.</p>
				</header>

				{#if inbox.doorInterest.length === 0}
					<p class="lane__empty">No door signals yet - hang a piece and share the wall QR.</p>
				{:else}
					<ul class="cards">
						{#each inbox.doorInterest as row (row.scan.id)}
							<li class="card">
								{#if row.artwork}
									<img
										class="card__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div class="card__body">
									<p class="card__title">{row.artwork?.title ?? 'Artwork'}</p>
									<p class="card__meta">
										{row.scan.interest_level === 'buy_ask' ? 'Buy ask' : 'Love'}
										{#if row.venueName}
											<span aria-hidden="true">·</span>
											{row.venueName}
										{/if}
										<span aria-hidden="true">·</span>
										{formatDay(row.scan.scanned_at.slice(0, 10))}
									</p>
									{#if row.artwork}
										<a href={artworkRoute(row.artwork.id)}>Open door</a>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Pending venue interest">
				<header class="lane__header">
					<h2 class="lane__title">Venue interest</h2>
					<p class="lane__copy">One-click confirmations close the mutual match loop.</p>
				</header>

				{#if inbox.pending.length === 0}
					<p class="lane__empty">No pending interests right now.</p>
				{:else}
					<ul class="cards">
						{#each inbox.pending as row (row.match.id)}
							<li class="card">
								{#if row.artwork}
									<img
										class="card__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div class="card__body">
									<p class="card__title">{row.artwork?.title}</p>
									<p class="card__meta">
										{row.venueName}
										{#if row.slot}
											<span aria-hidden="true">·</span>
											Suggested install {formatDay(row.slot.starts_on)}
										{/if}
									</p>

									<div class="card__actions">
										<button
											type="button"
											class="btn"
											disabled={busyId === row.match.id}
											onclick={() => confirm(row.match.id)}
										>
											Confirm hang
										</button>
										<button
											type="button"
											class="btn btn--ghost"
											disabled={busyId === row.match.id}
											onclick={() => decline(row.match.id)}
										>
											Decline
										</button>
										<button
											type="button"
											class="btn btn--ghost"
											onclick={() =>
												(proposeForMatch = proposeForMatch === row.match.id ? null : row.match.id)}
										>
											Propose swap
										</button>
										{#if row.artwork}
											<a href={artworkRoute(row.artwork.id)}>Open door</a>
										{/if}
									</div>

									{#if proposeForMatch === row.match.id && row.artwork}
										<div class="propose">
											<label>
												<span>Template</span>
												<select bind:value={selectedTemplate}>
													{#each WALL_REQUEST_TEMPLATES as template (template.id)}
														<option value={template.id}>{template.label}</option>
													{/each}
												</select>
											</label>
											<p class="propose__preview">
												{WALL_REQUEST_TEMPLATES.find((t) => t.id === selectedTemplate)?.message}
											</p>
											<button
												type="button"
												class="btn"
												disabled={busyId === row.match.id}
												onclick={() =>
													proposeSwap(row.match.id, row.match.venue_id, row.artwork!.id)}
											>
												Send proposal
											</button>
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Proposals">
				<header class="lane__header">
					<h2 class="lane__title">Proposals</h2>
					<p class="lane__copy">Swaps and mood/size requests between you and venues.</p>
				</header>

				{#if inbox.proposals.length === 0}
					<p class="lane__empty">No proposals yet.</p>
				{:else}
					<ul class="proposals">
						{#each inbox.proposals as proposal (proposal.id)}
							<li>
								<p class="proposals__type">{proposal.proposal_type}</p>
								{#if proposal.message}
									<p class="proposals__message">{proposal.message}</p>
								{/if}
								<p class="proposals__status">{proposal.status}</p>
								{#if proposal.status === 'open' && proposal.to_profile_id === $currentUser.id}
									<div class="card__actions">
										<button
											type="button"
											class="btn"
											onclick={() => resolveProposal(proposal.id, 'accepted')}
										>
											Accept
										</button>
										<button
											type="button"
											class="btn btn--ghost"
											onclick={() => resolveProposal(proposal.id, 'declined')}
										>
											Decline
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<nav class="inbox__nav">
				<a href={ROUTES.artist}>Studio</a>
				<a href={ROUTES.artistPromote}>Promotion packs</a>
			</nav>
		{/if}
	</div>
</section>

<style>
	.inbox {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
		color: var(--color-indigo);
	}

	.inbox__inner {
		width: min(100%, 40rem);
		margin: 0 auto;
	}

	.inbox__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.inbox__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.inbox__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(2rem, 6vw, 2.75rem);
		font-weight: 500;
	}

	.inbox__intro,
	.inbox__guard {
		margin: 1rem 0 0;
		max-width: 40ch;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.7);
	}

	.inbox__error {
		margin: 1rem 0 0;
		color: #9a3412;
	}

	.inbox__link,
	.inbox__nav a,
	.card__actions a {
		color: var(--color-burnt);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.lane {
		margin-top: 2.5rem;
	}

	.lane__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.45rem;
		font-weight: 500;
	}

	.lane__copy,
	.lane__empty {
		margin: 0.35rem 0 0;
		font-size: 0.9rem;
		color: rgb(30 41 59 / 0.55);
	}

	.pulse-stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: 0.65rem;
		margin-top: 1.1rem;
	}

	.pulse-stats__item {
		padding: 0.75rem 0.8rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		background: rgb(250 249 246 / 0.85);
	}

	.pulse-stats__value {
		display: block;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.55rem;
		font-weight: 500;
		line-height: 1;
	}

	.pulse-stats__label {
		display: block;
		margin-top: 0.35rem;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.card__live {
		color: var(--color-burnt);
		font-weight: 700;
	}

	.cards,
	.proposals {
		list-style: none;
		margin: 1.15rem 0 0;
		padding: 0;
		display: grid;
		gap: 1.25rem;
	}

	.card {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.9rem;
		padding-bottom: 1.15rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.card__thumb {
		width: 4.5rem;
		height: 5.5rem;
		object-fit: cover;
		background: var(--color-indigo);
	}

	.card__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
	}

	.card__meta {
		margin: 0.3rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.card__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.75rem;
	}

	.btn {
		appearance: none;
		border: none;
		padding: 0.6rem 0.9rem;
		background: var(--color-indigo);
		color: var(--color-cream);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.btn--ghost {
		background: transparent;
		color: var(--color-indigo);
		border: 1px solid rgb(30 41 59 / 0.2);
	}

	.propose {
		margin-top: 0.85rem;
		display: grid;
		gap: 0.65rem;
	}

	.propose label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.propose select {
		font: inherit;
		text-transform: none;
		letter-spacing: normal;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgb(30 41 59 / 0.15);
		background: #fff;
	}

	.propose__preview {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-style: italic;
		font-size: 0.95rem;
		color: rgb(30 41 59 / 0.7);
	}

	.proposals li {
		padding-bottom: 1rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.proposals__type {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.proposals__message {
		margin: 0.4rem 0 0;
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.proposals__status {
		margin: 0.35rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.inbox__nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		margin-top: 2.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}
</style>
