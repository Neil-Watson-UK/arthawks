<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ROUTES } from '$lib/constants/routes';
	import { ONBOARD_COPY, type OnboardAudience } from '$lib/constants/onboard-copy';

	let {
		audience,
		children,
		errorMessage = null
	}: {
		audience: OnboardAudience;
		children: Snippet;
		errorMessage?: string | null;
	} = $props();

	const copy = $derived(ONBOARD_COPY[audience]);
</script>

<section class="shell" data-audience={audience} aria-label="{copy.eyebrow} registration">
	<div class="shell__atmosphere" aria-hidden="true"></div>

	<div class="shell__frame">
		<div class="shell__grid">
			<div class="shell__pitch">
				<p class="shell__eyebrow">{copy.eyebrow}</p>
				<h1 class="shell__title">{copy.title}</h1>
				<p class="shell__lede">{copy.pitch}</p>
				<ul class="shell__benefits">
					{#each copy.benefits as line}
						<li>{line}</li>
					{/each}
				</ul>
			</div>

			<div class="shell__panel">
				<p class="shell__form-eyebrow">{copy.formEyebrow}</p>
				{@render children()}
				{#if errorMessage}
					<p class="shell__error" role="alert">{errorMessage}</p>
				{/if}
				<p class="shell__footer">
					Already have an account? <a href={ROUTES.login}>Sign in</a>
					{#if audience === 'buyer'}
						<span aria-hidden="true"> · </span>
						<a href={ROUTES.discover}>Browse without signing up</a>
					{/if}
				</p>
			</div>
		</div>
	</div>
</section>

<style>
	.shell {
		position: relative;
		isolation: isolate;
		min-height: 100dvh;
		padding: max(1.25rem, env(safe-area-inset-top)) 1.25rem max(2.5rem, env(safe-area-inset-bottom));
		color: var(--color-indigo);
		overflow: hidden;
	}

	.shell__atmosphere {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(ellipse 70% 55% at 85% 0%, rgb(194 65 12 / 0.14), transparent 55%),
			radial-gradient(ellipse 50% 40% at 0% 100%, rgb(30 41 59 / 0.08), transparent 50%),
			linear-gradient(165deg, #faf9f6 0%, #f4ebe3 48%, #faf9f6 100%);
		animation: shell-wash 18s ease-in-out infinite alternate;
	}

	.shell[data-audience='artist'] .shell__atmosphere {
		background:
			radial-gradient(ellipse 65% 50% at 90% 10%, rgb(194 65 12 / 0.18), transparent 55%),
			radial-gradient(ellipse 45% 35% at 5% 80%, rgb(30 41 59 / 0.1), transparent 50%),
			linear-gradient(160deg, #faf9f6 0%, #efe6dc 55%, #faf9f6 100%);
	}

	.shell[data-audience='venue'] .shell__atmosphere {
		background:
			radial-gradient(ellipse 60% 45% at 10% 0%, rgb(30 41 59 / 0.12), transparent 55%),
			radial-gradient(ellipse 55% 40% at 100% 90%, rgb(194 65 12 / 0.12), transparent 55%),
			linear-gradient(175deg, #f7f4ef 0%, #faf9f6 45%, #f0e8df 100%);
	}

	.shell[data-audience='buyer'] .shell__atmosphere {
		background:
			radial-gradient(ellipse 55% 45% at 50% -10%, rgb(194 65 12 / 0.1), transparent 50%),
			radial-gradient(ellipse 40% 35% at 100% 60%, rgb(30 41 59 / 0.07), transparent 50%),
			linear-gradient(180deg, #faf9f6 0%, #f6f1ea 100%);
	}

	.shell__frame {
		width: min(100%, 68rem);
		margin: 0 auto;
	}

	.shell__grid {
		display: grid;
		gap: 2.25rem;
	}

	.shell__pitch {
		animation: shell-rise 0.85s ease-out 0.08s both;
	}

	.shell__eyebrow {
		margin: 0;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-burnt);
	}

	.shell__title {
		margin: 0.55rem 0 0;
		max-width: 14ch;
		font-family: var(--font-display);
		font-size: clamp(2.35rem, 7vw, 3.6rem);
		font-weight: 500;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.shell__lede {
		margin: 1.1rem 0 0;
		max-width: 38ch;
		font-size: 1.05rem;
		line-height: 1.55;
		color: rgb(30 41 59 / 0.78);
	}

	.shell__benefits {
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.85rem;
		max-width: 40ch;
	}

	.shell__benefits li {
		position: relative;
		padding-left: 1.15rem;
		font-size: 0.925rem;
		line-height: 1.45;
		color: rgb(30 41 59 / 0.82);
	}

	.shell__benefits li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.55em;
		width: 0.55rem;
		height: 2px;
		background: var(--color-burnt);
	}

	.shell__panel {
		padding: 1.5rem 0 0;
		border-top: 1px solid rgb(30 41 59 / 0.1);
		animation: shell-rise 0.9s ease-out 0.16s both;
	}

	.shell__form-eyebrow {
		margin: 0 0 1rem;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.5);
	}

	.shell__error {
		margin: 1rem 0 0;
		color: #9a3412;
		font-size: 0.875rem;
	}

	.shell__footer {
		margin: 1.35rem 0 0;
		font-size: 0.875rem;
		color: rgb(30 41 59 / 0.55);
	}

	.shell__footer a {
		color: var(--color-burnt);
		text-decoration: none;
		font-weight: 600;
	}

	@keyframes shell-rise {
		from {
			opacity: 0;
			transform: translateY(0.85rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes shell-wash {
		from {
			filter: saturate(1);
		}
		to {
			filter: saturate(1.08);
		}
	}

	@media (min-width: 900px) {
		.shell {
			padding-inline: 2rem;
		}

		.shell__grid {
			grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
			gap: 3.5rem;
			align-items: start;
		}

		.shell__panel {
			padding: 0;
			border-top: none;
			border-left: 1px solid rgb(30 41 59 / 0.1);
			padding-left: 2.5rem;
		}

		.shell__title {
			max-width: 12ch;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shell__atmosphere,
		.shell__pitch,
		.shell__panel {
			animation: none;
		}
	}
</style>
