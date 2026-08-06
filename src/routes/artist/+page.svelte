<script lang="ts">
	import { onDestroy } from 'svelte';
	import { artworkRoute, ROUTES } from '$lib/constants/routes';
	import {
		addArtwork,
		artistDashboard,
		currentUser,
		deleteArtwork,
		markArtworkSold,
		revokeBlobImageUrl,
		updateArtistProfile,
		updateArtwork,
		type NetworkArtwork
	} from '$lib/stores/network';
	import { artistInbox } from '$lib/stores/rotations';
	import type { SimulatedArtistProfile } from '$lib/data/simulated-users';
	import { artworkImageUrl } from '$lib/data/mock-artists';
	import {
		ART_STYLE_LABELS,
		ART_STYLES,
		isArtStyle,
		type ArtStyle
	} from '$lib/constants/art-styles';
	import {
		AUTO_AMOR_HEIGHT_CM,
		AUTO_AMOR_WIDTH_CM,
		type SubstrateTier
	} from '$lib/constants/auto-amor';
	import AutoAmorBadge from '$lib/components/auto-amor/AutoAmorBadge.svelte';
	import { formatBalance, formatPrice } from '$lib/utils/format';

	const MEDIUMS = ['Oil', 'Acrylic', 'Watercolor', 'Mixed Media'] as const;
	const DESCRIPTION_MAX = 2000;

	type Medium = (typeof MEDIUMS)[number];
	type FormPhase = 'form' | 'success';

	let { data } = $props();

	let title = $state('');
	let medium = $state<Medium>('Oil');
	let style = $state<ArtStyle>('landscape');
	let description = $state('');
	let substrateTier = $state<SubstrateTier>('auto_amor_24x30');
	let heightCm = $state(String(AUTO_AMOR_HEIGHT_CM));
	let widthCm = $state(String(AUTO_AMOR_WIDTH_CM));
	let priceGbp = $state('');
	let uploadedFile = $state<File | null>(null);
	let uploadedFileName = $state('');
	let localPreviewUrl = $state<string | null>(null);
	let existingImageUrl = $state<string | null>(null);
	let previewOwnedByStore = $state(false);
	let isDragging = $state(false);
	let phase = $state<FormPhase>('form');
	let submitError = $state<string | null>(null);
	let catalogueError = $state<string | null>(null);
	let isSubmitting = $state(false);
	let busyArtworkId = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();
	let formAnchor: HTMLElement | undefined = $state();

	let profileName = $state('');
	let profileBio = $state('');
	let profileWebsite = $state('');
	let profileInstagram = $state('');
	let profileMessage = $state<string | null>(null);
	let profileError = $state<string | null>(null);
	let isSavingProfile = $state(false);

	const dashboard = $derived($artistDashboard);
	const wallTotals = $derived($artistInbox.totals);
	const isArtist = $derived($currentUser.role === 'artist');
	const artist = $derived(isArtist ? ($currentUser as SimulatedArtistProfile) : null);
	const isEditing = $derived(editingId !== null);

	$effect(() => {
		if (!artist) return;
		profileName = artist.full_name;
		profileBio = artist.bio ?? '';
		profileWebsite = artist.website ?? '';
		profileInstagram = artist.instagram ?? '';
	});

	async function saveArtistProfile(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!isArtist || isSavingProfile) return;

		isSavingProfile = true;
		profileMessage = null;
		profileError = null;

		try {
			await updateArtistProfile({
				full_name: profileName,
				bio: profileBio,
				website: profileWebsite,
				instagram: profileInstagram
			});
			profileMessage = 'Studio profile saved.';
		} catch (err) {
			profileError = err instanceof Error ? err.message : 'Could not save profile';
		} finally {
			isSavingProfile = false;
		}
	}
	const descriptionCount = $derived(description.length);
	const previewSrc = $derived(localPreviewUrl ?? existingImageUrl);

	const isAutoAmor = $derived(substrateTier === 'auto_amor_24x30');

	const isValid = $derived(
		title.trim().length > 0 &&
			Number(heightCm) > 0 &&
			Number(widthCm) > 0 &&
			Number(priceGbp) > 0 &&
			description.length <= DESCRIPTION_MAX &&
			(isEditing ? previewSrc !== null : uploadedFile !== null && localPreviewUrl !== null)
	);

	function selectSubstrate(tier: SubstrateTier): void {
		substrateTier = tier;
		if (tier === 'auto_amor_24x30') {
			heightCm = String(AUTO_AMOR_HEIGHT_CM);
			widthCm = String(AUTO_AMOR_WIDTH_CM);
		}
	}

	function mediumFromStored(stored: string): Medium {
		const found = MEDIUMS.find((option) => stored.toLowerCase().startsWith(option.toLowerCase()));
		return found ?? 'Oil';
	}

	function applyUploadedFile(file: File | null): void {
		if (!previewOwnedByStore && localPreviewUrl) {
			revokeBlobImageUrl(localPreviewUrl);
		}

		uploadedFile = file;
		uploadedFileName = file?.name ?? '';
		localPreviewUrl = file ? URL.createObjectURL(file) : null;
		previewOwnedByStore = false;
	}

	function handleFileInputChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		applyUploadedFile(file);
	}

	function isImageFile(file: File): boolean {
		if (file.type.startsWith('image/')) return true;
		return /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(file.name);
	}

	function handleDrop(event: DragEvent): void {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files?.[0] ?? null;
		if (file && isImageFile(file)) {
			applyUploadedFile(file);
		}
	}

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(): void {
		isDragging = false;
	}

	function openFilePicker(): void {
		fileInput?.click();
	}

	function resetForm(): void {
		editingId = null;
		title = '';
		medium = 'Oil';
		style = 'landscape';
		description = '';
		substrateTier = 'auto_amor_24x30';
		heightCm = String(AUTO_AMOR_HEIGHT_CM);
		widthCm = String(AUTO_AMOR_WIDTH_CM);
		priceGbp = '';
		existingImageUrl = null;
		previewOwnedByStore = false;
		applyUploadedFile(null);
		submitError = null;
		if (fileInput) {
			fileInput.value = '';
		}
		phase = 'form';
	}

	function beginEdit(work: NetworkArtwork): void {
		editingId = work.id;
		title = work.title;
		medium = mediumFromStored(work.medium);
		style = work.style && isArtStyle(work.style) ? work.style : 'landscape';
		description = work.description ?? '';
		substrateTier = work.substrate_tier === 'auto_amor_24x30' ? 'auto_amor_24x30' : 'custom';
		heightCm = String(
			substrateTier === 'auto_amor_24x30' ? AUTO_AMOR_HEIGHT_CM : work.height_cm
		);
		widthCm = String(substrateTier === 'auto_amor_24x30' ? AUTO_AMOR_WIDTH_CM : work.width_cm);
		priceGbp = String(Math.round(work.price / 100));
		existingImageUrl = work.image_url || artworkImageUrl(work.image_filename) || null;
		applyUploadedFile(null);
		submitError = null;
		phase = 'form';
		queueMicrotask(() => formAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!isValid || isSubmitting) return;
		if (!isEditing && (!uploadedFile || !localPreviewUrl)) return;

		isSubmitting = true;
		submitError = null;

		try {
			const height =
				substrateTier === 'auto_amor_24x30' ? AUTO_AMOR_HEIGHT_CM : Number(heightCm);
			const width =
				substrateTier === 'auto_amor_24x30' ? AUTO_AMOR_WIDTH_CM : Number(widthCm);
			const payload = {
				title,
				medium:
					substrateTier === 'auto_amor_24x30'
						? `${medium} on Auto Amor board`
						: `${medium} on canvas`,
				style,
				description,
				price_gbp: Number(priceGbp),
				height_cm: height,
				width_cm: width,
				substrate_tier: substrateTier,
				image_file: uploadedFile
			};

			if (isEditing && editingId) {
				await updateArtwork(editingId, payload);
			} else {
				const imageFilename = uploadedFile?.name || uploadedFileName;
				if (!imageFilename || !uploadedFile) return;

				await addArtwork({
					...payload,
					image_file: uploadedFile,
					image_filename: imageFilename
				});
			}

			if (localPreviewUrl) {
				revokeBlobImageUrl(localPreviewUrl);
			}

			previewOwnedByStore = false;
			localPreviewUrl = null;
			uploadedFile = null;
			uploadedFileName = '';
			existingImageUrl = null;
			editingId = null;
			if (fileInput) {
				fileInput.value = '';
			}

			phase = 'success';
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Unable to save artwork';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleMarkSold(work: NetworkArtwork): Promise<void> {
		if (busyArtworkId || work.status === 'sold') return;
		busyArtworkId = work.id;
		catalogueError = null;

		try {
			await markArtworkSold(work.id);
			if (editingId === work.id) resetForm();
		} catch (err) {
			catalogueError = err instanceof Error ? err.message : 'Unable to mark as sold';
		} finally {
			busyArtworkId = null;
		}
	}

	async function handleRemove(work: NetworkArtwork): Promise<void> {
		if (busyArtworkId) return;
		const confirmed = window.confirm(`Remove “${work.title}” from your catalogue?`);
		if (!confirmed) return;

		busyArtworkId = work.id;
		catalogueError = null;

		try {
			await deleteArtwork(work.id);
			if (editingId === work.id) resetForm();
		} catch (err) {
			catalogueError = err instanceof Error ? err.message : 'Unable to remove artwork';
		} finally {
			busyArtworkId = null;
		}
	}

	onDestroy(() => {
		if (!previewOwnedByStore) {
			revokeBlobImageUrl(localPreviewUrl ?? undefined);
		}
	});
</script>

<section class="artist-studio min-h-dvh bg-cream">
	<div class="artist-studio__inner">
		<div class="artist-studio__rule" aria-hidden="true"></div>
		<p class="artist-studio__eyebrow">Artist</p>
		<h1 class="artist-studio__title">Artist Studio Dashboard</h1>

		{#if !isArtist}
			<div class="identity-guard" role="status">
				<p class="identity-guard__copy">
					You are viewing as <strong>{$currentUser.full_name}</strong>. Switch to an artist identity
					in the header to manage a studio catalogue.
				</p>
				<a
					class="btn btn--secondary"
					href={$currentUser.role === 'venue' ? ROUTES.venue : ROUTES.discover}
				>
					{$currentUser.role === 'venue' ? 'Go to venue dashboard' : 'Go to discover feed'}
				</a>
			</div>
		{:else if phase === 'success'}
			<div class="success" role="status" aria-live="polite">
				<div class="success__mark" aria-hidden="true"></div>
				<h2 class="success__heading">Catalogue updated.</h2>
				<p class="success__copy">
					Your changes are live on the compass - venues and discover will pick them up immediately.
				</p>
				<button type="button" class="btn btn--secondary" onclick={resetForm}>
					Continue in studio
				</button>
			</div>
		{:else}
			<p class="artist-studio__intro">
				Manage the compass catalogue for <strong>{dashboard?.artist.full_name}</strong> - upload,
				describe, edit, sell, or retire works. Own your story, then output a promotion pack for each
				venue.
			</p>

			<section class="artist-profile" aria-label="Your studio profile">
				<header class="artist-profile__header">
					<p class="artist-profile__eyebrow">Your story</p>
					<h2 class="artist-profile__title">Artist profile</h2>
					<p class="artist-profile__copy">
						This bio travels with your promotion packs - venues and guests meet the person behind the
						work.
					</p>
				</header>

				<form class="artist-profile__form" onsubmit={saveArtistProfile}>
					<label class="field">
						<span class="field__label">Name</span>
						<input class="field__input" type="text" bind:value={profileName} required />
					</label>
					<label class="field">
						<span class="field__label">Bio</span>
						<textarea class="field__input field__textarea" rows="3" bind:value={profileBio}></textarea>
					</label>
					<label class="field">
						<span class="field__label">Website</span>
						<input
							class="field__input"
							type="url"
							placeholder="https://"
							bind:value={profileWebsite}
						/>
					</label>
					<label class="field">
						<span class="field__label">Instagram</span>
						<input
							class="field__input"
							type="text"
							placeholder="@you"
							bind:value={profileInstagram}
						/>
					</label>

					{#if profileMessage}
						<p class="artist-profile__ok" role="status">{profileMessage}</p>
					{/if}
					{#if profileError}
						<p class="artist-profile__error" role="alert">{profileError}</p>
					{/if}

					<button class="btn btn--primary" type="submit" disabled={isSavingProfile}>
						{isSavingProfile ? 'Saving...' : 'Save artist profile'}
					</button>
				</form>

				<a class="artist-promote-link" href={ROUTES.artistInbox}>
					<span class="artist-promote-link__rule" aria-hidden="true"></span>
					<span class="artist-promote-link__label">Match inbox</span>
					<span class="artist-promote-link__hint">Confirm hangs, decline, or propose swaps</span>
				</a>

				<a class="artist-promote-link" href={ROUTES.artistPromote}>
					<span class="artist-promote-link__rule" aria-hidden="true"></span>
					<span class="artist-promote-link__label">Output promotion pack</span>
					<span class="artist-promote-link__hint">QR codes & descriptors by venue</span>
				</a>
			</section>

			{#if dashboard}
				<section class="artist-stats" aria-label="Studio stats">
					<div class="artist-stats__item artist-stats__item--balance">
						<span class="artist-stats__value">{formatBalance(data.balance?.available_pence ?? 0)}</span>
						<span class="artist-stats__label">Balance · 70%</span>
					</div>
					<div class="artist-stats__item">
						<span class="artist-stats__value">{dashboard.stats.total}</span>
						<span class="artist-stats__label">Works</span>
					</div>
					<div class="artist-stats__item">
						<span class="artist-stats__value">{dashboard.stats.available}</span>
						<span class="artist-stats__label">Available</span>
					</div>
					<div class="artist-stats__item">
						<span class="artist-stats__value">{dashboard.stats.matched}</span>
						<span class="artist-stats__label">Matched</span>
					</div>
					<div class="artist-stats__item">
						<span class="artist-stats__value">{dashboard.stats.sold}</span>
						<span class="artist-stats__label">Sold</span>
					</div>
					<div class="artist-stats__item">
						<span class="artist-stats__value">{wallTotals.scansWeek}</span>
						<span class="artist-stats__label">Scans · 7d</span>
					</div>
					<div class="artist-stats__item">
						<span class="artist-stats__value">{wallTotals.loves}</span>
						<span class="artist-stats__label">Loves</span>
					</div>
				</section>

				{#if dashboard.works.length > 0}
					<section class="artist-catalogue" aria-label="Your catalogue">
						<h2 class="artist-catalogue__title">Your Catalogue</h2>
						{#if catalogueError}
							<p class="upload-error" role="alert">{catalogueError}</p>
						{/if}
						<ul class="artist-catalogue__list">
							{#each dashboard.works as work (work.id)}
								<li class="artist-catalogue__item">
									<div class="artist-catalogue__frame">
										<img
											src={work.image_url ?? artworkImageUrl(work.image_filename)}
											alt={work.title}
											loading="lazy"
										/>
									</div>
									<div class="artist-catalogue__body">
										{#if work.is_plug_and_play}
											<span class="artist-catalogue__badge">
												<AutoAmorBadge variant="verified" compact />
											</span>
										{/if}
										<p class="artist-catalogue__name">{work.title}</p>
										<p class="artist-catalogue__meta">
											{formatPrice(work.price)} · {work.height_cm}×{work.width_cm}cm · {work.status}
										</p>
										{#if work.description}
											<p class="artist-catalogue__desc">{work.description}</p>
										{/if}
										<a class="artist-catalogue__link" href={artworkRoute(work.id)}>Public page & QR</a>
										<div class="artist-catalogue__actions">
											<button
												type="button"
												class="btn btn--ghost btn--compact"
												onclick={() => beginEdit(work)}
												disabled={busyArtworkId === work.id}
											>
												Edit
											</button>
											{#if work.status !== 'sold'}
												<button
													type="button"
													class="btn btn--ghost btn--compact"
													onclick={() => handleMarkSold(work)}
													disabled={busyArtworkId === work.id}
												>
													Mark sold
												</button>
											{/if}
											<button
												type="button"
												class="btn btn--danger btn--compact"
												onclick={() => handleRemove(work)}
												disabled={busyArtworkId === work.id}
											>
												Remove
											</button>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}

			<form class="upload-form" bind:this={formAnchor} onsubmit={handleSubmit}>
				<div class="form-heading">
					<h2 class="form-heading__title">{isEditing ? 'Edit work' : 'Add a new work'}</h2>
					{#if isEditing}
						<button type="button" class="btn btn--ghost btn--compact" onclick={resetForm}>
							Cancel edit
						</button>
					{/if}
				</div>

				<div class="field">
					<label class="field__label" for="title">Title</label>
					<input
						id="title"
						class="field__input"
						type="text"
						placeholder="e.g. Harbour Light"
						bind:value={title}
						required
					/>
				</div>

				<div class="field">
					<label class="field__label" for="medium">Medium</label>
					<select id="medium" class="field__input field__select" bind:value={medium}>
						{#each MEDIUMS as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label class="field__label" for="style">Style</label>
					<select id="style" class="field__input field__select" bind:value={style}>
						{#each ART_STYLES as option (option)}
							<option value={option}>{ART_STYLE_LABELS[option]}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label class="field__label" for="description">
						Story
						<span class="field__count">{descriptionCount}/{DESCRIPTION_MAX}</span>
					</label>
					<textarea
						id="description"
						class="field__input field__textarea"
						rows="5"
						maxlength={DESCRIPTION_MAX}
						placeholder="What should someone feel when they meet this work on a café wall? Materials, place, and the person behind the painting - up to 2000 characters."
						bind:value={description}
					></textarea>
				</div>

				<fieldset class="substrate">
					<legend class="field__label">Board / substrate</legend>
					<div class="substrate__grid" role="radiogroup" aria-label="Substrate choice">
						<button
							type="button"
							class="substrate__card"
							class:substrate__card--active={isAutoAmor}
							aria-pressed={isAutoAmor}
							onclick={() => selectSubstrate('auto_amor_24x30')}
						>
							<span class="substrate__rule" aria-hidden="true"></span>
							<span class="substrate__eyebrow">Option A · Preferred</span>
							<span class="substrate__title">Auto Amor Project Board</span>
							<span class="substrate__size">24 × 30 cm</span>
							<span class="substrate__copy">
								Official collaborative format. Locks dimensions and mates with venue wall
								anchors - no custom install survey.
							</span>
							{#if isAutoAmor}
								<span class="substrate__badge">
									<AutoAmorBadge variant="verified" />
								</span>
							{/if}
						</button>

						<button
							type="button"
							class="substrate__card"
							class:substrate__card--active={!isAutoAmor}
							aria-pressed={!isAutoAmor}
							onclick={() => selectSubstrate('custom')}
						>
							<span class="substrate__rule" aria-hidden="true"></span>
							<span class="substrate__eyebrow">Option B</span>
							<span class="substrate__title">Custom Canvas / Frame</span>
							<span class="substrate__size">Your measurements</span>
							<span class="substrate__copy">
								Traditional custom works remain welcome. Installation requires
								venue-specific verification before hanging.
							</span>
						</button>
					</div>
				</fieldset>

				{#if isAutoAmor}
					<p class="substrate__locked" role="status">
						Dimensions locked to <strong>{AUTO_AMOR_HEIGHT_CM} × {AUTO_AMOR_WIDTH_CM} cm</strong>
						- Verified Auto Amor Hardware.
					</p>
				{:else}
					<div class="field-row">
						<div class="field">
							<label class="field__label" for="height">Height (cm)</label>
							<input
								id="height"
								class="field__input"
								type="number"
								min="1"
								step="0.1"
								placeholder="90"
								bind:value={heightCm}
								required
							/>
						</div>
						<div class="field">
							<label class="field__label" for="width">Width (cm)</label>
							<input
								id="width"
								class="field__input"
								type="number"
								min="1"
								step="0.1"
								placeholder="70"
								bind:value={widthCm}
								required
							/>
						</div>
					</div>
					<p class="substrate__note">
						Custom sizes need venue-specific verification before install.
					</p>
				{/if}

				<div class="field">
					<label class="field__label" for="price">Price (GBP)</label>
					<input
						id="price"
						class="field__input"
						type="number"
						min="1"
						step="1"
						placeholder="1850"
						bind:value={priceGbp}
						required
					/>
				</div>

				<div class="field">
					<span class="field__label">{isEditing ? 'Artwork image (optional replace)' : 'Artwork image'}</span>
					<button
						type="button"
						class="dropzone"
						class:dropzone--active={isDragging}
						class:dropzone--filled={previewSrc !== null}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						onclick={openFilePicker}
					>
						<input
							bind:this={fileInput}
							class="dropzone__input"
							type="file"
							accept="image/*"
							onchange={handleFileInputChange}
						/>

						{#if previewSrc}
							<img class="dropzone__preview" src={previewSrc} alt="Selected artwork preview" />
							<span class="dropzone__hint">Tap to {isEditing ? 'replace' : 'change'} image</span>
						{:else}
							<span class="dropzone__icon" aria-hidden="true">+</span>
							<span class="dropzone__title">Drop your artwork here</span>
							<span class="dropzone__hint">or click to browse - JPG, PNG, WebP</span>
						{/if}
					</button>
				</div>

				<button class="btn btn--primary" type="submit" disabled={!isValid || isSubmitting}>
					{#if isSubmitting}
						Saving…
					{:else if isEditing}
						Save changes
					{:else}
						Add to compass
					{/if}
				</button>

				{#if submitError}
					<p class="upload-error" role="alert">{submitError}</p>
				{/if}
			</form>
		{/if}

		<a class="artist-studio__back" href="/">Back to gateway</a>
	</div>
</section>

<style>
	.artist-studio {
		padding: max(2rem, env(safe-area-inset-top)) 1.25rem 2.5rem;
		color: var(--color-indigo);
		background: var(--color-cream);
	}

	.artist-studio__inner {
		width: min(100%, 36rem);
		margin: 0 auto;
	}

	.artist-studio__rule {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 0.9rem;
		background: var(--color-burnt);
	}

	.artist-studio__eyebrow {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.artist-studio__title {
		margin: 0.4rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 6vw, 2.5rem);
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.03em;
	}

	.artist-studio__intro {
		margin: 1rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
	}

	.artist-profile {
		margin-top: 2.25rem;
		padding-top: 1.75rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.artist-profile__eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.artist-profile__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.35rem;
		font-weight: 500;
	}

	.artist-profile__copy {
		margin: 0.55rem 0 0;
		max-width: 40ch;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.55);
	}

	.artist-profile__form {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.artist-profile__form .field {
		display: grid;
		gap: 0.35rem;
	}

	.artist-profile__form .field__label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.artist-profile__form .field__input {
		width: 100%;
		padding: 0.7rem 0;
		border: none;
		border-bottom: 1px solid rgb(30 41 59 / 0.18);
		background: transparent;
		font-size: 0.9375rem;
		color: var(--color-indigo);
	}

	.artist-profile__form .field__textarea {
		resize: vertical;
		min-height: 4.5rem;
	}

	.artist-profile__ok {
		margin: 0;
		font-size: 0.8125rem;
		color: #3f6212;
	}

	.artist-profile__error {
		margin: 0;
		font-size: 0.8125rem;
		color: #9a3412;
	}

	.artist-promote-link {
		display: grid;
		gap: 0.4rem;
		margin-top: 1.5rem;
		padding: 1.15rem 1.2rem;
		border: 1px solid rgb(194 65 12 / 0.3);
		text-decoration: none;
		color: inherit;
	}

	.artist-promote-link__rule {
		width: 1.75rem;
		height: 2px;
		background: var(--color-burnt);
	}

	.artist-promote-link__label {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
	}

	.artist-promote-link__hint {
		font-size: 0.8125rem;
		color: rgb(30 41 59 / 0.55);
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

	.artist-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.65rem;
		margin-top: 1.5rem;
	}

	.artist-stats__item {
		padding: 0.85rem 0.55rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		background: rgb(251 237 224 / 0.55);
	}

	.artist-stats__item--balance {
		grid-column: span 2;
		border-color: rgb(194 65 12 / 0.22);
		background: linear-gradient(165deg, rgb(255 247 237 / 0.9), rgb(251 237 224 / 0.55));
	}

	.artist-stats__item--balance .artist-stats__value {
		font-size: 1.45rem;
	}

	.artist-stats__value {
		display: block;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.25rem;
		color: #1e293b;
	}

	.artist-stats__label {
		display: block;
		margin-top: 0.2rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.5625rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.artist-catalogue {
		margin-top: 1.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.artist-catalogue__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.2rem;
		font-weight: 500;
	}

	.artist-catalogue__list {
		display: grid;
		gap: 1rem;
		margin: 0.85rem 0 0;
		padding: 0;
		list-style: none;
	}

	.artist-catalogue__item {
		display: grid;
		grid-template-columns: 4rem 1fr;
		gap: 0.85rem;
		align-items: start;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.06);
	}

	.artist-catalogue__frame {
		aspect-ratio: 4 / 5;
		overflow: hidden;
		border: 1px solid rgb(30 41 59 / 0.1);
	}

	.artist-catalogue__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.artist-catalogue__name {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 0.95rem;
	}

	.artist-catalogue__meta {
		margin: 0.2rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		color: rgb(30 41 59 / 0.5);
		text-transform: capitalize;
	}

	.artist-catalogue__desc {
		margin: 0.45rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.8125rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.62);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.artist-catalogue__link {
		display: inline-block;
		margin-top: 0.45rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
		text-decoration: none;
	}

	.artist-catalogue__link:hover {
		color: var(--color-burnt);
	}

	.artist-catalogue__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.65rem;
	}

	.form-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.form-heading__title {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.35rem;
		font-weight: 500;
	}

	.upload-form {
		display: grid;
		gap: 1.75rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid rgb(30 41 59 / 0.08);
	}

	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.field {
		display: grid;
		gap: 0.55rem;
	}

	.field__label {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.field__count {
		letter-spacing: 0.06em;
		font-variant-numeric: tabular-nums;
	}

	.field__input {
		width: 100%;
		padding: 0.65rem 0 0.75rem;
		border: none;
		border-bottom: 1px solid rgb(30 41 59 / 0.22);
		background: transparent;
		color: #1e293b;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.125rem;
		line-height: 1.3;
		transition: border-color 180ms ease;
	}

	.field__textarea {
		resize: vertical;
		min-height: 7rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.5;
	}

	.field__input:focus {
		outline: none;
		border-bottom-color: var(--color-burnt);
	}

	.field__input::placeholder {
		color: rgb(30 41 59 / 0.28);
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
	}

	.field__select {
		cursor: pointer;
		appearance: none;
		background-image: linear-gradient(45deg, transparent 50%, #1e293b 50%),
			linear-gradient(135deg, #1e293b 50%, transparent 50%);
		background-position:
			calc(100% - 18px) calc(50% + 2px),
			calc(100% - 12px) calc(50% + 2px);
		background-size:
			6px 6px,
			6px 6px;
		background-repeat: no-repeat;
		padding-right: 2rem;
	}

	.dropzone {
		display: grid;
		place-items: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 11rem;
		padding: 1.25rem;
		border: 1px dashed rgb(30 41 59 / 0.2);
		background: rgb(30 41 59 / 0.03);
		color: #1e293b;
		cursor: pointer;
		transition:
			border-color 200ms ease,
			background-color 200ms ease,
			transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.dropzone:hover,
	.dropzone--active {
		border-color: rgb(180 83 42 / 0.55);
		background: rgb(180 83 42 / 0.05);
	}

	.dropzone--filled {
		padding: 0.75rem;
	}

	.dropzone__input {
		display: none;
	}

	.dropzone__icon {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 2rem;
		line-height: 1;
		color: var(--color-burnt);
	}

	.substrate {
		margin: 0;
		padding: 0;
		border: none;
	}

	.substrate__grid {
		display: grid;
		gap: 0.85rem;
		margin-top: 0.55rem;
	}

	.substrate__card {
		display: grid;
		justify-items: start;
		gap: 0.35rem;
		width: 100%;
		padding: 1.1rem 1.15rem 1.2rem;
		border: 1px solid rgb(30 41 59 / 0.14);
		background: #fff;
		color: var(--color-indigo);
		text-align: left;
		cursor: pointer;
		transition:
			border-color 200ms ease,
			background-color 200ms ease;
	}

	.substrate__card--active {
		border-color: var(--color-burnt);
		background: rgb(194 65 12 / 0.04);
	}

	.substrate__rule {
		width: 1.5rem;
		height: 2px;
		background: var(--color-burnt);
	}

	.substrate__eyebrow {
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.substrate__title {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.2rem;
		font-weight: 500;
	}

	.substrate__size {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.substrate__copy {
		max-width: 34ch;
		font-size: 0.875rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.62);
		text-transform: none;
		letter-spacing: normal;
		font-weight: 400;
	}

	.substrate__badge {
		margin-top: 0.35rem;
	}

	.substrate__locked,
	.substrate__note {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.58);
	}

	.artist-catalogue__badge {
		display: inline-block;
		margin-bottom: 0.35rem;
	}

	.dropzone__title {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.05rem;
	}

	.dropzone__hint {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		color: rgb(30 41 59 / 0.5);
	}

	.dropzone__preview {
		width: 100%;
		max-height: 14rem;
		object-fit: cover;
		border: 1px solid rgb(30 41 59 / 0.1);
	}

	.btn {
		justify-self: start;
		min-height: 2.85rem;
		padding: 0 1.35rem;
		border: 1px solid transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transition:
			transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1),
			background-color 180ms ease,
			border-color 180ms ease;
	}

	.btn--compact {
		min-height: 2.15rem;
		padding: 0 0.75rem;
		font-size: 0.625rem;
	}

	.btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn--primary {
		border-color: var(--color-burnt);
		background: var(--color-burnt);
		color: var(--color-cream);
	}

	.btn--primary:hover:not(:disabled) {
		background: #9a4524;
		border-color: #9a4524;
	}

	.btn--secondary {
		border-color: rgb(30 41 59 / 0.18);
		background: transparent;
		color: #1e293b;
	}

	.btn--ghost {
		border-color: rgb(30 41 59 / 0.14);
		background: transparent;
		color: #1e293b;
	}

	.btn--danger {
		border-color: rgb(180 83 9 / 0.35);
		background: transparent;
		color: #b45309;
	}

	.upload-error {
		margin: 0.75rem 0 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.8125rem;
		color: #b45309;
	}

	.success {
		margin-top: 2rem;
		padding-top: 0.5rem;
	}

	.success__mark {
		width: 2.75rem;
		height: 2px;
		margin-bottom: 1rem;
		background: var(--color-burnt);
	}

	.success__heading {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.5rem, 5vw, 2rem);
		font-weight: 500;
		letter-spacing: -0.02em;
		color: #1e293b;
	}

	.success__copy {
		margin: 0.85rem 0 1.5rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.62);
		max-width: 34ch;
	}

	.artist-studio__back {
		display: inline-block;
		margin-top: 2rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
		text-decoration: none;
	}

	@media (max-width: 420px) {
		.artist-stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
