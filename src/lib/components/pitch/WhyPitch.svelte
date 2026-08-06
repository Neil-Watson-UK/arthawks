<script lang="ts">
	import ArtHawksLogo from '$lib/components/brand/ArtHawksLogo.svelte';
	import ContactForm from '$lib/components/contact/ContactForm.svelte';
	import { ROUTES } from '$lib/constants/routes';
	import type { WhyPitch } from '$lib/constants/why-pitch';

	let {
		pitch,
		theme
	}: {
		pitch: WhyPitch;
		theme: 'host' | 'exhibit';
	} = $props();
</script>

<svelte:head>
	<title>{pitch.metaTitle}</title>
	<meta name="description" content={pitch.metaDescription} />
</svelte:head>

<article class="pitch" data-theme={theme}>
	<div class="pitch__hero">
		<figure class="pitch__stage">
			<img class="pitch__image" src={pitch.heroImage} alt={pitch.heroAlt} width="1600" height="900" />
			<div class="pitch__veil" aria-hidden="true"></div>
		</figure>

		<div class="pitch__hero-copy">
			<p class="pitch__brand">
				<a href={ROUTES.home} aria-label="Art Hawks home">
					<ArtHawksLogo variant="nav" onDark class="pitch__logo" />
				</a>
			</p>
			<p class="pitch__eyebrow">{pitch.eyebrow}</p>
			<h1 class="pitch__headline">{pitch.headline}</h1>
			<p class="pitch__lede">{pitch.lede}</p>
			<div class="pitch__hero-cta">
				<a class="pitch__btn" href={pitch.ctaHref}>{pitch.ctaLabel}</a>
			</div>
		</div>
	</div>

	<div class="pitch__body">
		{#each pitch.acts as act, index (act.title)}
			<section class="pitch__act" style="--act-i: {index}">
				<p class="pitch__act-eyebrow">{act.eyebrow}</p>
				<h2 class="pitch__act-title">{act.title}</h2>
				<p class="pitch__act-body">{act.body}</p>
			</section>
		{/each}

		<section class="pitch__close" aria-label="Ready to begin">
			<p class="pitch__close-eyebrow">The curtain is open</p>
			<h2 class="pitch__close-title">
				{theme === 'host' ? 'Register your space' : 'Sign up - open your studio'}
			</h2>
			<p class="pitch__close-copy">{pitch.ctaHint}</p>
			<a class="pitch__btn pitch__btn--ink" href={pitch.ctaHref}>{pitch.ctaLabel}</a>
			<p class="pitch__signin">
				Already registered? <a href={ROUTES.login}>Sign in</a>
			</p>
		</section>

		<section class="pitch__enquire" aria-label="Ask a question">
			<ContactForm
				topic={theme === 'host' ? 'venues' : 'artists'}
				heading={theme === 'host' ? 'Ask the venues team' : 'Ask the artists team'}
				lede={theme === 'host'
					? 'Not ready to register? Write to venues@arthawks.com.'
					: 'Questions before you sign up? Write to artists@arthawks.com.'}
			/>
		</section>
	</div>

	<aside class="pitch__dock" aria-label="Sign up">
		<div class="pitch__dock-inner">
			<p class="pitch__dock-copy">
				{theme === 'host' ? 'Host art on your walls.' : 'Exhibit on living walls.'}
			</p>
			<a class="pitch__btn" href={pitch.ctaHref}>{pitch.ctaLabel}</a>
		</div>
	</aside>
</article>

<style>
	.pitch {
		--ink: var(--color-ink);
		--wall: var(--color-wall);
		--ember: var(--color-ember);
		--pulse: var(--color-pulse);
		--moss: var(--color-moss);
		--sky: var(--color-sky);
		--accent: var(--ember);
		--accent-soft: rgb(201 101 46 / 0.35);
		min-height: 100dvh;
		padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
		background: var(--ink);
		color: var(--wall);
	}

	.pitch[data-theme='host'] {
		--accent: #8fb39a;
		--accent-soft: rgb(47 79 64 / 0.45);
	}

	.pitch[data-theme='exhibit'] {
		--accent: var(--pulse);
		--accent-soft: rgb(201 101 46 / 0.4);
	}

	.pitch__hero {
		position: relative;
		isolation: isolate;
		min-height: min(100dvh, 52rem);
		display: grid;
		align-items: end;
	}

	.pitch__stage {
		position: absolute;
		inset: 0;
		z-index: -1;
		margin: 0;
		overflow: hidden;
		background: var(--ink);
	}

	.pitch__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		transform: scale(1.04);
		animation: pitch-hero 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.pitch__veil {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, rgb(14 24 31 / 0.35) 0%, rgb(14 24 31 / 0.55) 38%, rgb(14 24 31 / 0.92) 100%),
			radial-gradient(ellipse 80% 50% at 50% 0%, transparent 0%, rgb(14 24 31 / 0.45) 100%);
	}

	.pitch[data-theme='host'] .pitch__veil {
		background:
			linear-gradient(180deg, rgb(14 24 31 / 0.4) 0%, rgb(14 24 31 / 0.62) 40%, rgb(14 24 31 / 0.94) 100%),
			radial-gradient(ellipse 70% 45% at 20% 10%, rgb(47 79 64 / 0.35), transparent 55%);
	}

	.pitch[data-theme='exhibit'] .pitch__veil {
		background:
			linear-gradient(180deg, rgb(14 24 31 / 0.38) 0%, rgb(14 24 31 / 0.58) 42%, rgb(14 24 31 / 0.94) 100%),
			radial-gradient(ellipse 70% 45% at 80% 8%, rgb(201 101 46 / 0.28), transparent 55%);
	}

	.pitch__hero-copy {
		width: min(100%, 40rem);
		margin: 0 auto;
		padding: max(7.5rem, calc(env(safe-area-inset-top) + 6rem)) 1.25rem 3.25rem;
		animation: pitch-rise 800ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
	}

	.pitch__brand {
		margin: 0 0 1.5rem;
		line-height: 0;
	}

	.pitch__brand a {
		display: inline-block;
	}

	.pitch__brand :global(.pitch__logo) {
		width: min(100%, 11.5rem);
		filter: drop-shadow(0 14px 30px rgb(0 0 0 / 0.35));
	}

	.pitch__eyebrow {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.pitch__headline {
		margin: 0.55rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 9vw, 4.25rem);
		font-weight: 500;
		letter-spacing: -0.035em;
		line-height: 0.98;
		max-width: 10ch;
	}

	.pitch__lede {
		margin: 1.15rem 0 0;
		max-width: 28ch;
		font-size: clamp(1.05rem, 2.8vw, 1.2rem);
		line-height: 1.45;
		color: rgb(232 228 218 / 0.78);
	}

	.pitch__hero-cta {
		margin-top: 1.75rem;
	}

	.pitch__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.9rem;
		padding: 0.75rem 1.25rem;
		border: 1px solid transparent;
		background: var(--ember);
		color: var(--wall);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		transition: filter 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.pitch[data-theme='host'] .pitch__btn {
		background: var(--moss);
	}

	.pitch__btn:hover {
		filter: brightness(1.06);
		transform: translateY(-1px);
	}

	.pitch__btn--ink {
		background: var(--ink);
		border-color: rgb(14 24 31 / 0.2);
		color: var(--wall);
	}

	.pitch__body {
		background:
			radial-gradient(ellipse 50% 30% at 100% 0%, var(--accent-soft), transparent 55%),
			var(--wall);
		color: var(--ink);
		padding: 3.5rem 1.25rem 4rem;
	}

	.pitch__act {
		width: min(100%, 34rem);
		margin: 0 auto;
		padding: 2.25rem 0;
		border-top: 1px solid rgb(14 24 31 / 0.1);
		animation: pitch-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: calc(180ms + var(--act-i) * 70ms);
	}

	.pitch__act:first-child {
		border-top: none;
		padding-top: 0;
	}

	.pitch__act-eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ember);
	}

	.pitch[data-theme='host'] .pitch__act-eyebrow {
		color: var(--moss);
	}

	.pitch__act-title {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.65rem, 4vw, 2.15rem);
		font-weight: 500;
		letter-spacing: -0.03em;
		line-height: 1.15;
		max-width: 16ch;
	}

	.pitch__act-body {
		margin: 0.85rem 0 0;
		max-width: 38ch;
		font-size: 1.02rem;
		line-height: 1.6;
		color: rgb(14 24 31 / 0.72);
	}

	.pitch__close {
		width: min(100%, 34rem);
		margin: 2.5rem auto 0;
		padding-top: 2.5rem;
		border-top: 1px solid rgb(14 24 31 / 0.12);
		text-align: left;
	}

	.pitch__close-eyebrow {
		margin: 0;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ember);
	}

	.pitch[data-theme='host'] .pitch__close-eyebrow {
		color: var(--moss);
	}

	.pitch__close-title {
		margin: 0.45rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.4rem);
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.pitch__close-copy {
		margin: 0.75rem 0 1.35rem;
		max-width: 34ch;
		line-height: 1.5;
		color: rgb(14 24 31 / 0.65);
	}

	.pitch__enquire {
		width: min(100%, 34rem);
		margin: 3rem auto 0;
		padding-top: 2rem;
		border-top: 1px solid rgb(14 24 31 / 0.12);
	}

	.pitch__signin {
		margin: 1.1rem 0 0;
		font-size: 0.875rem;
		color: rgb(14 24 31 / 0.55);
	}

	.pitch__signin a {
		color: var(--ember);
		font-weight: 600;
		text-decoration: none;
	}

	.pitch[data-theme='host'] .pitch__signin a {
		color: var(--moss);
	}

	.pitch__dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 60;
		padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
		background: rgb(14 24 31 / 0.92);
		backdrop-filter: blur(14px);
		border-top: 1px solid rgb(232 228 218 / 0.12);
		animation: pitch-dock 500ms cubic-bezier(0.22, 1, 0.36, 1) 400ms both;
	}

	.pitch__dock-inner {
		width: min(100%, 42rem);
		margin: 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
	}

	.pitch__dock-copy {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 500;
		color: var(--wall);
	}

	.pitch__dock .pitch__btn {
		flex: 0 0 auto;
	}

	@keyframes pitch-hero {
		from {
			opacity: 0;
			transform: scale(1.08);
		}
		to {
			opacity: 1;
			transform: scale(1.04);
		}
	}

	@keyframes pitch-rise {
		from {
			opacity: 0;
			transform: translateY(0.85rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pitch-dock {
		from {
			opacity: 0;
			transform: translateY(100%);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (min-width: 820px) {
		.pitch__hero-copy {
			padding-bottom: 4rem;
		}

		.pitch__lede {
			max-width: 32ch;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pitch__image,
		.pitch__hero-copy,
		.pitch__act,
		.pitch__dock {
			animation: none;
		}
	}
</style>
