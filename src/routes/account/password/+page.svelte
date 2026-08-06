<script lang="ts">
	import { ROUTES } from '$lib/constants/routes';
	import { supabase } from '$lib/supabaseClient';

	let { data } = $props();

	let password = $state('');
	let confirm = $state('');
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let isSubmitting = $state(false);

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (isSubmitting) return;
		if (password.length < 8) {
			errorMessage = 'Password must be at least 8 characters.';
			return;
		}
		if (password !== confirm) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		isSubmitting = true;
		errorMessage = null;
		message = null;

		try {
			const response = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});
			const payload = (await response.json().catch(() => null)) as { message?: string } | null;
			if (!response.ok) {
				errorMessage = payload?.message ?? 'Could not update password';
				return;
			}
			if (supabase) {
				await supabase.auth.updateUser({ password });
			}
			message = payload?.message ?? 'Password updated.';
			password = '';
			confirm = '';
		} catch {
			errorMessage = 'Network error.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="auth min-h-dvh bg-cream">
	<div class="auth__inner">
		<div class="auth__rule" aria-hidden="true"></div>
		<p class="auth__eyebrow">Account</p>
		<h1 class="auth__title">Change password</h1>
		{#if data.email}
			<p class="auth__intro">Signed in as {data.email}</p>
		{/if}

		<form class="auth__form" onsubmit={submit}>
			<label class="auth__field">
				<span>New password</span>
				<input type="password" bind:value={password} required minlength="8" autocomplete="new-password" />
			</label>
			<label class="auth__field">
				<span>Confirm password</span>
				<input type="password" bind:value={confirm} required minlength="8" autocomplete="new-password" />
			</label>
			{#if errorMessage}
				<p class="auth__error" role="alert">{errorMessage}</p>
			{/if}
			{#if message}
				<p class="auth__ok" role="status">{message}</p>
			{/if}
			<button class="auth__submit" type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving…' : 'Update password'}
			</button>
		</form>
		<p class="auth__links"><a href={ROUTES.home}>Home</a></p>
	</div>
</section>

<style>
	.auth { padding: 3rem 1.25rem 4rem; }
	.auth__inner { max-width: 26rem; margin: 0 auto; }
	.auth__rule { width: 3rem; height: 3px; background: var(--color-burnt); margin-bottom: 1.25rem; }
	.auth__eyebrow { margin: 0; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgb(30 41 59 / 0.55); }
	.auth__title { margin: 0.35rem 0 0; font-family: var(--font-display); font-size: clamp(2rem, 5vw, 2.6rem); font-weight: 500; }
	.auth__intro { margin: 0.75rem 0 0; font-size: 0.95rem; line-height: 1.5; color: rgb(30 41 59 / 0.75); }
	.auth__form { display: grid; gap: 1rem; margin-top: 1.75rem; }
	.auth__field { display: grid; gap: 0.35rem; font-size: 0.8rem; font-weight: 600; }
	.auth__field input { padding: 0.7rem 0.85rem; border: 1px solid rgb(30 41 59 / 0.18); border-radius: 0.35rem; background: white; font: inherit; font-weight: 400; }
	.auth__error { margin: 0; color: var(--color-burnt); font-size: 0.85rem; }
	.auth__ok { margin: 0; color: var(--color-indigo); font-size: 0.85rem; }
	.auth__submit { padding: 0.85rem 1.25rem; border: none; border-radius: 0.35rem; background: var(--color-indigo); color: var(--color-cream); font-weight: 600; cursor: pointer; }
	.auth__links { margin: 1.5rem 0 0; font-size: 0.85rem; }
	.auth__links a { color: var(--color-burnt); }
</style>
