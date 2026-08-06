<script lang="ts">
	import { goto } from '$app/navigation';
	import ArtHawksLogo from '$lib/components/brand/ArtHawksLogo.svelte';
	import {
		ART_STYLE_LABELS,
		ART_STYLES,
		type ArtStyle
	} from '$lib/constants/art-styles';
	import type { OnboardUserType } from '$lib/constants/routes';
	import {
		applyGatewayIdentity,
		parseGatewayIntent,
		redirectForTasteExplore,
		redirectForUserType
	} from '$lib/onboard';

	interface Props {
		onSubmit?: (input: string) => Promise<void>;
	}

	let { onSubmit }: Props = $props();

	let input = $state('');
	let selectedStyles = $state<ArtStyle[]>([]);
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	const choices: {
		type: OnboardUserType;
		theme: 'spaces' | 'art' | 'people';
		label: string;
		eyebrow: string;
		blurb: string;
	}[] = [
		{
			type: 'venue',
			theme: 'spaces',
			eyebrow: 'Spaces',
			label: 'I host a room',
			blurb: 'Match local artists to your walls. Guests linger, scan, and buy.'
		},
		{
			type: 'artist',
			theme: 'art',
			eyebrow: 'Art',
			label: 'I make the work',
			blurb: 'Hang where people already gather — real eyes, and a clear path to a sale.'
		},
		{
			type: 'buyer',
			theme: 'people',
			eyebrow: 'People',
			label: 'I’m exploring',
			blurb: 'Find hung work on the map or a wall QR. Buy it, collect it there.'
		}
	];

	const steps = [
		{
			label: 'Hang',
			body: 'Artists and venues match. Work goes up in cafés, bars, hotels, and neighbourhood rooms.'
		},
		{
			label: 'Discover',
			body: 'Explorers find it on the city map, in a room, or by scanning a wall label.'
		},
		{
			label: 'Buy & collect',
			body: 'Pay at the door, get a pickup code, and take the piece home from the venue.'
		}
	] as const;

	function toggleStyle(style: ArtStyle): void {
		if (selectedStyles.includes(style)) {
			selectedStyles = selectedStyles.filter((item) => item !== style);
		} else {
			selectedStyles = [...selectedStyles, style];
		}
	}

	async function postOnboard(
		body: Record<string, string>,
		options: { tasteExplore?: boolean } = {}
	): Promise<void> {
		if (isSubmitting) return;

		const withStyles = {
			...body,
			styles: selectedStyles.join(',')
		};

		const intent = parseGatewayIntent(withStyles);
		if (!intent) {
			errorMessage = 'Please choose a path or describe who you are and what you’re looking for.';
			return;
		}

		isSubmitting = true;
		errorMessage = null;

		try {
			/* Taste form always explores matches; triad buttons keep role routing */
			const explore = options.tasteExplore === true;
			const userType = explore ? 'buyer' : intent.userType;
			applyGatewayIdentity(userType, intent.styles);

			const fallbackRedirect = explore
				? redirectForTasteExplore(intent.styles, body.text ?? null)
				: redirectForUserType(userType, intent.styles);

			const response = await fetch('/api/onboard', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...withStyles,
					type: userType,
					taste_explore: explore ? '1' : undefined
				})
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					message?: string;
				} | null;
				errorMessage = payload?.message ?? 'Could not save your preference. Please try again.';
				return;
			}

			const payload = (await response.json()) as { redirectTo?: string };

			if (onSubmit && body.text) {
				await onSubmit(body.text);
			}

			await goto(payload.redirectTo ?? fallbackRedirect);
		} catch {
			errorMessage = 'Network error while saving your preference. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const text = input.trim();
		if (!text && selectedStyles.length === 0) return;
		await postOnboard({ text: text || 'looking for local art' }, { tasteExplore: true });
	}

	async function handleChoice(type: OnboardUserType): Promise<void> {
		await postOnboard({ type });
	}
