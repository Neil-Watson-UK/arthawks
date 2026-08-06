<script lang="ts">
	import { browser } from '$app/environment';
	import { env as publicEnv } from '$env/dynamic/public';
	import { onMount } from 'svelte';

	type Topic = 'hello' | 'artists' | 'venues' | 'support';

	let {
		topic = 'hello',
		heading = 'Get in touch',
		lede = 'We’ll reply from the right Art Hawks inbox.'
	}: {
		topic?: Topic;
		heading?: string;
		lede?: string;
	} = $props();

	let name = $state('');
	let email = $state('');
	let message = $state('');
	let company = $state(''); // honeypot
	let busy = $state(false);
	let errorMessage = $state<string | null>(null);
	let sent = $state(false);
	let captchaReady = $state(false);

	const siteKey = $derived((publicEnv.PUBLIC_RECAPTCHA_SITE_KEY ?? '').trim());

	onMount(() => {
		const key = (publicEnv.PUBLIC_RECAPTCHA_SITE_KEY ?? '').trim();
		if (!browser || !key) {
			captchaReady = true;
			return;
		}

		const existing = document.querySelector<HTMLScriptElement>('script[data-ah-recaptcha]');
		if (existing) {
			waitForGrecaptcha().then(() => {
				captchaReady = true;
			});
			return;
		}

		const script = document.createElement('script');
		script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
		script.async = true;
		script.defer = true;
		script.dataset.ahRecaptcha = '1';
		script.onload = () => {
			waitForGrecaptcha().then(() => {
				captchaReady = true;
			});
		};
		script.onerror = () => {
			errorMessage = 'Could not load captcha. Refresh and try again.';
		};
		document.head.appendChild(script);
	});

	function waitForGrecaptcha(): Promise<void> {
		return new Promise((resolve) => {
			const tick = () => {
				if (window.grecaptcha?.ready) {
					window.grecaptcha.ready(() => resolve());
					return;
				}
				setTimeout(tick, 50);
			};
			tick();
		});
	}

	async function getCaptchaToken(): Promise<string | undefined> {
		if (!siteKey) return undefined;
		if (!window.grecaptcha?.execute) {
			throw new Error('Captcha not ready');
		}
		return window.grecaptcha.execute(siteKey, { action: 'contact' });
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (busy) return;
		busy = true;
		errorMessage = null;
		try {
			const captchaToken = await getCaptchaToken();
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ topic, name, email, message, company, captchaToken })
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				errorMessage = payload?.message ?? 'Could not send';
				return;
			}
			sent = true;
		} catch {
			errorMessage = 'Network error';
		} finally {
			busy = false;
		}
	}
</script>

<section class="contact-form" aria-label={heading}>
	{#if sent}
		<p class="contact-form__ok" role="status">Thanks - we’ve got your message.</p>
	{:else}
		<header class="contact-form__head">
			<h2 class="contact-form__title">{heading}</h2>
			{#if lede}<p class="contact-form__lede">{lede}</p>{/if}
		</header>
		<form class="contact-form__fields" onsubmit={submit}>
			<label>
				Name
				<input required bind:value={name} autocomplete="name" />
			</label>
			<label>
				Email
				<input type="email" required bind:value={email} autocomplete="email" />
			</label>
			<label>
				Message
				<textarea required rows="4" bind:value={message}></textarea>
			</label>
			<!-- honeypot -->
			<label class="contact-form__hp" aria-hidden="true">
				Company
				<input tabindex="-1" autocomplete="off" bind:value={company} />
			</label>
			{#if errorMessage}
				<p class="contact-form__err" role="alert">{errorMessage}</p>
			{/if}
			<button type="submit" disabled={busy || (Boolean(siteKey) && !captchaReady)}>
				{busy ? 'Sending…' : 'Send message'}
			</button>
			{#if siteKey}
				<p class="contact-form__legal">
					Protected by reCAPTCHA -
					<a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank"
						>Privacy</a
					>
					·
					<a href="https://policies.google.com/terms" rel="noopener noreferrer" target="_blank"
						>Terms</a
					>
				</p>
			{/if}
		</form>
	{/if}
</section>

<style>
	.contact-form {
		max-width: 28rem;
	}
	.contact-form__title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 500;
	}
	.contact-form__lede {
		margin: 0.35rem 0 1rem;
		opacity: 0.8;
		line-height: 1.45;
	}
	.contact-form__fields {
		display: grid;
		gap: 0.75rem;
	}
	.contact-form__fields label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.contact-form__fields input,
	.contact-form__fields textarea {
		font: inherit;
		padding: 0.5rem 0.6rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		border-radius: 0.25rem;
		background: #fff;
	}
	.contact-form__fields button {
		font: inherit;
		font-weight: 600;
		padding: 0.65rem 1rem;
		border: none;
		background: #1e293b;
		color: #faf9f6;
		cursor: pointer;
	}
	.contact-form__fields button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.contact-form__hp {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	.contact-form__err {
		color: #9a3412;
		margin: 0;
	}
	.contact-form__ok {
		font-weight: 600;
	}
	.contact-form__legal {
		margin: 0;
		font-size: 0.7rem;
		opacity: 0.65;
		line-height: 1.35;
	}
	.contact-form__legal a {
		color: inherit;
	}
</style>
