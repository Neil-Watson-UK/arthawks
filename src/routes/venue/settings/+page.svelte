<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ART_STYLES, ART_STYLE_LABELS, type ArtStyle } from '$lib/constants/art-styles';
	import { ROUTES, roomRoute } from '$lib/constants/routes';
	import { setActiveIdentity } from '$lib/stores/network';
	import type { SessionIdentity } from '$lib/server/profile-identity';

	let { data } = $props();

	const identity = $derived(data.venueIdentity);

	let fullName = $state('');
	let bio = $state('');
	let website = $state('');
	let instagram = $state('');
	let imageUrl = $state('');
	let postcode = $state('');
	let openingHours = $state('');
	let footfall = $state<'high' | 'medium' | 'low'>('medium');
	let styles = $state<ArtStyle[]>([]);
	let errorMessage = $state<string | null>(null);
	let saveMessage = $state<string | null>(null);
	let isSubmitting = $state(false);
	let placeLabel = $state<string | null>(null);

	$effect(() => {
		fullName = identity.full_name ?? '';
		bio = identity.bio ?? '';
		website = identity.website ?? '';
		instagram = identity.instagram ?? '';
		imageUrl = identity.image_url ?? '';
		postcode = identity.postcode ?? '';
		openingHours = identity.opening_hours ?? '';
		footfall = (identity.footfall as 'high' | 'medium' | 'low') || 'medium';
	});

	function toggleStyle(style: ArtStyle): void {
		styles = styles.includes(style) ? styles.filter((item) => item !== style) : [...styles, style];
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;
		isSubmitting = true;
		errorMessage = null;
		saveMessage = null;

		try {
			const response = await fetch('/api/venue/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					full_name: fullName,
					bio,
					website,
					instagram,
					image_url: imageUrl,
					postcode,
					opening_hours: openingHours,
					footfall,
					aesthetic_tags: styles.length ? styles : undefined
				})
			});

			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				place_label?: string;
				postcode?: string;
				opening_hours?: string | null;
				on_map?: boolean;
				identity?: SessionIdentity;
				venue_id?: string;
			} | null;

			if (!response.ok) {
				errorMessage = payload?.message ?? 'Could not save venue identity';
				return;
			}

			if (payload?.identity) {
				setActiveIdentity(payload.identity as never);
			}
			placeLabel = payload?.place_label ?? null;
			if (payload?.postcode) postcode = payload.postcode;
			if (payload?.opening_hours !== undefined) openingHours = payload.opening_hours ?? '';
			saveMessage = payload?.on_map
				? `Saved - you’re on the map${placeLabel ? ` near ${placeLabel}` : ''}.`
				: 'Saved.';

			await goto($page.url.pathname, { invalidateAll: true });
		} catch {
			errorMessage = 'Network error while saving.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="settings">
	<div class="settings__inner">
		<div class="settings__rule" aria-hidden="true"></div>
		<p class="settings__eyebrow">Venue identity</p>
		<h1 class="settings__title">Your room on the map</h1>
		<p class="settings__intro">
			Add your postcode and space details so Art Hawks can place you in the city gallery. Artists
			nearby will find you; guests will open your public room.
		</p>

		{#if !identity.on_map}
			<p class="settings__banner" role="status">
				You’re not on the map yet - enter a UK postcode below to pin your venue.
			</p>
		{:else}
			<p class="settings__ok" role="status">
				Mapped
				{#if identity.postcode}
					at <strong>{identity.postcode}</strong>
				{/if}
				·
				<a href={roomRoute(data.venueId)}>View public room</a>
				·
				<a href={ROUTES.map}>Open city map</a>
			</p>
		{/if}

		<form class="settings__form" onsubmit={submit}>
			<label>
				<span>Venue name</span>
				<input bind:value={fullName} required autocomplete="organization" />
			</label>

			<label>
				<span>Postcode</span>
				<input
					bind:value={postcode}
					required
					autocomplete="postal-code"
					placeholder="e.g. BS1 4ST"
				/>
			</label>
			<p class="settings__hint">
				We convert this to map coordinates. It isn’t shown as a street address on the public room.
			</p>

			<label>
				<span>Opening hours</span>
				<input
					bind:value={openingHours}
					placeholder="e.g. Tue-Sat 10-5 · Sun 11-4"
					autocomplete="off"
				/>
			</label>
			<p class="settings__hint">
				Shown on your public room and the map sheet so explorers know when to visit.
			</p>

			<label>
				<span>About the space</span>
				<textarea
					rows="5"
					bind:value={bio}
					placeholder="Atmosphere, light, who visits - this becomes your public room summary."
				></textarea>
			</label>

			<label>
				<span>Footfall</span>
				<select bind:value={footfall}>
					<option value="high">High - busy, lots of eyes</option>
					<option value="medium">Medium - steady neighbourhood flow</option>
					<option value="low">Low - intimate, quieter room</option>
				</select>
			</label>

			<label>
				<span>Venue image URL</span>
				<input type="url" bind:value={imageUrl} placeholder="https://…" />
			</label>

			<div class="settings__row">
				<label>
					<span>Website</span>
					<input type="url" bind:value={website} placeholder="https://" />
				</label>
				<label>
					<span>Instagram</span>
					<input bind:value={instagram} placeholder="@venue" />
				</label>
			</div>

			<fieldset>
				<legend>Art that fits your walls</legend>
				<div class="settings__chips">
					{#each ART_STYLES as style (style)}
						<button
							type="button"
							class="settings__chip"
							class:settings__chip--on={styles.includes(style)}
							onclick={() => toggleStyle(style)}
						>
							{ART_STYLE_LABELS[style]}
						</button>
					{/each}
				</div>
			</fieldset>

			{#if errorMessage}
				<p class="settings__error" role="alert">{errorMessage}</p>
			{/if}
			{#if saveMessage}
				<p class="settings__ok" role="status">{saveMessage}</p>
			{/if}

			<button class="settings__submit" type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving…' : 'Save identity & pin on map'}
			</button>
		</form>

		<p class="settings__back">
			<a href={ROUTES.venue}>Back to venue hub</a>
		</p>
	</div>
</section>

<style>
	.settings {
		min-height: 100dvh;
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 3.5rem;
		background:
			radial-gradient(ellipse 50% 35% at 0% 0%, rgb(194 65 12 / 0.08), transparent 55%),
			var(--color-cream);
		color: var(--color-indigo);
	}

	.settings__inner {
		width: min(100%, 34rem);
		margin: 0 auto;
	}

	.settings__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.settings__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.settings__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 2.6rem);
		font-weight: 500;
	}

	.settings__intro {
		margin: 0.85rem 0 0;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.7);
	}

	.settings__banner {
		margin: 1.25rem 0 0;
		padding: 0.85rem 1rem;
		border: 1px solid rgb(194 65 12 / 0.35);
		background: rgb(194 65 12 / 0.08);
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.settings__form {
		display: grid;
		gap: 0.9rem;
		margin-top: 1.75rem;
	}

	.settings__form label,
	.settings__form fieldset {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		border: none;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.settings__form input,
	.settings__form select,
	.settings__form textarea {
		font: inherit;
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
		padding: 0.7rem 0.8rem;
		border: 1px solid rgb(30 41 59 / 0.16);
		border-radius: 0.2rem;
		background: white;
		color: var(--color-indigo);
	}

	.settings__hint {
		margin: -0.35rem 0 0;
		font-size: 0.8rem;
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
		color: rgb(30 41 59 / 0.55);
		line-height: 1.4;
	}

	.settings__row {
		display: grid;
		gap: 0.9rem;
	}

	.settings__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.settings__chip {
		padding: 0.45rem 0.7rem;
		border: 1px solid rgb(30 41 59 / 0.18);
		border-radius: 0.2rem;
		background: transparent;
		font-size: 0.78rem;
		text-transform: none;
		letter-spacing: 0.02em;
		cursor: pointer;
		color: var(--color-indigo);
	}

	.settings__chip--on {
		border-color: var(--color-burnt);
		color: var(--color-burnt);
		background: rgb(194 65 12 / 0.06);
	}

	.settings__submit {
		appearance: none;
		margin-top: 0.35rem;
		padding: 0.9rem 1.1rem;
		border: none;
		border-radius: 0.2rem;
		background: var(--color-indigo);
		color: var(--color-cream);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.settings__submit:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.settings__error {
		margin: 0;
		color: #9a3412;
		font-size: 0.875rem;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 400;
	}

	.settings__ok {
		margin: 1rem 0 0;
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.75);
	}

	.settings__ok a {
		color: var(--color-burnt);
	}

	.settings__back {
		margin: 1.75rem 0 0;
		font-size: 0.85rem;
	}

	.settings__back a {
		color: var(--color-burnt);
		text-decoration: none;
		font-weight: 600;
	}

	@media (min-width: 560px) {
		.settings__row {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
