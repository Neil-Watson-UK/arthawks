<script lang="ts">
	import ShareActions from '$lib/components/share/ShareActions.svelte';
	import { artworkRoute, ROUTES } from '$lib/constants/routes';
	import { artworkImageUrl } from '$lib/data/mock-artists';
	import { currentUser } from '$lib/stores/network';
	import { venuePulse } from '$lib/stores/rotations';

	const isVenue = $derived($currentUser.role === 'venue');
	const pulse = $derived($venuePulse);

	function formatTime(iso: string): string {
		return new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));
	}

	function interestLabel(level: string | null): string {
		if (level === 'buy_ask') return 'Buy ask';
		if (level === 'love') return 'Love';
		return level ?? 'Browse';
	}
</script>

<section class="pulse min-h-dvh bg-cream">
	<div class="pulse__inner">
		<div class="pulse__rule" aria-hidden="true"></div>
		<p class="pulse__eyebrow">Venue · QR pulse</p>
		<h1 class="pulse__title">Scan pulse</h1>

		{#if !isVenue}
			<p class="pulse__guard">Switch to a venue identity to read wall QR analytics.</p>
			<a class="pulse__link" href={ROUTES.venue}>Back to venue hub</a>
		{:else}
			<p class="pulse__intro">
				Every scan on a wall QR logs interest and condition. Share this week’s room - and sense when a
				rotation would serve the space.
			</p>

			{#if pulse.thisWeek}
				<section class="week" aria-label="This week’s room">
					<p class="week__eyebrow">Marketing · Share</p>
					<h2 class="week__title">This week’s room</h2>
					<p class="week__copy">
						{pulse.thisWeek.works.length}
						{pulse.thisWeek.works.length === 1 ? 'work' : 'works'} live
						<span aria-hidden="true">·</span>
						{pulse.thisWeek.scans} scans
						<span aria-hidden="true">·</span>
						{pulse.thisWeek.loves} loves
						<span aria-hidden="true">·</span>
						{pulse.thisWeek.buyAsks} buy asks
					</p>
					<ul class="week__works">
						{#each pulse.thisWeek.works as work (work.id)}
							<li>{work.title}</li>
						{/each}
					</ul>
					<ShareActions
						path={pulse.thisWeek.path}
						title={pulse.thisWeek.title}
						text={pulse.thisWeek.shareText}
						class="week__share"
					/>
				</section>
			{/if}

			<p class="pulse__census">
				<span>{pulse.byArtwork.reduce((sum, row) => sum + row.scanCount, 0)} scans</span>
				<span aria-hidden="true">·</span>
				<span>{pulse.nudgeCount} rotation nudges</span>
			</p>

			<section class="lane" aria-label="Works by scan activity">
				<header class="lane__header">
					<h2 class="lane__title">On the walls</h2>
					<p class="lane__copy">Confirmed hangs first - interest and gentle rotation signals.</p>
				</header>

				{#if pulse.byArtwork.length === 0}
					<p class="lane__empty">No matched works yet - curate, then print wall QRs.</p>
				{:else}
					<ul class="works">
						{#each pulse.byArtwork as row (row.artwork?.id)}
							<li class="work" class:work--live={row.live}>
								{#if row.artwork}
									<img
										class="work__thumb"
										src={row.artwork.image_url ?? artworkImageUrl(row.artwork.image_filename)}
										alt=""
									/>
								{/if}
								<div>
									<p class="work__title">
										{row.artwork?.title}
										{#if row.live}
											<span class="work__live">Live</span>
										{/if}
									</p>
									<p class="work__meta">
										{row.scanCount} scans
										<span aria-hidden="true">·</span>
										{row.loves} loves
										<span aria-hidden="true">·</span>
										{row.buyAsks} buy asks
										{#if row.attention > 0}
											<span aria-hidden="true">·</span>
											{row.attention} need attention
										{/if}
									</p>
									{#if row.nudge}
										<p class="work__nudge">{row.nudge}</p>
									{/if}
									{#if row.artwork}
										<a href={artworkRoute(row.artwork.id)}>Open door</a>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="lane" aria-label="Recent scans">
				<header class="lane__header">
					<h2 class="lane__title">Recent scans</h2>
				</header>
				{#if pulse.scans.length === 0}
					<p class="lane__empty">
						No scans yet. Open a public artwork page from a wall QR to begin the pulse.
					</p>
				{:else}
					<ul class="scans">
						{#each pulse.scans as scan (scan.id)}
							<li>
								<p class="scans__time">{formatTime(scan.scanned_at)}</p>
								<p class="scans__detail">
									{interestLabel(scan.interest_level)}
									{#if scan.condition}
										<span aria-hidden="true">·</span>
										{scan.condition.replaceAll('_', ' ')}
									{/if}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<nav class="pulse__nav">
				<a href={ROUTES.venueCollect}>Confirm collection</a>
				<a href={ROUTES.venueCalendar}>Wall calendar</a>
				<a href={ROUTES.venuePromote}>Promotion pack</a>
				<a href={ROUTES.venue}>Venue hub</a>
			</nav>
		{/if}
	</div>
</section>

<style>
	.pulse {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3rem;
		color: var(--color-indigo);
	}

	.pulse__inner {
		width: min(100%, 40rem);
		margin: 0 auto;
	}

	.pulse__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.pulse__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.pulse__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(2rem, 6vw, 2.75rem);
		font-weight: 500;
	}

	.pulse__intro,
	.pulse__guard {
		margin: 1rem 0 0;
		max-width: 42ch;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.7);
	}

	.pulse__link,
	.pulse__nav a,
	.work a {
		color: var(--color-burnt);
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.week {
		margin-top: 2rem;
		padding: 1.25rem 0 1.35rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
		border-bottom: 1px solid rgb(30 41 59 / 0.1);
	}

	.week__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.week__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.55rem;
		font-weight: 500;
	}

	.week__copy {
		margin: 0.45rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.week__works {
		list-style: none;
		margin: 0.85rem 0 1rem;
		padding: 0;
		display: grid;
		gap: 0.35rem;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
	}

	.pulse__census {
		margin: 1.5rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
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

	.works,
	.scans {
		list-style: none;
		margin: 1.15rem 0 0;
		padding: 0;
		display: grid;
		gap: 1.15rem;
	}

	.work {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.9rem;
		padding-bottom: 1.1rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.work__thumb {
		width: 4.5rem;
		height: 5.5rem;
		object-fit: cover;
		background: var(--color-indigo);
	}

	.work__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.45rem;
	}

	.work__live {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.work__meta {
		margin: 0.3rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.work__nudge {
		margin: 0.45rem 0 0;
		font-size: 0.9rem;
		color: rgb(30 41 59 / 0.72);
	}

	.work a {
		display: inline-block;
		margin-top: 0.55rem;
	}

	.scans li {
		padding-bottom: 0.85rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}

	.scans__time {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.scans__detail {
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
	}

	.pulse__nav {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		margin-top: 2.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.1);
	}
</style>
