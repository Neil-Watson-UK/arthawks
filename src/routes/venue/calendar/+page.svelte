<script lang="ts">
	import { WALL_REQUEST_TEMPLATES } from '$lib/constants/wall-templates';
	import { artworkRoute, ROUTES } from '$lib/constants/routes';
	import { artworkImageUrl } from '$lib/data/mock-artists';
	import { currentUser } from '$lib/stores/network';
	import {
		approveHang,
		blockBusyPeriod,
		createProposal,
		markHungOnWall,
		removeBusyPeriod,
		updateSlotLabel,
		venueCalendar
	} from '$lib/stores/rotations';
	import type { SimulatedVenueProfile } from '$lib/data/simulated-users';
	import { goto } from '$app/navigation';

	const isVenue = $derived($currentUser.role === 'venue');
	const venue = $derived(isVenue ? ($currentUser as SimulatedVenueProfile) : null);
	const calendar = $derived($venueCalendar);

	let busyStart = $state('');
	let busyEnd = $state('');
	let busyReason = $state('');
	let busyError = $state<string | null>(null);
	let approvingId = $state<string | null>(null);
	let hangingId = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let hangNote = $state<string | null>(null);
	let requestTemplate = $state(WALL_REQUEST_TEMPLATES[0]?.id ?? '');
	let requestArtistId = $state('a0000000-0000-4000-8000-000000000001');
	let requestArtworkId = $state('b0000000-0000-4000-8000-000000000001');
	let requestMessage = $state<string | null>(null);

	function formatDay(day: string): string {
		return new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(`${day}T12:00:00`));
	}

	async function onApprove(matchId: string): Promise<void> {
		if (approvingId || hangingId) return;
		approvingId = matchId;
		actionError = null;
		hangNote = null;
		try {
			await approveHang(matchId);
			hangNote = 'Hang scheduled - mark Hung on wall when it’s up.';
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Could not approve hang';
		} finally {
			approvingId = null;
		}
	}

	async function onHung(matchId: string): Promise<void> {
		if (approvingId || hangingId) return;
		hangingId = matchId;
		actionError = null;
		hangNote = null;
		try {
			const result = await markHungOnWall(matchId);
			hangNote = 'Live on the walls - print the QR label for the door.';
			await goto(result.door_path);
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Could not mark hung on wall';
		} finally {
			hangingId = null;
		}
	}

	async function onRequestMood(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!venue) return;
		requestMessage = null;
		try {
			await createProposal({
				from_profile_id: venue.id,
				to_profile_id: requestArtistId,
				artwork_id: requestArtworkId,
				proposal_type: 'mood',
				template_id: requestTemplate
			});
			requestMessage = 'Mood/size request sent to the artist inbox.';
		} catch (err) {
			requestMessage = err instanceof Error ? err.message : 'Could not send request';
		}
	}

	async function onBlockBusy(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!venue) return;
		busyError = null;
		if (!busyStart || !busyEnd) {
			busyError = 'Choose a start and end date.';
			return;
		}
		if (busyEnd < busyStart) {
			busyError = 'End date must be on or after the start.';
			return;
		}
		try {
			await blockBusyPeriod({
				venue_id: venue.id,
				starts_on: busyStart,
				ends_on: busyEnd,
				reason: busyReason
			});
			busyStart = '';
			busyEnd = '';
			busyReason = '';
		} catch (err) {
			busyError = err instanceof Error ? err.message : 'Could not block period';
		}
	}
</script>