</script>
<section class="gateway" aria-label="Art Hawks welcome">
	<div class="gateway__atmosphere" aria-hidden="true">
		<div class="gateway__glow gateway__glow--ember"></div>
		<div class="gateway__glow gateway__glow--moss"></div>
		<div class="gateway__glow gateway__glow--sky"></div>
		<div class="gateway__collage">
			<img src="/artworks/StokesCroft.jpg" alt="" class="gateway__panel gateway__panel--a" />
			<img
				src="/artworks/BridgeofGertSighs.JPG"
				alt=""
				class="gateway__panel gateway__panel--b"
			/>
			<img
				src="/artworks/GirlwithPearlEarring.webp"
				alt=""
				class="gateway__panel gateway__panel--c"
			/>
		</div>
		<div class="gateway__veil"></div>
		<div class="gateway__grain"></div>
	</div>

	<div class="gateway__threshold">
		<header class="gateway__hero">
			<p class="gateway__kicker">
				<span class="gateway__pulse" aria-hidden="true"></span>
				A living gallery across the city
			</p>
			<h1 class="gateway__brand">
				<span class="sr-only">Art Hawks</span>
				<span class="gateway__brand-lockup" aria-hidden="true">
					<ArtHawksLogo variant="nav" onDark class="gateway__logo" />
				</span>
			</h1>
			<p class="gateway__title">The city is the gallery.</p>
			<p class="gateway__lede">
				Everyday rooms — cafés, bars, hotels, neighbourhood spaces — hang original art. Find it on
				the wall or the map, buy it, and collect it there.
			</p>
		</header>

		<nav class="gateway__triad" aria-label="Enter through spaces, art, or people">
			{#each choices as choice (choice.type)}
				<button
					type="button"
					class="gateway__path gateway__path--{choice.theme}"
					disabled={isSubmitting}
					onclick={() => handleChoice(choice.type)}
				>
					<span class="gateway__path-eyebrow">{choice.eyebrow}</span>
					<span class="gateway__path-label">{choice.label}</span>
					<span class="gateway__path-blurb">{choice.blurb}</span>
					<span class="gateway__path-cta" aria-hidden="true">Enter</span>
				</button>
			{/each}
		</nav>

		<p class="gateway__hint">
			Explorers can browse Discover and the map without an account. Already registered?
			<a href="/login">Sign in</a>.
		</p>
	</div>

	<section class="gateway__premise" aria-labelledby="gateway-premise-title">
		<div class="gateway__premise-inner">
			<header class="gateway__premise-head">
				<p class="gateway__premise-kicker">The premise</p>
				<h2 id="gateway-premise-title" class="gateway__premise-title">
					Not another feed. A distributed gallery.
				</h2>
				<p class="gateway__premise-lede">
					Artists hang work in everyday rooms. Venues host living walls. Explorers discover, buy,
					and collect — so a glance on a café wall can become a piece you take home.
				</p>
			</header>

			<ol class="gateway__steps">
				{#each steps as step, index (step.label)}
					<li class="gateway__step" style="--step-i: {index}">
						<span class="gateway__step-index" aria-hidden="true">{index + 1}</span>
						<p class="gateway__step-label">{step.label}</p>
						<p class="gateway__step-body">{step.body}</p>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<div class="gateway__atelier">
		<div class="gateway__atelier-inner">
			<header class="gateway__atelier-head">
				<p class="gateway__atelier-kicker">Or describe the feeling</p>
				<h2 class="gateway__atelier-title">What are you drawn toward?</h2>
				<p class="gateway__atelier-copy">
					Tell us the kind of work that stops you. We’ll shortlist rooms, artists, and pieces that
					match.
				</p>
			</header>

			<form class="gateway__form" onsubmit={handleSubmit}>
				<label class="gateway__label" for="gateway-input">Your answer</label>
				<textarea
					id="gateway-input"
					class="gateway__input"
					rows="3"
					placeholder="e.g. I’m looking for abstract and landscape work in Bristol cafés…"
					bind:value={input}
					disabled={isSubmitting}
				></textarea>

				<fieldset class="gateway__styles">
					<legend class="gateway__label">Art you’re drawn to</legend>
					<div class="gateway__style-grid">
						{#each ART_STYLES as style (style)}
							<button
								type="button"
								class="gateway__style"
								class:gateway__style--on={selectedStyles.includes(style)}
								aria-pressed={selectedStyles.includes(style)}
								disabled={isSubmitting}
								onclick={() => toggleStyle(style)}
							>
								{ART_STYLE_LABELS[style]}
							</button>
						{/each}
					</div>
				</fieldset>

				<button
					class="gateway__submit"
					type="submit"
					disabled={isSubmitting || (!input.trim() && selectedStyles.length === 0)}
				>
					{isSubmitting ? 'Finding…' : 'Show me matches'}
				</button>
			</form>

			{#if errorMessage}
				<p class="gateway__error" role="alert">{errorMessage}</p>
			{/if}
		</div>
	</div>
</section>

<style>
	.gateway {
		--ink: var(--color-ink, #0e181f);
		--wall: var(--color-wall, #e8e4da);
		--ember: var(--color-ember, #c9652e);
		--pulse: var(--color-pulse, #d4a35a);
		--moss: var(--color-moss, #2f4f40);
		--sky: var(--color-sky, #5c7a8a);
		position: relative;
		isolation: isolate;
		color: var(--wall);
		background: var(--ink);
	}

	.gateway__atmosphere {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}

	.gateway__glow {
		position: absolute;
		border-radius: 50%;
		filter: blur(60px);
		opacity: 0.55;
		animation: drift 18s ease-in-out infinite alternate;
	}

	.gateway__glow--ember {
		width: min(55vw, 28rem);
		height: min(55vw, 28rem);
		top: -8%;
		right: -6%;
		background: rgb(201 101 46 / 0.45);
	}

	.gateway__glow--moss {
		width: min(48vw, 24rem);
		height: min(48vw, 24rem);
		bottom: 18%;
		left: -10%;
		background: rgb(47 79 64 / 0.5);
		animation-delay: -6s;
	}

	.gateway__glow--sky {
		width: min(40vw, 20rem);
		height: min(40vw, 20rem);
		top: 38%;
		right: 18%;
		background: rgb(92 122 138 / 0.35);
		animation-delay: -11s;
	}

	.gateway__collage {
		position: absolute;
		inset: 0;
		opacity: 0.38;
	}

	.gateway__panel {
		position: absolute;
		object-fit: cover;
		border: 1px solid rgb(243 240 232 / 0.12);
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.35);
		animation: float-panel 14s ease-in-out infinite alternate;
	}

	.gateway__panel--a {
		width: min(42vw, 18rem);
		aspect-ratio: 4 / 5;
		top: 12%;
		left: 4%;
		transform: rotate(-6deg);
	}

	.gateway__panel--b {
		width: min(36vw, 15rem);
		aspect-ratio: 3 / 4;
		top: 8%;
		right: 6%;
		transform: rotate(5deg);
		animation-delay: -4s;
	}

	.gateway__panel--c {
		width: min(34vw, 14rem);
		aspect-ratio: 1 / 1;
		bottom: 28%;
		left: 42%;
		transform: rotate(-2deg);
		animation-delay: -8s;
		opacity: 0.85;
	}

	.gateway__veil {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, rgb(14 24 31 / 0.55) 0%, rgb(14 24 31 / 0.78) 42%, rgb(14 24 31 / 0.94) 100%),
			radial-gradient(ellipse 70% 50% at 50% 20%, transparent 0%, rgb(14 24 31 / 0.55) 100%);
	}

	.gateway__grain {
		position: absolute;
		inset: 0;
		opacity: 0.18;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
		mix-blend-mode: soft-light;
	}

	.gateway__threshold {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 2.5rem;
		min-height: min(100dvh, 56rem);
		padding: max(8.5rem, calc(env(safe-area-inset-top) + 7rem)) 1.25rem 3.5rem;
		text-align: center;
	}

	.gateway__hero {
		display: grid;
		justify-items: center;
		max-width: 36rem;
	}

	.gateway__kicker {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0 0 1.35rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgb(232 228 218 / 0.62);
		animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.gateway__pulse {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--pulse);
		box-shadow: 0 0 0 0 rgb(212 163 90 / 0.55);
		animation: pulse-ring 2.4s ease-out infinite;
	}

	.gateway__brand {
		margin: 0;
		line-height: 0;
	}

	.gateway__brand-lockup {
		display: grid;
		justify-items: center;
	}

	.gateway__brand-lockup :global(.gateway__logo) {
		width: min(100%, 14rem);
		filter: drop-shadow(0 18px 40px rgb(0 0 0 / 0.35));
		animation: rise 780ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both;
	}

	.gateway__title {
		margin: 1.75rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.85rem, 5.5vw, 2.65rem);
		font-weight: 500;
		line-height: 1.12;
		letter-spacing: -0.03em;
		color: var(--wall);
		max-width: 16ch;
		animation: rise 760ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
	}

	.gateway__lede {
		margin: 1rem 0 0;
		max-width: 42ch;
		font-size: clamp(0.98rem, 2.8vw, 1.08rem);
		line-height: 1.55;
		color: rgb(232 228 218 / 0.72);
		animation: rise 760ms cubic-bezier(0.22, 1, 0.36, 1) 220ms both;
	}

	.gateway__triad {
		display: grid;
		gap: 0.85rem;
		width: min(100%, 58rem);
		animation: rise 820ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both;
	}

	.gateway__path {
		display: grid;
		gap: 0.45rem;
		justify-items: start;
		padding: 1.25rem 1.3rem 1.15rem;
		border: 1px solid rgb(232 228 218 / 0.14);
		background: rgb(232 228 218 / 0.05);
		backdrop-filter: blur(10px);
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
			border-color 220ms ease,
			background 220ms ease;
	}

	.gateway__path:hover:not(:disabled),
	.gateway__path:focus-visible:not(:disabled) {
		transform: translateY(-2px);
		background: rgb(232 228 218 / 0.09);
	}

	.gateway__path:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.gateway__path--spaces {
		border-color: rgb(47 79 64 / 0.55);
	}

	.gateway__path--art {
		border-color: rgb(201 101 46 / 0.45);
	}

	.gateway__path--people {
		border-color: rgb(92 122 138 / 0.5);
	}

	.gateway__path-eyebrow {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.gateway__path--spaces .gateway__path-eyebrow {
		color: #8fb39a;
	}

	.gateway__path--art .gateway__path-eyebrow {
		color: var(--pulse);
	}

	.gateway__path--people .gateway__path-eyebrow {
		color: #9bb5c4;
	}

	.gateway__path-label {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.2rem, 3.5vw, 1.45rem);
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: -0.02em;
		color: var(--wall);
	}

	.gateway__path-blurb {
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgb(232 228 218 / 0.62);
	}

	.gateway__path-cta {
		margin-top: 0.35rem;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--pulse);
	}

	.gateway__hint {
		margin: 0;
		max-width: 40ch;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: rgb(232 228 218 / 0.48);
		animation: rise 760ms cubic-bezier(0.22, 1, 0.36, 1) 340ms both;
	}

	.gateway__hint a {
		color: var(--pulse);
		font-weight: 600;
		text-decoration: none;
		border-bottom: 1px solid rgb(212 163 90 / 0.35);
	}

	.gateway__premise {
		position: relative;
		padding: 0 1.25rem 3.5rem;
		background:
			linear-gradient(180deg, transparent 0%, rgb(14 24 31 / 0.55) 12%, rgb(14 24 31 / 0.92) 100%);
		color: var(--wall);
	}

	.gateway__premise-inner {
		width: min(100%, 58rem);
		margin: 0 auto;
		padding-top: 0.5rem;
	}

	.gateway__premise-head {
		max-width: 38rem;
		margin-bottom: 2rem;
		text-align: left;
	}

	.gateway__premise-kicker {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--pulse);
	}

	.gateway__premise-title {
		margin: 0.55rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.45rem, 3.8vw, 1.95rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.gateway__premise-lede {
		margin: 0.85rem 0 0;
		max-width: 48ch;
		font-size: 0.98rem;
		line-height: 1.55;
		color: rgb(232 228 218 / 0.68);
	}

	.gateway__steps {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gateway__step {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		column-gap: 0.9rem;
		row-gap: 0.25rem;
		padding: 1.1rem 0 1.15rem;
		border-top: 1px solid rgb(232 228 218 / 0.12);
		animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) calc(80ms + var(--step-i, 0) * 70ms) both;
	}

	.gateway__step-index {
		grid-row: 1 / span 2;
		align-self: start;
		margin-top: 0.2rem;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
		font-weight: 500;
		line-height: 1;
		color: var(--pulse);
		opacity: 0.85;
	}

	.gateway__step-label {
		margin: 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 1.15rem;
		font-weight: 500;
		letter-spacing: -0.02em;
		line-height: 1.2;
		color: var(--wall);
	}

	.gateway__step-body {
		margin: 0;
		max-width: 40ch;
		font-size: 0.9rem;
		line-height: 1.5;
		color: rgb(232 228 218 / 0.62);
	}

	.gateway__atelier {
		position: relative;
		padding: 0 1.25rem 4.5rem;
		background:
			linear-gradient(180deg, rgb(14 24 31 / 0.2) 0%, transparent 18%),
			var(--wall);
		color: var(--ink);
	}

	.gateway__atelier-inner {
		width: min(100%, 34rem);
		margin: 0 auto;
		padding-top: 3rem;
	}

	.gateway__atelier-head {
		margin-bottom: 1.75rem;
	}

	.gateway__atelier-kicker {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ember);
	}

	.gateway__atelier-title {
		margin: 0.55rem 0 0;
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: clamp(1.55rem, 4vw, 2rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.gateway__atelier-copy {
		margin: 0.75rem 0 0;
		max-width: 34ch;
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgb(14 24 31 / 0.62);
	}

	.gateway__form {
		display: grid;
		gap: 0.75rem;
	}

	.gateway__label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.45);
	}

	.gateway__input {
		width: 100%;
		padding: 1rem 1.1rem;
		border: 1px solid rgb(14 24 31 / 0.14);
		background: rgb(243 240 232 / 0.7);
		color: var(--ink);
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.9375rem;
		line-height: 1.5;
		resize: vertical;
		min-height: 5.5rem;
	}

	.gateway__input:focus {
		outline: none;
		border-color: rgb(201 101 46 / 0.55);
		box-shadow: 0 0 0 3px rgb(201 101 46 / 0.12);
	}

	.gateway__styles {
		margin: 0.35rem 0 0;
		padding: 0;
		border: none;
	}

	.gateway__style-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.gateway__style {
		min-height: 2.15rem;
		padding: 0 0.8rem;
		border: 1px solid rgb(14 24 31 / 0.14);
		background: transparent;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(14 24 31 / 0.55);
		cursor: pointer;
		transition:
			border-color 180ms ease,
			background 180ms ease,
			color 180ms ease;
	}

	.gateway__style--on {
		border-color: var(--ember);
		background: rgb(201 101 46 / 0.1);
		color: var(--ember);
	}

	.gateway__submit {
		justify-self: start;
		min-height: 2.85rem;
		padding: 0 1.35rem;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--wall);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.gateway__submit:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.gateway__error {
		margin: 1.25rem 0 0;
		font-size: 0.875rem;
		color: #9a3412;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.7rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse-ring {
		0% {
			box-shadow: 0 0 0 0 rgb(212 163 90 / 0.55);
		}
		70% {
			box-shadow: 0 0 0 12px rgb(212 163 90 / 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgb(212 163 90 / 0);
		}
	}

	@keyframes drift {
		from {
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			transform: translate3d(2%, 3%, 0) scale(1.08);
		}
	}

	@keyframes float-panel {
		from {
			translate: 0 0;
		}
		to {
			translate: 0 -0.75rem;
		}
	}

	@media (min-width: 820px) {
		.gateway__triad {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 1rem;
			text-align: left;
		}

		.gateway__steps {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 1.5rem;
		}

		.gateway__step {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto auto;
			padding: 0;
			border-top: none;
			border-left: 1px solid rgb(232 228 218 / 0.12);
			padding-left: 1.25rem;
		}

		.gateway__step:first-child {
			border-left: none;
			padding-left: 0;
		}

		.gateway__step-index {
			grid-row: auto;
			margin-bottom: 0.65rem;
		}

		.gateway__panel--a {
			left: 7%;
			top: 14%;
		}

		.gateway__panel--b {
			right: 8%;
		}

		.gateway__panel--c {
			left: 48%;
			bottom: 32%;
		}

		.gateway__threshold {
			gap: 3rem;
			padding-bottom: 4.5rem;
		}

		.gateway__premise {
			padding-bottom: 4.5rem;
		}
	}

	@media (max-width: 640px) {
		.gateway__panel--c {
			display: none;
		}

		.gateway__collage {
			opacity: 0.2;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.gateway__kicker,
		.gateway__brand-lockup :global(.gateway__logo),
		.gateway__title,
		.gateway__lede,
		.gateway__triad,
		.gateway__hint,
		.gateway__step,
		.gateway__glow,
		.gateway__panel,
		.gateway__pulse {
			animation: none;
		}
	}
</style>
