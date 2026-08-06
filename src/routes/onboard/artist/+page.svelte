<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import OnboardShell from '$lib/components/onboard/OnboardShell.svelte';
	import { ONBOARD_COPY } from '$lib/constants/onboard-copy';
	import { ART_STYLES, ART_STYLE_LABELS, type ArtStyle } from '$lib/constants/art-styles';
	import { ROUTES } from '$lib/constants/routes';
	import type { SimulatedArtistProfile } from '$lib/data/simulated-users';
	import { setActiveIdentity, setTastePreferences, tastePreferences } from '$lib/stores/network';
	import '$lib/components/onboard/onboard-form.css';

	let fullName = $state('');
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let bio = $state('');
	let medium = $state('Oil');
	let postcode = $state('');
	let website = $state('');
	let instagram = $state('');
	let styles = $state<ArtStyle[]>([]);
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);
	let usernameTouched = $state(false);

	const copy = ONBOARD_COPY.artist;

	onMount(() => {
		const unsub = tastePreferences.subscribe((prefs) => {
			if (prefs.length > 0 && styles.length === 0) styles = [...prefs];
		});
		return unsub;
	});

	function slugFromName(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 30);
	}

	function onNameInput(): void {
		if (!usernameTouched) username = slugFromName(fullName);
	}

	function toggleStyle(style: ArtStyle): void {
		styles = styles.includes(style) ? styles.filter((item) => item !== style) : [...styles, style];
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;
		isSubmitting = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					role: 'artist',
					email,
					password,
					full_name: fullName,
					username,
					bio,
					medium,
					postcode,
					website,
					instagram,
					aesthetic_tags: styles
				})
			});

			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				identity?: SimulatedArtistProfile;
				redirectTo?: string;
			} | null;

			if (!response.ok || !payload?.identity) {
				errorMessage = payload?.message ?? 'Could not create artist account';
				return;
			}

			setActiveIdentity(payload.identity);
			if (styles.length > 0) setTastePreferences(styles);

			/* Sync browser client session for Realtime / storage (mirrors login) */
			const { supabase } = await import('$lib/supabaseClient');
			if (supabase) {
				const { error: browserAuthError } = await supabase.auth.signInWithPassword({
					email,
					password
				});
				if (browserAuthError) {
					console.warn('Browser session sync after register failed:', browserAuthError.message);
				}
			}

			await goto(payload.redirectTo ?? ROUTES.artist);
		} catch {
			errorMessage = 'Network error while creating your account.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<OnboardShell audience="artist" errorMessage={errorMessage}>
	<form class="onboard-form" onsubmit={submit}>
		<div class="onboard-form__row onboard-form__row--2">
			<label>
				<span>Full name</span>
				<input bind:value={fullName} oninput={onNameInput} required autocomplete="name" />
			</label>
			<label>
				<span>Username</span>
				<input
					bind:value={username}
					oninput={() => (usernameTouched = true)}
					required
					autocomplete="username"
				/>
			</label>
		</div>

		<div class="onboard-form__row onboard-form__row--2">
			<label>
				<span>Email</span>
				<input type="email" bind:value={email} required autocomplete="email" />
			</label>
			<label>
				<span>Password</span>
				<input
					type="password"
					bind:value={password}
					required
					minlength="8"
					autocomplete="new-password"
				/>
			</label>
		</div>

		<div class="onboard-form__row onboard-form__row--2">
			<label>
				<span>Medium</span>
				<select bind:value={medium}>
					<option>Oil</option>
					<option>Acrylic</option>
					<option>Watercolor</option>
					<option>Mixed Media</option>
					<option>Print</option>
					<option>Photography</option>
				</select>
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
		</div>
		<p class="onboard-form__hint">
			We use your postcode to place you on the map and match nearby venues - never shown as a full
			street address.
		</p>

		<label>
			<span>Artist story</span>
			<textarea
				rows="4"
				bind:value={bio}
				placeholder="What should venues know about your practice?"
			></textarea>
		</label>

		<div class="onboard-form__row onboard-form__row--2">
			<label>
				<span>Website</span>
				<input type="url" bind:value={website} placeholder="https://" />
			</label>
			<label>
				<span>Instagram</span>
				<input bind:value={instagram} placeholder="@you" />
			</label>
		</div>

		<fieldset>
			<legend>Art you make</legend>
			<p class="onboard-form__hint">Helps venues find a fit for their walls.</p>
			<div class="onboard-form__chips">
				{#each ART_STYLES as style (style)}
					<button
						type="button"
						class="onboard-form__chip"
						class:onboard-form__chip--on={styles.includes(style)}
						aria-pressed={styles.includes(style)}
						onclick={() => toggleStyle(style)}
					>
						{ART_STYLE_LABELS[style]}
					</button>
				{/each}
			</div>
		</fieldset>

		<button class="onboard-form__submit" type="submit" disabled={isSubmitting}>
			{isSubmitting ? 'Creating…' : copy.cta}
		</button>
	</form>
</OnboardShell>
