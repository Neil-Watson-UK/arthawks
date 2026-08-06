<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import OnboardShell from '$lib/components/onboard/OnboardShell.svelte';
	import { ONBOARD_COPY } from '$lib/constants/onboard-copy';
	import { ART_STYLES, ART_STYLE_LABELS, type ArtStyle } from '$lib/constants/art-styles';
	import { ROUTES } from '$lib/constants/routes';
	import type { SimulatedBuyerProfile } from '$lib/data/simulated-users';
	import { setActiveIdentity, setTastePreferences, tastePreferences } from '$lib/stores/network';
	import '$lib/components/onboard/onboard-form.css';

	let fullName = $state('');
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let postcode = $state('');
	let styles = $state<ArtStyle[]>([]);
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);
	let usernameTouched = $state(false);

	const copy = ONBOARD_COPY.buyer;

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
					role: 'buyer',
					email,
					password,
					full_name: fullName,
					username,
					postcode: postcode.trim() || undefined,
					aesthetic_tags: styles
				})
			});

			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				identity?: SimulatedBuyerProfile;
				redirectTo?: string;
			} | null;

			if (!response.ok || !payload?.identity) {
				errorMessage = payload?.message ?? 'Could not create account';
				return;
			}

			setActiveIdentity(payload.identity);
			if (styles.length > 0) setTastePreferences(styles);

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

			await goto(payload.redirectTo ?? ROUTES.discover);
		} catch {
			errorMessage = 'Network error while creating your account.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<OnboardShell audience="buyer" errorMessage={errorMessage}>
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

		<label>
			<span>Postcode <em style="font-weight:400;text-transform:none;letter-spacing:0">(optional)</em></span>
			<input
				bind:value={postcode}
				autocomplete="postal-code"
				placeholder="e.g. BS6 5AA"
			/>
		</label>
		<p class="onboard-form__hint">
			Optional - helps Discover and the map show works near you.
		</p>

		<fieldset>
			<legend>Styles you look for</legend>
			<p class="onboard-form__hint">Optional - shapes Discover and map suggestions.</p>
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

		<p class="onboard-form__skip">
			Prefer to look around first?
			<a href={ROUTES.discover}>Browse Discover</a>
			<span aria-hidden="true"> · </span>
			<a href={ROUTES.map}>View the map</a>
		</p>
	</form>
</OnboardShell>
