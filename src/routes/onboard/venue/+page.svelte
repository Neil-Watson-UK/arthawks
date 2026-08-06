<script lang="ts">
	import { goto } from '$app/navigation';
	import OnboardShell from '$lib/components/onboard/OnboardShell.svelte';
	import { ONBOARD_COPY } from '$lib/constants/onboard-copy';
	import { ART_STYLES, ART_STYLE_LABELS, type ArtStyle } from '$lib/constants/art-styles';
	import { ROUTES } from '$lib/constants/routes';
	import type { SimulatedVenueProfile } from '$lib/data/simulated-users';
	import { setActiveIdentity } from '$lib/stores/network';
	import '$lib/components/onboard/onboard-form.css';

	let fullName = $state('');
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let bio = $state('');
	let postcode = $state('');
	let footfall = $state<'high' | 'medium' | 'low'>('medium');
	let website = $state('');
	let instagram = $state('');
	let imageUrl = $state('');
	let styles = $state<ArtStyle[]>(['figurative', 'abstract']);
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);
	let usernameTouched = $state(false);

	const copy = ONBOARD_COPY.venue;

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
					role: 'venue',
					email,
					password,
					full_name: fullName,
					username,
					bio,
					postcode,
					footfall,
					website,
					instagram,
					image_url: imageUrl,
					aesthetic_tags: styles.length ? styles : ['contemporary'],
					preferred_media: ['oil', 'acrylic', 'mixed media']
				})
			});

			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				identity?: SimulatedVenueProfile;
				redirectTo?: string;
			} | null;

			if (!response.ok || !payload?.identity) {
				errorMessage = payload?.message ?? 'Could not create venue account';
				return;
			}

			setActiveIdentity(payload.identity);

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

			await goto(payload.redirectTo ?? ROUTES.venue);
		} catch {
			errorMessage = 'Network error while creating your account.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<OnboardShell audience="venue" errorMessage={errorMessage}>
	<form class="onboard-form" onsubmit={submit}>
		<label>
			<span>Venue name</span>
			<input
				bind:value={fullName}
				oninput={onNameInput}
				required
				autocomplete="organization"
				placeholder="e.g. Spicer & Cole"
			/>
		</label>

		<div class="onboard-form__row onboard-form__row--2">
			<label>
				<span>Username</span>
				<input
					bind:value={username}
					oninput={() => (usernameTouched = true)}
					required
					autocomplete="username"
				/>
			</label>
			<label>
				<span>Postcode</span>
				<input
					bind:value={postcode}
					required
					autocomplete="postal-code"
					placeholder="e.g. BS8 1TH"
				/>
			</label>
		</div>
		<p class="onboard-form__hint">
			Your postcode places the room on the city map so nearby artists can find you.
		</p>

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

		<label>
			<span>Footfall</span>
			<select bind:value={footfall}>
				<option value="high">High - busy, lots of eyes</option>
				<option value="medium">Medium - steady neighbourhood flow</option>
				<option value="low">Low - intimate, quieter room</option>
			</select>
		</label>

		<label>
			<span>About the space</span>
			<textarea
				rows="5"
				bind:value={bio}
				required
				placeholder="Atmosphere, light, who visits - this becomes your public room summary."
			></textarea>
		</label>

		<label>
			<span>Venue image URL</span>
			<input type="url" bind:value={imageUrl} placeholder="https://… (optional for now)" />
			<p class="onboard-form__hint">A photo of the room helps artists picture the hang.</p>
		</label>

		<div class="onboard-form__row onboard-form__row--2">
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
			<p class="onboard-form__hint">We’ll lean recommendations toward these styles.</p>
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
