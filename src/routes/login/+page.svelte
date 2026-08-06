<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ROUTES, hubForUserType } from '$lib/constants/routes';
	import { supabase } from '$lib/supabaseClient';
	import { setActiveIdentity } from '$lib/stores/network';
	import type { SessionIdentity } from '$lib/server/profile-identity';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);

	const next = $derived($page.url.searchParams.get('next') ?? '');

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;
		isSubmitting = true;
		errorMessage = null;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				identity?: SessionIdentity;
				redirectTo?: string;
				user_type?: string;
			} | null;

			if (!response.ok || !payload?.identity) {
				errorMessage = payload?.message ?? 'Could not sign in';
				return;
			}

			/* Sync browser client session for Realtime / storage */
			if (supabase) {
				await supabase.auth.signInWithPassword({ email, password });
			}

			setActiveIdentity(payload.identity as never);
			const dest =
				next ||
				payload.redirectTo ||
				hubForUserType(payload.user_type ?? payload.identity.role);
			await goto(dest);
		} catch {
			errorMessage = 'Network error while signing in.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="auth min-h-dvh bg-cream">
	<div class="auth__inner">
		<div class="auth__rule" aria-hidden="true"></div>
		<p class="auth__eyebrow">Welcome back</p>
		<h1 class="auth__title">Sign in</h1>
		<p class="auth__intro">Use the email and password for your Art Hawks account.</p>

		<form class="auth__form" onsubmit={submit}>
			<label class="auth__field">
				<span>Email</span>
				<input type="email" bind:value={email} required autocomplete="email" />
			</label>
			<label class="auth__field">
				<span>Password</span>
				<input type="password" bind:value={password} required minlength="8" autocomplete="current-password" />
			</label>

			{#if errorMessage}
				<p class="auth__error" role="alert">{errorMessage}</p>
			{/if}

			<button class="auth__submit" type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="auth__links">
			<a href={ROUTES.forgotPassword}>Forgot password?</a>
			<span aria-hidden="true">·</span>
			<a href={ROUTES.home}>Back to gateway</a>
		</p>
	</div>
</section>

<style>
	.auth {
		padding: 3rem 1.25rem 4rem;
	}
	.auth__inner {
		max-width: 26rem;
		margin: 0 auto;
	}
	.auth__rule {
		width: 3rem;
		height: 3px;
		background: var(--color-burnt);
		margin-bottom: 1.25rem;
	}
	.auth__eyebrow {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.55);
	}
	.auth__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 2.6rem);
		font-weight: 500;
		line-height: 1.1;
	}
	.auth__intro {
		margin: 0.75rem 0 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: rgb(30 41 59 / 0.75);
	}
	.auth__form {
		display: grid;
		gap: 1rem;
		margin-top: 1.75rem;
	}
	.auth__field {
		display: grid;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.auth__field input {
		padding: 0.7rem 0.85rem;
		border: 1px solid rgb(30 41 59 / 0.18);
		border-radius: 0.35rem;
		background: white;
		font: inherit;
		font-weight: 400;
	}
	.auth__error {
		margin: 0;
		color: var(--color-burnt);
		font-size: 0.85rem;
	}
	.auth__submit {
		margin-top: 0.25rem;
		padding: 0.85rem 1.25rem;
		border: none;
		border-radius: 0.35rem;
		background: var(--color-indigo);
		color: var(--color-cream);
		font-weight: 600;
		cursor: pointer;
	}
	.auth__submit:disabled {
		opacity: 0.65;
		cursor: wait;
	}
	.auth__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.5rem 0 0;
		font-size: 0.85rem;
	}
	.auth__links a {
		color: var(--color-burnt);
	}
</style>