<section class="calendar min-h-dvh bg-cream">
	<div class="calendar__inner">
		<div class="calendar__rule" aria-hidden="true"></div>
		<p class="calendar__eyebrow">Venue · Rotations</p>
		<h1 class="calendar__title">Wall calendar</h1>

		{#if !isVenue}
			<p class="calendar__guard">
				Switch to a venue identity to see rotation slots and busy periods.
			</p>
			<a class="calendar__link" href={ROUTES.venue}>Back to venue hub</a>
		{:else}
			<p class="calendar__intro">
				Schedule a hang, then mark it hung when the work is on the wall - that turns the room live
				and opens the QR label.
			</p>

			{#if calendar.reminders.length > 0}
				<section class="reminders" aria-label="Reminders">
					<p class="reminders__eyebrow">Gentle nudges</p>
					<ul class="reminders__list">
						{#each calendar.reminders as row (row.slot.match_id)}
							<li>
								<span>{row.artwork?.title}</span>
								<span class="reminders__note">{row.nudge}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if actionError}
				<p class="calendar__error" role="alert">{actionError}</p>
			{/if}
			{#if hangNote}
				<p class="calendar__ok" role="status">{hangNote}</p>
			{/if}

			<section class="lane" aria-label="Awaiting approval">
				<header class="lane__header">
					<h2 class="lane__title">Awaiting approval</h2>
					<p class="lane__copy">Interested works ready for a hang date.</p>
				</header>
				{#if calendar.awaitingApproval.length === 0}
					<p class="lane__empty">Nothing waiting - curate or swipe to fill the walls.</p>
				{:else}
					<ul class="slots">
						{#each calendar.awaitingApproval as row (row.slot.match_id)}
							<li class="slot">
								{#if row.artwork}
									<img
										class="slot__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div class="slot__body">
									<p class="slot__title">{row.artwork?.title}</p>
									<p class="slot__meta">
										{row.artistName}
										<span aria-hidden="true">·</span>
										Install from {formatDay(row.slot.starts_on)}
										<span aria-hidden="true">·</span>
										{row.slot.install_buffer_hours}h buffer
									</p>
									<label class="slot__label">
										<span>Wall</span>
										<input
											type="text"
											value={row.slot.wall_label ?? ''}
											placeholder="e.g. East wall"
											oninput={(event) =>
												updateSlotLabel(
													row.slot.match_id,
													(event.currentTarget as HTMLInputElement).value
												)}
										/>
									</label>
									<div class="slot__actions">
										<button
											type="button"
											class="btn"
											disabled={approvingId === row.slot.match_id ||
												hangingId === row.slot.match_id}
											onclick={() => onApprove(row.slot.match_id)}
										>
											{approvingId === row.slot.match_id ? 'Approving…' : 'Approve hang'}
										</button>
										<button
											type="button"
											class="btn btn--solid"
											disabled={approvingId === row.slot.match_id ||
												hangingId === row.slot.match_id}
											onclick={() => onHung(row.slot.match_id)}
										>
											{hangingId === row.slot.match_id ? 'Marking…' : 'Hung on wall'}
										</button>
										{#if row.artwork}
											<a href={artworkRoute(row.artwork.id)}>Open door</a>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Ready to hang">
				<header class="lane__header">
					<h2 class="lane__title">Ready to hang</h2>
					<p class="lane__copy">Approved - mark hung when the piece is on the wall to go live.</p>
				</header>
				{#if calendar.readyToHang.length === 0}
					<p class="lane__empty">No scheduled hangs waiting for install.</p>
				{:else}
					<ul class="slots">
						{#each calendar.readyToHang as row (row.slot.match_id)}
							<li class="slot">
								{#if row.artwork}
									<img
										class="slot__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div class="slot__body">
									<p class="slot__title">{row.artwork?.title}</p>
									<p class="slot__meta">
										{row.slot.wall_label ?? 'Wall'}
										<span aria-hidden="true">·</span>
										{formatDay(row.slot.starts_on)} - {formatDay(row.slot.ends_on)}
									</p>
									{#if row.nudge}
										<p class="slot__nudge">{row.nudge}</p>
									{/if}
									<div class="slot__actions">
										<button
											type="button"
											class="btn btn--solid"
											disabled={hangingId === row.slot.match_id}
											onclick={() => onHung(row.slot.match_id)}
										>
											{hangingId === row.slot.match_id ? 'Marking…' : 'Hung on wall'}
										</button>
										{#if row.artwork}
											<a href={artworkRoute(row.artwork.id)}>Open door / print QR</a>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Currently showing">
				<header class="lane__header">
					<h2 class="lane__title">On the walls now</h2>
					<p class="lane__copy">Hung works live in the city gallery.</p>
				</header>
				{#if calendar.current.length === 0}
					<p class="lane__empty">No works marked hung yet.</p>
				{:else}
					<ul class="slots">
						{#each calendar.current as row (row.slot.match_id)}
							<li class="slot">
								{#if row.artwork}
									<img
										class="slot__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div class="slot__body">
									<p class="slot__title">{row.artwork?.title}</p>
									<p class="slot__meta">
										{row.slot.wall_label ?? 'Wall'}
										<span aria-hidden="true">·</span>
										{formatDay(row.slot.starts_on)} - {formatDay(row.slot.ends_on)}
										<span aria-hidden="true">·</span>
										{row.scanCount} scans
									</p>
									{#if row.nudge}
										<p class="slot__nudge">{row.nudge}</p>
									{/if}
									{#if row.artwork}
										<div class="slot__actions">
											<a href={artworkRoute(row.artwork.id)}>Print QR label</a>
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Upcoming swaps">
				<header class="lane__header">
					<h2 class="lane__title">Upcoming</h2>
					<p class="lane__copy">Scheduled installs and future rotations.</p>
				</header>
				{#if calendar.upcoming.length === 0}
					<p class="lane__empty">No future slots yet.</p>
				{:else}
					<ul class="slots">
						{#each calendar.upcoming as row (row.slot.match_id)}
							<li class="slot slot--compact">
								<div class="slot__body">
									<p class="slot__title">{row.artwork?.title}</p>
									<p class="slot__meta">
										Arrives {formatDay(row.slot.starts_on)} · until {formatDay(row.slot.ends_on)}
									</p>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="request" aria-label="Request a mood">
				<header class="lane__header">
					<h2 class="lane__title">Request a mood</h2>
					<p class="lane__copy">
						Ask an artist with a shared template - e.g. warm abstract, 80×100cm, east wall.
					</p>
				</header>
				<form class="busy__form" onsubmit={onRequestMood}>
					<label>
						<span>Template</span>
						<select bind:value={requestTemplate}>
							{#each WALL_REQUEST_TEMPLATES as template (template.id)}
								<option value={template.id}>{template.label}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Artist</span>
						<select bind:value={requestArtistId}>
							<option value="a0000000-0000-4000-8000-000000000001">Neil Watson</option>
							<option value="a0000000-0000-4000-8000-000000000002">Elena Voss</option>
						</select>
					</label>
					<label>
						<span>Anchor artwork</span>
						<select bind:value={requestArtworkId}>
							<option value="b0000000-0000-4000-8000-000000000001">Bridge of Gert Sighs</option>
							<option value="b0000000-0000-4000-8000-000000000004">Signal Collage No. 7</option>
							<option value="b0000000-0000-4000-8000-000000000005">Quiet Geometry</option>
						</select>
					</label>
					{#if requestMessage}
						<p class="calendar__ok" role="status">{requestMessage}</p>
					{/if}
					<button class="btn" type="submit">Send request</button>
				</form>
			</section>

			<section class="busy" aria-label="Busy periods">
				<header class="lane__header">
					<h2 class="lane__title">Busy periods</h2>
					<p class="lane__copy">Block holidays and closures so installs skip those days.</p>
				</header>

				{#if calendar.busy.length > 0}
					<ul class="busy__list">
						{#each calendar.busy as period (period.id)}
							<li>
								<div>
									<p class="busy__dates">
										{formatDay(period.starts_on)} - {formatDay(period.ends_on)}
									</p>
									{#if period.reason}
										<p class="busy__reason">{period.reason}</p>
									{/if}
								</div>
								<button type="button" class="busy__remove" onclick={() => removeBusyPeriod(period.id)}>
									Remove
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				<form class="busy__form" onsubmit={onBlockBusy}>
					<label>
						<span>From</span>
						<input type="date" bind:value={busyStart} required />
					</label>
					<label>
						<span>To</span>
						<input type="date" bind:value={busyEnd} required />
					</label>
					<label class="busy__reason-field">
						<span>Reason</span>
						<input type="text" bind:value={busyReason} placeholder="Holiday, private hire…" />
					</label>
					{#if busyError}
						<p class="calendar__error" role="alert">{busyError}</p>
					{/if}
					<button class="btn" type="submit">Block period</button>
				</form>
			</section>

			<nav class="calendar__nav">
				<a href={ROUTES.venue}>Venue hub</a>
				<a href={ROUTES.venuePulse}>Scan pulse</a>
				<a href={ROUTES.venueCurate}>Curate for Me</a>
			</nav>
		{/if}
	</div>
</section>

<style>
	.calendar {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
		color: var(--color-indigo);
	}

	.calendar__inner {
		width: min(100%, 40rem);
		margin: 0 auto;
	}

	.calendar__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.calendar__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.calendar__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(2rem, 6vw, 2.75rem);
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.calendar__intro,
	.calendar__guard {
		margin: 1rem 0 0;
		max-width: 38ch;
		font-size: 1.05rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.7);
	}

	.calendar__error {
		margin: 1rem 0 0;
		color: #9a3412;
		font-size: 0.875rem;
	}

	.calendar__ok {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-burnt);
	}

	.request {
		margin-top: 2.5rem;
	}

	.busy__form select {
		font: inherit;
		letter-spacing: normal;
		text-transform: none;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgb(30 41 59 / 0.15);
		background: #fff;
		color: var(--color-indigo);
	}

	.calendar__link,
	.calendar__nav a,
	.slot__actions a {
		color: var(--color-burnt);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.reminders {
		margin-top: 2rem;
		padding: 1rem 0;
		border-top: 1px solid rgb(30 41 59 / 0.1);
		border-bottom: 1px solid rgb(30 41 59 / 0.1);
	}

	.reminders__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.reminders__list {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
	}

	.reminders__list li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		justify-content: space-between;
		font-size: 0.9rem;
	}

	.reminders__note {
		color: rgb(30 41 59 / 0.55);
	}

	.lane,
	.busy {
		margin-top: 2.5rem;
	}

	.lane__header {
		margin-bottom: 1rem;
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

	.slots,
	.busy__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1.15rem;
	}

	.slot {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.9rem;
		padding-bottom: 1.15rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.slot--compact {
		grid-template-columns: 1fr;
	}

	.slot__thumb {
		width: 4.5rem;
		height: 5.5rem;
		object-fit: cover;
		background: var(--color-indigo);
	}

	.slot__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
	}

	.slot__meta {
		margin: 0.3rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.slot__nudge {
		margin: 0.45rem 0 0;
		font-size: 0.85rem;
		color: var(--color-burnt);
	}

	.slot__label {
		display: grid;
		gap: 0.25rem;
		margin-top: 0.65rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.slot__label input,
	.busy__form input {
		font: inherit;
		letter-spacing: normal;
		text-transform: none;
		padding: 0.45rem 0.55rem;
		border: 1px solid rgb(30 41 59 / 0.15);
		background: #fff;
		color: var(--color-indigo);
	}

	.slot__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem;
		margin-top: 0.75rem;
	}

	.btn {
		appearance: none;
		border: none;
		padding: 0.65rem 1rem;
		background: var(--color-indigo);
		color: var(--color-cream);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.btn--solid {
		background: var(--color-burnt);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.busy__list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.busy__dates {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
	}

	.busy__reason {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.busy__remove {
		appearance: none;
		border: none;
		background: none;
		color: rgb(30 41 59 / 0.45);
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.busy__form {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.busy__form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.calendar__nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		margin-top: 2.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}
</style>
