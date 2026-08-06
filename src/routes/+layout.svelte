<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import '../app.css';
	import SiteHeader from '$lib/components/brand/SiteHeader.svelte';
	import { ROUTES } from '$lib/constants/routes';
	import { initNetwork, networkError, setActiveIdentity, clearSessionIdentity } from '$lib/stores/network';
	import { hydrateRotationsFromDb, rotationsError } from '$lib/stores/rotations';

	declare global {
		interface Window {
			gtag?: (...args: unknown[]) => void;
		}
	}

	let { children, data } = $props();

	/* SPA navigations - initial pageview comes from the gtag config in app.html */
	afterNavigate(({ to }) => {
		if (!browser || !to || typeof window.gtag !== 'function') return;
		window.gtag('config', 'G-NB5J166NFF', { page_path: to.url.pathname + to.url.search });
	});

	const showRotationsBanner = $derived(
		Boolean($rotationsError) &&
			($page.url.pathname.startsWith(ROUTES.venueCalendar) ||
				$page.url.pathname.startsWith(ROUTES.venuePulse) ||
				$page.url.pathname.startsWith(ROUTES.artistInbox))
	);

	const hideChrome = $derived(
		$page.url.pathname === ROUTES.whyHost || $page.url.pathname === ROUTES.whyExhibit
	);

	/* Session is source of truth when present; unsigned visitors browse as a guest explorer */
	$effect(() => {
		if (data.sessionIdentity) {
			setActiveIdentity(data.sessionIdentity as never);
		} else if (!data.demoIdentities) {
			clearSessionIdentity();
		}
	});

	onMount(() => {
		let stopRealtime: (() => void) | undefined;

		void initNetwork({
			preferSessionIdentity: Boolean(data.sessionIdentity),
			demoIdentities: data.demoIdentities
		}).then(async (stop) => {
			stopRealtime = stop;
			await hydrateRotationsFromDb();
		});

		return () => {
			stopRealtime?.();
		};
	});
</script>

<svelte:head>
	<title>Art Hawks</title>
	<meta
		name="description"
		content="Opening spaces. Connecting people. Art for everyday life."
	/>
</svelte:head>

{#if $networkError}
	<div class="network-banner" role="status">
		<p class="network-banner__copy">
			Live database sync issue: {$networkError}. Falling back where possible - check
			<code>.env</code> and the Phase 1 SQL script.
		</p>
	</div>
{/if}

{#if showRotationsBanner}
	<div class="network-banner" role="status">
		<p class="network-banner__copy">
			Wall calendar needs one database update. In Supabase → SQL Editor, paste and run
			<code>scripts/APPLY_IN_SUPABASE.sql</code>, then refresh this page.
		</p>
	</div>
{/if}

{#if !hideChrome}
	<SiteHeader
		demoIdentities={data.demoIdentities}
		signedIn={Boolean(data.session || data.sessionIdentity)}
	/>
{/if}
{@render children()}

<style>
	.network-banner {
		position: sticky;
		top: 0;
		z-index: 70;
		padding: 0.65rem 1rem;
		background: rgb(194 65 12 / 0.12);
		border-bottom: 1px solid rgb(194 65 12 / 0.35);
	}

	.network-banner__copy {
		margin: 0;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--color-indigo);
	}

	.network-banner__copy code {
		font-size: 0.7rem;
	}
</style>
